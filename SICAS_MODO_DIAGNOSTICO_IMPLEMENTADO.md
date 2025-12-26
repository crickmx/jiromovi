# Sistema de Diagnóstico SICAS - Implementado

## Resumen

Sistema completo de diagnóstico para troubleshooting de la integración SICAS, con correcciones críticas al manejo del parámetro `TypeDataReturn` y detección mejorada de catálogos no disponibles.

---

## 🐛 Bugs Críticos Corregidos

### 1. **TypeDataReturn Incorrecto (Bug del protocolo SOAP)**

**Problema:**
```typescript
// ANTES (INCORRECTO)
<PropertyData_TypeDataReturn>2</PropertyData_TypeDataReturn>  // ❌ Pedía JSON pero esperaba XML
```

**Solución:**
```typescript
// AHORA (CORRECTO)
const typeReturn = Number(body?.typeReturn ?? 1);  // ✅ Default XML (1)
<PropertyData_TypeDataReturn>${typeReturn}</PropertyData_TypeDataReturn>
```

**Según documentación SICAS:**
- `0` = DataSet
- `1` = XML (recomendado)
- `2` = JSON

**Impacto:** Esto causaba que SICAS devolviera respuestas en formato incorrecto o fallara silenciosamente.

---

### 2. **Credenciales Duplicadas en SOAP (Violación del protocolo)**

**Problema:**
```xml
<!-- ANTES (INCORRECTO) -->
<wsReadData>
  <PropertyUserName>...</PropertyUserName>  ❌
  <PropertyPassword>...</PropertyPassword>  ❌
  <PropertyData_TypeDataReturn>2</PropertyData_TypeDataReturn>
  <PropertyTypeReadData>11</PropertyTypeReadData>
</wsReadData>
```

**Solución:**
```xml
<!-- AHORA (CORRECTO) -->
<wsReadData>
  <PropertyData_TypeDataReturn>${typeReturn}</PropertyData_TypeDataReturn>
  <PropertyTypeReadData>${catalog_type_id}</PropertyTypeReadData>
</wsReadData>
<wsAuthConfig>
  <UserName>${sicasUsername}</UserName>  ✅
  <Password>${sicasPassword}</Password>  ✅
</wsAuthConfig>
```

**Impacto:** Las credenciales deben ir SOLO en `wsAuthConfig`, no en `wsReadData`.

---

### 3. **Detección Mejorada de "Catálogo No Disponible"**

**Problema:** SICAS devuelve respuestas ambiguas cuando un catálogo no está disponible:

```xml
<RESPONSETXT>SUCESS</RESPONSETXT>  <!-- ⚠️ Dice SUCCESS pero... -->
<RESPONSENBR>0</RESPONSENBR>       <!-- ⚠️ 0 registros -->
<MESSAGE>Error en Ejecución. Proceso Interno WS:ReadInfoData</MESSAGE>  <!-- ⚠️ Mensaje de error -->
```

**Solución en `sicasParser.ts`:**
```typescript
function isSicasNotAvailable(processData: any): boolean {
  const txt = String(processData?.RESPONSETXT ?? '').toUpperCase().trim();
  const nbr = String(processData?.RESPONSENBR ?? '').trim();
  const msg = String(processData?.MESSAGE ?? '').trim();

  const hasErrorEjecucion = /Error en Ejecuci[oó]n/i.test(msg);
  const hasProcesoInterno = /Proceso Interno/i.test(msg);
  const hasSicasOnline = /SICASOnline/i.test(msg);

  // ✅ Caso especial: SUCESS + 0 registros + mensaje de error = catálogo no disponible
  if (txt === 'SUCESS' && nbr === '0' && (hasErrorEjecucion || hasProcesoInterno || hasSicasOnline)) {
    return true;
  }

  // Caso clásico
  return hasErrorEjecucion && (hasProcesoInterno || hasSicasOnline || hasWS);
}
```

**Resultado:** Ahora retorna `HTTP 200` con `catalog_status: "not_available"` en vez de `HTTP 500`.

---

## 🔧 Nuevas Funcionalidades

### Parámetros Agregados a `sicas-sync` Edge Function

```typescript
{
  "catalog_type_id": 12,           // Required (1-61)
  "typeReturn": 1,                 // Optional (0/1/2, default: 1)
  "dryRun": true,                  // Optional (default: false)
  "debug": true                    // Optional (default: false)
}
```

#### `typeReturn` (number)
- `0` = DataSet
- `1` = XML (default, recomendado)
- `2` = JSON

#### `dryRun` (boolean)
- `true` = Parsea pero NO guarda en BD
- `false` = Parsea y guarda (productivo)

#### `debug` (boolean)
- `true` = Incluye snippets de respuesta SOAP, HTTP status, body length, registros parseados
- `false` = Respuesta mínima

---

### Response Mejorado

```json
{
  "success": true,
  "catalog_type_id": 12,
  "catalog_name": "Compañías",
  "catalog_status": "available",
  "typeReturn": 1,
  "dryRun": true,
  "stats": {
    "totalRows": 45,
    "inserted": 0,
    "updated": 0,
    "failed": 0
  },
  "debug": {
    "soapHttpStatus": 200,
    "responseBodyLength": 15234,
    "preview": "<?xml version=\"1.0\"...",
    "parsedRecordsPreview": [
      { "id_sicas": "1", "nombre": "AXA", ... },
      { "id_sicas": "2", "nombre": "Qualitas", ... },
      { "id_sicas": "3", "nombre": "GNP", ... }
    ]
  }
}
```

---

## 🎨 UI Nueva: Tab "Diagnóstico" en SICAS Admin

### Ubicación
`/sicas-admin` → Tab "Diagnóstico"

### Funcionalidad

1. **Selector de ID Catálogo** (1-61)
   - Con hints de catálogos comunes:
     - `10` = Oficinas
     - `11` = Despachos
     - `12` = Compañías (típicamente disponible)
     - `13` = Agentes
     - `32` = Vendedores

2. **Selector TypeDataReturn** (0/1/2)
   - `0` = DataSet
   - `1` = XML (recomendado)
   - `2` = JSON

3. **Toggle Dry Run / Guardar**
   - Dry Run: Prueba sin contaminar BD
   - Guardar: Upsert en `sicas_catalogos`

4. **Botón "Probar Catálogo"**
   - Invoca `sicas-sync` con `debug: true`

5. **Vista de Resultados**
   - Estado del catálogo (available/not_available/denied/error)
   - Registros encontrados
   - HTTP status y response length
   - Preview del SOAP response (primeros 500 chars)
   - Registros parseados (primeros 3 en JSON)

---

## 📋 Protocolo de Pruebas Recomendado

### Paso 1: Probar Catálogos Base (con typeReturn=1)

Estos catálogos típicamente están disponibles para todos los tenants:

```bash
1. Catálogo 12 (Compañías)    → typeReturn=1, dryRun=true
2. Catálogo 13 (Agentes)      → typeReturn=1, dryRun=true
3. Catálogo 10 (Oficinas)     → typeReturn=1, dryRun=true
```

**Si 12/13 fallan:** Problema de credenciales o tenant.
**Si 12/13 funcionan:** Credenciales OK, continuar.

---

### Paso 2: Probar Catálogos Problemáticos

```bash
4. Catálogo 11 (Despachos)    → typeReturn=1, dryRun=true
5. Catálogo 32 (Vendedores)   → typeReturn=1, dryRun=true
```

**Si fallan con typeReturn=1:**
- Probar con `typeReturn=0` (DataSet)
- Probar con `typeReturn=2` (JSON)

---

### Paso 3: Documentar Resultados

Crear matriz de compatibilidad para tu tenant:

| Catálogo | ID | TypeReturn=0 | TypeReturn=1 | TypeReturn=2 | Notas |
|----------|----|--------------|--------------|--------------| ------|
| Compañías | 12 | ✅ | ✅ | ❌ | - |
| Agentes | 13 | ✅ | ✅ | ❌ | - |
| Despachos | 11 | ❌ | ✅ | ❌ | Solo con XML |
| Vendedores | 32 | ❌ | ❌ | ❌ | No disponible |

---

## 🎯 Casos de Uso Productivos

### 1. Troubleshooting Rápido
Cuando un catálogo falla en producción:
1. Ir a SICAS Admin → Diagnóstico
2. Probar el catálogo con `dryRun=true` y `debug=true`
3. Revisar el `debug.preview` para ver la respuesta cruda de SICAS
4. Determinar si es problema de formato, permisos o disponibilidad

### 2. Testing de Nuevos Catálogos
Antes de agregar un nuevo catálogo al sistema:
1. Probarlo con los 3 `typeReturn` (0/1/2)
2. Verificar que parsee correctamente con `debug.parsedRecordsPreview`
3. Si funciona, guardar con `dryRun=false`

### 3. Validación Post-Cambios SICAS
Cuando SICAS hace cambios en su WS:
1. Re-probar todos los catálogos críticos
2. Documentar cualquier cambio en formato o disponibilidad
3. Ajustar parsers si es necesario

---

## 🔍 Interpretación de Resultados

### `catalog_status: "available"`
✅ Catálogo funciona correctamente, datos parseados.

### `catalog_status: "not_available"`
⚠️ Catálogo temporalmente no disponible o no habilitado para tu tenant.
- Típicamente: "Error en Ejecución. Proceso Interno..."
- No es error fatal
- Puede estar en mantenimiento
- Puede requerir habilitación por parte de SICAS

### `catalog_status: "denied"`
❌ Acceso denegado por credenciales o permisos.
- Verificar credenciales en variables de entorno
- Contactar a SICAS para habilitar acceso

### `catalog_status: "error"`
❌ Error técnico (timeout, SOAP fault, etc.)
- Revisar `debug.preview` para detalles
- Puede ser problema de red o formato

---

## 🚀 Ventajas del Modo Diagnóstico

1. **No es código temporal**: Es infraestructura permanente para troubleshooting
2. **Dry Run**: Prueba sin riesgo de contaminar BD
3. **Debug detallado**: Snippets de SOAP response para análisis
4. **Parametrizable**: Soporta los 3 modos de TypeDataReturn
5. **A prueba de SICAS**: Maneja todas las inconsistencias conocidas
6. **Auto-documentado**: Los resultados se guardan en `sicas_sync_history`

---

## 📝 Archivos Modificados

### Edge Functions
- `supabase/functions/sicas-sync/index.ts`
  - Agregado parámetro `typeReturn` (default: 1)
  - Agregado parámetro `dryRun`
  - Agregado parámetro `debug`
  - Eliminadas credenciales de `wsReadData`
  - Mejorado response con campos `typeReturn`, `dryRun`, `debug`

### Shared Utils
- `supabase/functions/_shared/sicasParser.ts`
  - Mejorada función `isSicasNotAvailable()`
  - Detecta caso `RESPONSETXT=SUCESS + RESPONSENBR=0 + mensaje de error`

### Frontend
- `src/pages/SicasAdmin.tsx`
  - Agregado tab "Diagnóstico"
  - UI completa para probar catálogos con todos los parámetros
  - Vista detallada de resultados con debug info

---

## 🎓 Lecciones Aprendidas

1. **SICAS es inconsistente**: Misma respuesta puede significar cosas distintas según contexto
2. **TypeDataReturn importa**: No hardcodear, dejar parametrizable
3. **"SUCCESS" no siempre es éxito**: SICAS dice "SUCESS" (typo) incluso en errores
4. **RESPONSENBR=0 es ambiguo**: Puede ser "sin datos" o "error interno"
5. **Modo diagnóstico es esencial**: Sin esto, troubleshooting toma días

---

## ✅ Estado

- ✅ Edge function `sicas-sync` corregida y mejorada
- ✅ Parser mejorado para detectar catálogos no disponibles
- ✅ UI de diagnóstico implementada y funcional
- ✅ Build exitoso
- ✅ Documentación completa

**Listo para producción y troubleshooting.**
