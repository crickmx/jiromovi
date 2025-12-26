# Solución Definitiva: Catálogos No Disponibles en SICAS

## Problema Original

SICAS devolvía respuestas **contradictorias** para catálogos no disponibles:

```xml
<ReadInfoDataResult>
  <NewDataSet>
    <PROCESSDATA>
      <RESPONSETXT>SUCESS</RESPONSETXT>
      <RESPONSENBR>0</RESPONSENBR>
      <MESSAGE>Error en Ejecución de WS o Proceso Interno de SICASOnline --</MESSAGE>
    </PROCESSDATA>
  </NewDataSet>
</ReadInfoDataResult>
```

El sistema anterior **lanzaba excepción** (error 500) porque detectaba "Error" en MESSAGE, pero RESPONSETXT decía "SUCESS".

## Solución Implementada: Discriminated Union

### 1. Parser con Tipo Discriminado

```typescript
type ParseResult =
  | {
      kind: 'success';
      success: boolean;
      records: ParsedRecord[];
      stats: { totalRows: number; successfullyParsed: number; failed: number };
      errors: string[];
    }
  | {
      kind: 'not_available';
      success: false;
      message: string;
      responseTxt: string;
      responseNbr: string;
      status: 'not_available';
    };
```

### 2. Regla de Detección Precisa

```typescript
function isNotAvailableProcessData(data: any): boolean {
  const processData = data?.NewDataSet?.PROCESSDATA || data?.PROCESSDATA;
  if (!processData) return false;

  const responseTxt = String(processData?.RESPONSETXT ?? '').toUpperCase();
  const responseNbr = String(processData?.RESPONSENBR ?? '').trim();
  const message = String(processData?.MESSAGE ?? '');

  const hasInternalError = /Error en Ejecución|Proceso Interno|SICASOnline/i.test(message);

  // Regla precisa según documentación SICAS
  return responseTxt === 'SUCESS' && responseNbr === '0' && hasInternalError;
}
```

### 3. Edge Function con Pattern Matching

```typescript
const parseResult = parseSicasResponse(parsedSoapData, catalogType.name);

// Pattern matching con discriminated union
if (parseResult.kind === 'not_available') {
  // Retornar HTTP 200 con warning (no error 500)
  return new Response(
    JSON.stringify({
      success: true,
      catalog_status: 'not_available',
      warning: parseResult.message,
      stats: { totalRows: 0, inserted: 0, updated: 0, failed: 0 },
    }),
    { status: 200, headers: corsHeaders }
  );
}

// A partir de aquí, parseResult.kind === 'success'
// TypeScript sabe que parseResult.records existe
const records = parseResult.records;
```

## Beneficios de esta Arquitectura

### ✅ Type Safety
TypeScript **garantiza** que solo accedas a propiedades válidas según el `kind`:
- Si `kind === 'not_available'` → tienes `message`, `responseTxt`, `responseNbr`
- Si `kind === 'success'` → tienes `records`, `stats`, `errors`

### ✅ No Más Casting
**Antes**:
```typescript
const warning = (parseResult as any).warning; // ❌ Unsafe
```

**Ahora**:
```typescript
if (parseResult.kind === 'not_available') {
  const message = parseResult.message; // ✅ Type-safe
}
```

### ✅ Exhaustive Checking
Si en el futuro agregas un tercer estado (ej: `kind: 'denied'`), TypeScript te obliga a manejarlo:
```typescript
switch (parseResult.kind) {
  case 'success': /* ... */; break;
  case 'not_available': /* ... */; break;
  // Si faltas 'denied', TypeScript da error de compilación
}
```

## Sistema de Estados por Catálogo

```sql
ALTER TABLE sicas_sync_history
ADD COLUMN catalog_status text
  CHECK (catalog_status IN ('available', 'not_available', 'denied', 'error')),
ADD COLUMN response_nbr text,
ADD COLUMN xml_snippet text;
```

### Estados Posibles

| Estado | Significado | RESPONSENBR | RESPONSETXT |
|--------|------------|-------------|-------------|
| `available` | Catálogo sincronizado OK | > 0 | SUCESS |
| `not_available` | Sin permisos o no habilitado | 0 | SUCESS |
| `denied` | Autenticación denegada | N/A | DENIED |
| `error` | Timeout, conexión, o parse | N/A | N/A |

## Herramientas de Diagnóstico

### 1. Edge Function de Prueba
```bash
curl -X POST https://tu-proyecto.supabase.co/functions/v1/sicas-test-catalog \
  -H "Content-Type: application/json" \
  -d '{"catalog_id": 32}'
```

### 2. Página de Diagnóstico Visual
```
http://localhost:5173/test-sicas-catalogs-availability.html
```

Prueba automática de 12 catálogos en secuencia con UI color-coded.

## Catálogos Prioritarios a Probar

Según documentación SICAS (enum `eDatatoRead`):

| ID | Nombre | Uso | Status Actual |
|----|--------|-----|---------------|
| 10 | eOficias | **Plan B** para mapeo oficinas | ❓ Pendiente probar |
| 11 | eDespachos | Mapeo despachos ↔ oficinas | ❌ No disponible (RESPONSENBR=0) |
| 18 | ePromotorias | **Plan C** para mapeo operativo | ❓ Pendiente probar |
| 32 | eVendedores | **CRÍTICO** - Mapeo vendedores ↔ usuarios | ❓ Pendiente probar |
| 33 | eEjecutivos | Estructura organizacional | ❓ Pendiente probar |

## Plan de Acción

### Paso 1: Ejecutar Diagnóstico
```
http://localhost:5173/test-sicas-catalogs-availability.html
```
Esto te dirá **exactamente** qué catálogos tienes disponibles.

### Paso 2: Estrategia según Resultados

**Si eVendedores (ID: 32) está disponible**:
- ✅ Usarlo directamente para mapeo vendedores ↔ usuarios

**Si eDespachos (ID: 11) NO está disponible** (como ahora):
- 🔄 **Plan B**: Usar eOficias (ID: 10) para mapeo oficinas
- 🔄 **Plan C**: Usar ePromotorias (ID: 18) si representa tu estructura operativa

**Si ningún catálogo crítico está disponible**:
- 📞 Contactar soporte SICAS para solicitar habilitación
- 🔄 Implementar mapeo manual temporal en UI

### Paso 3: Validar en Producción

Una vez identificados los catálogos disponibles, validar:
1. ✅ Sincronización exitosa (HTTP 200 + `catalog_status: 'available'`)
2. ✅ Registros insertados en BD correctamente
3. ✅ Mapeos funcionando (vendedor SICAS → usuario sistema)

## Logs de Diagnóstico Mejorados

### Catálogo Disponible
```
[SICAS Parser] PROCESSDATA no detectado
[SICAS Parser] ✅ Array directo detectado
[SICAS Sync] Parser universal completado:
  - Total filas: 150
  - Parseadas exitosamente: 150
  - Fallidas: 0
[SICAS Sync] ✅ Sincronización completada:
  - Insertados: 120
  - Actualizados: 30
  - Fallidos: 0
```

### Catálogo No Disponible
```
[SICAS Parser] PROCESSDATA detectado
[SICAS Parser] ⚠️ Catálogo no disponible (RESPONSENBR=0)
[SICAS Sync] ⚠️ Catálogo no disponible (RESPONSENBR=0)
[SICAS Sync] MESSAGE: Error en Ejecución de WS o Proceso Interno de SICASOnline --
[SICAS Sync] RESPONSETXT: SUCESS
[SICAS Sync] RESPONSENBR: 0
```

### Autenticación Denegada
```
[SICAS Parser] ERROR tag encontrado: Autenticación denegada
[SICAS Sync] ❌ Error fatal: SICAS Error: Autenticación denegada
```

## Impacto

### ✅ Antes de esta solución
- ❌ Error 500 cuando catálogo no disponible
- ❌ No sabías qué catálogos tenías disponibles
- ❌ Imposible diferenciar entre error real y catálogo vacío
- ❌ Casting con `any` por todos lados

### ✅ Después de esta solución
- ✅ HTTP 200 con warning cuando catálogo no disponible
- ✅ Herramienta de diagnóstico para probar todos los catálogos
- ✅ Estados claros: available | not_available | denied | error
- ✅ Type safety completo con discriminated union
- ✅ Auditoría con `xml_snippet` para debugging
- ✅ Plan B/C documentados para catálogos críticos

## Archivos Modificados

1. **`supabase/functions/_shared/sicasParser.ts`**
   - Tipo discriminado `ParseResult`
   - Función `isNotAvailableProcessData()`
   - Detección de PROCESSDATA en parseo

2. **`supabase/functions/sicas-sync/index.ts`**
   - Pattern matching con `parseResult.kind`
   - HTTP 200 con warning para `not_available`
   - Guardado de `catalog_status`, `response_nbr`, `xml_snippet`

3. **`supabase/functions/sicas-test-catalog/index.ts`**
   - Edge function nueva para pruebas rápidas
   - Sin efectos secundarios en BD

4. **`supabase/migrations/add_catalog_status_to_sync_history.sql`**
   - Campos `catalog_status`, `response_nbr`, `xml_snippet`
   - Constraint para estados válidos

5. **`public/test-sicas-catalogs-availability.html`**
   - Herramienta de diagnóstico visual
   - Prueba automática de 12 catálogos

## Próximos Pasos

1. ✅ **Ejecutar diagnóstico** para saber qué catálogos tienes disponibles
2. ✅ **Implementar Plan B** si Despachos no está disponible (usar Oficinas)
3. ✅ **Validar eVendedores** (ID: 32) - el más crítico para tu sistema
4. 📞 **Contactar soporte SICAS** si catálogos críticos no están disponibles
5. 🔄 **Implementar mapeo manual** como fallback temporal si es necesario
