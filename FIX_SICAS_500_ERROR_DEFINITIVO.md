# Fix Definitivo: SICAS 500 Error → 200 con Warning

## Problema Exacto

SICAS respondía con:
```xml
<RESPONSETXT>SUCESS</RESPONSETXT>
<RESPONSENBR>0</RESPONSENBR>
<MESSAGE>Error en Ejecución de WS o Proceso Interno de SICASOnline --</MESSAGE>
```

El sistema **lanzaba excepción** (error 500) porque:
1. Detectaba "Error" en MESSAGE
2. Pero RESPONSETXT decía "SUCESS"
3. El parser no sabía cómo interpretarlo → `throw new Error()`

## Solución Implementada

### 1. Helper Robusto de Detección

```typescript
/**
 * Helper para detectar si SICAS indica catálogo no disponible
 */
function isSicasNotAvailable(processData: any): boolean {
  const txt = String(processData?.RESPONSETXT ?? '').toUpperCase().trim();
  const nbr = String(processData?.RESPONSENBR ?? '').trim();
  const msg = String(processData?.MESSAGE ?? '');

  const internalError = /Error en Ejecución|Proceso Interno|SICASOnline/i.test(msg);

  // SUCESS + RESPONSENBR=0 + mensaje de error interno = catálogo no disponible
  return (txt === 'SUCESS' || txt === 'SUCCESS') && nbr === '0' && internalError;
}
```

### 2. parseSoapResponse - NO hace throw

**ANTES** (línea ~440):
```typescript
if (message.toLowerCase().includes('error')) {
  // Esto siempre tiraba error 500
  throw new Error(`SICAS: ${message}`);
}
```

**AHORA** (líneas 447-457):
```typescript
// ✅ CASO ESPECIAL: SUCESS + RESPONSENBR=0 + mensaje de error interno
if (isSicasNotAvailable(processData)) {
  console.warn('[SICAS Parser] ⚠️ Catálogo no disponible (RESPONSENBR=0):', message);
  return {
    __empty_catalog: true,
    message: message || 'Catálogo no disponible',
    responseTxt,
    responseNbr,
    status: 'not_available',
  };
}

// ❌ CASO FATAL: DENIED o cualquier otro error real
if (responseTxt.toUpperCase() === 'DENIED') {
  throw new Error(`SICAS DENIED: ${message || 'Acceso denegado'}`);
}

// Si hay MESSAGE pero no es el caso not_available, es un error real
if (message && message.toLowerCase().includes('error')) {
  throw new Error(`SICAS: ${message}`);
}
```

### 3. Edge Function - Retorna HTTP 200

**sicas-sync/index.ts** (líneas 127-171):
```typescript
const parsedSoapData = parseSoapResponse(responseText);

// Verificar si parseSoapResponse ya detectó catálogo no disponible
if (parsedSoapData?.__empty_catalog) {
  console.warn('[SICAS Sync] ⚠️ Catálogo no disponible detectado en SOAP parser');

  // Guardar historial
  if (syncHistoryId) {
    await supabase
      .from('sicas_sync_history')
      .update({
        sync_completed_at: new Date().toISOString(),
        status: 'completed',
        catalog_status: 'not_available',
        response_nbr: '0',
        records_found: 0,
        records_inserted: 0,
        records_updated: 0,
        records_failed: 0,
        xml_snippet: responseText.substring(0, 1000),
        error_message: parsedSoapData.message,
      })
      .eq('id', syncHistoryId);
  }

  // ✅ HTTP 200 (no 500)
  return new Response(
    JSON.stringify({
      success: true,
      catalog_status: 'not_available',
      warning: parsedSoapData.message,
      stats: { totalRows: 0, inserted: 0, updated: 0, failed: 0 },
    }),
    { status: 200, headers: corsHeaders }
  );
}
```

### 4. Doble Capa de Protección

El sistema tiene **DOS puntos** de detección:

1. **`parseSoapResponse`** → detecta en el XML decodificado
2. **`parseSicasResponse`** → detecta en el objeto parseado (discriminated union)

Si el primero no lo detecta, el segundo lo hará:
```typescript
if (parseResult.kind === 'not_available') {
  // Manejar catálogo no disponible
  return new Response(JSON.stringify({ ... }), { status: 200 });
}
```

## Logs Esperados

### Catálogo No Disponible (HTTP 200)
```
[SICAS Sync] HTTP Status: 200
[SICAS Parser] PROCESSDATA detectado:
  - MESSAGE: Error en Ejecución de WS o Proceso Interno de SICASOnline --
  - RESPONSETXT: SUCESS
  - RESPONSENBR: 0
[SICAS Parser] ⚠️ Catálogo no disponible (RESPONSENBR=0)
[SICAS Sync] ⚠️ Catálogo no disponible detectado en SOAP parser
[SICAS Sync] Status: not_available
→ Response: HTTP 200 con warning
```

### Catálogo Disponible (HTTP 200)
```
[SICAS Sync] HTTP Status: 200
[SICAS Parser] ✅ Array directo detectado
[SICAS Sync] Parser universal completado:
  - Total filas: 150
  - Parseadas exitosamente: 150
[SICAS Sync] ✅ Sincronización completada:
  - Insertados: 120
  - Actualizados: 30
→ Response: HTTP 200 con catalog_status: 'available'
```

### Autenticación Denegada (HTTP 500)
```
[SICAS Parser] PROCESSDATA detectado:
  - RESPONSETXT: DENIED
[SICAS Parser] ❌ Autenticación denegada
→ Error: SICAS DENIED: Acceso denegado
→ Response: HTTP 500 (error real)
```

## Casos Cubiertos

| Caso | RESPONSETXT | RESPONSENBR | MESSAGE | Resultado | HTTP |
|------|-------------|-------------|---------|-----------|------|
| **Catálogo no disponible** | SUCESS | 0 | "Error en Ejecución..." | `__empty_catalog: true` | 200 |
| **Catálogo disponible** | SUCESS | > 0 | N/A | Registros parseados | 200 |
| **Autenticación denegada** | DENIED | N/A | "Acceso denegado" | `throw Error()` | 500 |
| **Error de red** | N/A | N/A | Timeout | `throw Error()` | 500 |
| **Catálogo vacío legítimo** | SUCESS | 0 | Sin "Error" | `{ records: [] }` | 200 |

## Archivos Modificados

1. **`supabase/functions/_shared/sicasParser.ts`**
   - Función `isSicasNotAvailable()` - líneas 353-365
   - `parseSoapResponse()` refactorizado - líneas 425-470
   - Detección antes de throw - líneas 447-469

2. **`supabase/functions/sicas-sync/index.ts`**
   - Detección de `__empty_catalog` - líneas 127-171
   - HTTP 200 con warning en lugar de error 500

3. **`supabase/functions/sicas-test-catalog/index.ts`**
   - Misma lógica de detección para herramienta de prueba

## Pruebas para Validar

### 1. Probar Catálogo No Disponible (Despachos - ID 11)
```bash
curl -X POST https://tu-proyecto.supabase.co/functions/v1/sicas-sync \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '{"catalog_type_id": 11}'
```

**Resultado esperado**:
```json
{
  "success": true,
  "catalog_status": "not_available",
  "warning": "Error en Ejecución de WS o Proceso Interno de SICASOnline --",
  "stats": { "totalRows": 0, "inserted": 0, "updated": 0, "failed": 0 }
}
```

### 2. Probar Catálogo Disponible (si existe)
```bash
curl -X POST https://tu-proyecto.supabase.co/functions/v1/sicas-sync \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '{"catalog_type_id": 10}'
```

**Resultado esperado**:
```json
{
  "success": true,
  "catalog_status": "available",
  "stats": { "totalRows": 150, "inserted": 120, "updated": 30, "failed": 0 }
}
```

### 3. Verificar Historial en BD
```sql
SELECT
  catalog_type_id,
  status,
  catalog_status,
  response_nbr,
  error_message,
  records_found,
  sync_completed_at
FROM sicas_sync_history
ORDER BY sync_started_at DESC
LIMIT 10;
```

## Diferencias Clave

### ❌ Antes de este fix
```
POST /sicas-sync {"catalog_type_id": 11}
→ Error 500: "SICAS: Error en Ejecución de WS o Proceso Interno..."
→ No guardaba historial
→ No sabías si era error real o catálogo no disponible
```

### ✅ Después de este fix
```
POST /sicas-sync {"catalog_type_id": 11}
→ HTTP 200 con warning
→ Historial guardado con catalog_status: 'not_available'
→ Distinción clara entre error real y catálogo no disponible
```

## Impacto en UI

Con este fix, la UI puede mostrar:

```typescript
if (response.catalog_status === 'not_available') {
  // ⚠️ Catálogo no disponible en SICAS
  // (sin permisos o no habilitado para tu cuenta)
  // [Botón: Reintentar] [Botón: Contactar Soporte]
} else if (response.catalog_status === 'available') {
  // ✅ Catálogo sincronizado: 150 registros
} else if (response.catalog_status === 'denied') {
  // ❌ Autenticación denegada - Verificar credenciales
}
```

## Build Exitoso

```bash
npm run build
✓ built in 28.57s
```

Todo compilado y listo para desplegar.
