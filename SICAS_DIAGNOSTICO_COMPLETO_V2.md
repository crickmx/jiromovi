# SICAS - Sistema de Diagnóstico Completo V2

## Cambios Críticos Implementados

Este documento detalla las mejoras críticas implementadas siguiendo las recomendaciones de diagnóstico profesional.

---

## 1. ✅ NUNCA `success: true` sin Evidencia de Dataset

### Problema Original
El sistema devolvía `success: true` cuando SICAS respondía con `RESPONSENBR=0` y mensaje de error, tratándolo como "sin datos" en lugar de error.

### Solución Implementada

**Reglas estrictas:**
```typescript
// REGLA CRÍTICA: Si el mensaje contiene "Error", es un error real, NO éxito
const hasInternalError =
  sicasDetails.message?.includes('Error en Ejecución') ||
  sicasDetails.message?.includes('Proceso Interno') ||
  sicasDetails.message?.includes('Variable de objeto') ||
  sicasDetails.message?.includes('SICASOnline') ||
  sicasDetails.message?.toLowerCase().includes('error');

if (hasInternalError) {
  throw new Error(`SICAS Internal Error: ${sicasDetails.message}`);
}

// Si RESPONSENBR=0 pero NO hay dataset real, es un error
if (!responseNbrMatch || responseNbrMatch[1] === '0') {
  if (!diagnostic.has_dataset) {
    throw new Error(`SICAS: No hay dataset disponible. Message: ${sicasDetails.message}`);
  }
}

// NUNCA devolver success: true sin datos reales
const hasRealData = allPolizas.length > 0;
const success = hasRealData && status === 'success';
```

**Status en base de datos:**
- `failed` - Error detectado o sin dataset
- `success` - Datos reales insertados
- `partial` - Algunos datos insertados con errores
- `no_data` - Sin datos pero sin error (caso válido)

---

## 2. ✅ Diagnóstico Completo en Metadata

### Información Guardada

Cada sync log ahora incluye:

```json
{
  "metadata": {
    "source": "SICAS Web Service",

    // Request (SIN credenciales)
    "request": {
      "report_code": "H03117",
      "page": 1,
      "items_per_page": 200,
      "info_sort": "DatDocumentos.FCaptura DESC"
    },

    // Respuesta de SICAS
    "sicas_response": {
      "responsenbr": "0",
      "responsetxt": "SUCESS",
      "message": "Error en Ejecución de WS o Proceso Interno..."
    },

    // Diagnóstico completo
    "diagnostic": {
      "raw_result_length": 1234,
      "has_dataset": false,
      "tables_found": ["PROCESSDATA"],
      "first_row_sample": {...},
      "raw_preview": "<PROCESSDATA>...</PROCESSDATA>"
    },

    "duration_ms": 2345
  }
}
```

### Campos de Diagnóstico

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `raw_result_length` | number | Longitud del XML completo |
| `has_dataset` | boolean | ¿Hay NewDataSet o tablas reales? |
| `tables_found` | string[] | Lista de todas las tablas encontradas |
| `first_row_sample` | object | Primera fila parseada (si existe) |
| `raw_preview` | string | Primeros 2000 caracteres del XML |

---

## 3. ✅ Request Info (Sin Credenciales)

Ahora se guarda toda la información del request para reproducir el error:

```json
{
  "request": {
    "report_code": "H03117",
    "page": 1,
    "items_per_page": 200,
    "info_sort": "DatDocumentos.FCaptura DESC",
    "conditions_add": null
  }
}
```

**Beneficios:**
- Reproducir exactamente el mismo request
- Identificar si el problema es del reporte o de los filtros
- Debug sin exponer credenciales

---

## 4. ✅ Detección de Dataset Real

El sistema ahora verifica múltiples indicadores de que hay datos reales:

```typescript
// Verificar si hay NewDataSet (indica que hay datos tabulares)
const hasNewDataSet = /<NewDataSet>/i.test(resultContent);
const hasDatDocumentos = /<DatDocumentos>/i.test(resultContent);

// Contar registros reales
const docMatches = resultContent.match(/<DatDocumentos>/g);
const recordCount = docMatches ? docMatches.length : 0;

const diagnostic = {
  has_dataset: hasNewDataSet || hasDatDocumentos || recordCount > 0,
  // ...
};
```

**Nunca asume dataset por:**
- HTTP 200 OK
- `RESPONSETXT=SUCESS`
- Ausencia de error HTTP

**Solo marca dataset si:**
- Existe `<NewDataSet>`
- Existe tabla `<DatDocumentos>`
- `recordCount > 0`

---

## 5. ✅ Detección de Todas las Tablas

El parser ahora detecta todas las tablas presentes en el XML:

```typescript
const tableRegex = /<(\w+)>[\s\S]*?<\/\1>/g;
const tablesFound = new Set<string>();
let tableMatch;
while ((tableMatch = tableRegex.exec(resultContent)) !== null) {
  const tableName = tableMatch[1];
  // Filtrar tags de metadata
  if (!['RESPONSENBR', 'RESPONSETXT', 'MESSAGE', 'PROCESSDATA'].includes(tableName)) {
    tablesFound.add(tableName);
  }
}
```

**Casos posibles:**

| Tablas Encontradas | Interpretación |
|-------------------|----------------|
| `[]` | Solo metadata, sin dataset |
| `['PROCESSDATA']` | Error interno de SICAS |
| `['NewDataSet', 'DatDocumentos']` | Dataset válido |
| `['OtraTabla']` | Reporte devuelve tabla diferente |

---

## 6. ✅ Logging de XML Crudo

Para diagnóstico completo, se guarda preview del XML:

```typescript
diagnostic: {
  raw_result_length: resultContent.length,
  raw_preview: resultContent.substring(0, 2000),
  // ...
}
```

**Uso:**
```sql
SELECT
  metadata->'diagnostic'->>'raw_preview' as xml_preview
FROM sicas_production_sync_log
WHERE id = 'uuid-del-sync';
```

Esto permite:
- Ver exactamente qué devolvió SICAS
- Identificar si es problema del parser o de SICAS
- Compartir con soporte de SICAS sin exponer credenciales

---

## 7. ✅ Función de Test Simple

Nueva edge function: `sicas-test-simple`

**Propósito:** Ejecutar reporte con parámetros mínimos para aislar el problema.

**Request:**
```json
{
  "reportCode": "H03117",
  "page": 1,
  "itemsPerPage": 1
}
```

**Response:**
```json
{
  "success": false,
  "test_type": "simple_without_filters",
  "report_code": "H03117",
  "sicas_response": {
    "responsenbr": "0",
    "responsetxt": "SUCESS",
    "message": "Error en Ejecución..."
  },
  "records_found": 0,
  "duration_ms": 1234,
  "diagnostic": {
    "raw_result_length": 456,
    "has_dataset": false,
    "tables_found": ["PROCESSDATA"],
    "has_internal_error": true,
    "is_access_denied": false,
    "has_data": false,
    "raw_preview": "..."
  },
  "request": {
    "report_code": "H03117",
    "page": 1,
    "items_per_page": 1
  },
  "recommendation": "El reporte tiene un error interno en SICAS..."
}
```

---

## Cómo Diagnosticar en 1 Minuto

### Query SQL para ver diagnóstico completo:

```sql
SELECT
  id,
  sync_type,
  status,
  error_message,
  records_fetched,

  -- Request
  metadata->'request'->>'report_code' as report_code,
  metadata->'request'->>'page' as page,
  metadata->'request'->>'items_per_page' as items_per_page,

  -- Respuesta SICAS
  metadata->'sicas_response'->>'responsenbr' as responsenbr,
  metadata->'sicas_response'->>'responsetxt' as responsetxt,
  metadata->'sicas_response'->>'message' as sicas_message,

  -- Diagnóstico
  (metadata->'diagnostic'->>'has_dataset')::boolean as has_dataset,
  metadata->'diagnostic'->>'tables_found' as tables_found,
  metadata->'diagnostic'->>'raw_result_length' as xml_length,

  started_at,
  completed_at
FROM sicas_production_sync_log
ORDER BY started_at DESC
LIMIT 10;
```

### Interpretación Rápida:

| Condición | Diagnóstico | Acción |
|-----------|-------------|--------|
| `has_dataset=false` + `message` con "Error" | Error interno de SICAS | Contactar proveedor con report_code y message |
| `has_dataset=false` + `tables_found=[]` | Sin datos y sin dataset | Verificar permisos o usar otro reporte |
| `has_dataset=true` + `records_fetched=0` | Dataset existe pero parser falla | Revisar `tables_found` - puede ser otra tabla |
| `responsenbr=0` + `has_dataset=false` | Reporte no disponible/configurado | Probar reportes alternativos |

---

## Verificación Rápida del Parser

### ¿Es problema de SICAS o del parser?

**1. Revisar el XML crudo:**
```sql
SELECT
  metadata->'diagnostic'->>'raw_preview' as xml_preview
FROM sicas_production_sync_log
WHERE status = 'failed'
ORDER BY started_at DESC
LIMIT 1;
```

**2. Buscar en el XML:**
- Si contiene `<MESSAGE>Error en Ejecución` → **Problema de SICAS**
- Si contiene `<NewDataSet>` → **Problema del parser**
- Si contiene solo `<PROCESSDATA>` → **Reporte no disponible**
- Si contiene tabla diferente a `DatDocumentos` → **Reporte devuelve otra estructura**

---

## Ejemplos de Metadata Guardada

### Caso 1: Error Interno de SICAS
```json
{
  "status": "failed",
  "error_message": "SICAS Internal Error: Error en Ejecución...",
  "metadata": {
    "request": {
      "report_code": "H03117",
      "page": 1,
      "items_per_page": 200
    },
    "sicas_response": {
      "responsenbr": "0",
      "responsetxt": "SUCESS",
      "message": "Error en Ejecución de WS o Proceso Interno de SICASOnline --Variable de objeto o de bloque With no establecida."
    },
    "diagnostic": {
      "raw_result_length": 456,
      "has_dataset": false,
      "tables_found": ["PROCESSDATA"],
      "raw_preview": "<PROCESSDATA><RESPONSENBR>0</RESPONSENBR>..."
    }
  }
}
```

### Caso 2: Éxito con Datos
```json
{
  "status": "success",
  "records_fetched": 150,
  "records_inserted": 150,
  "metadata": {
    "request": {
      "report_code": "H03117",
      "page": 1,
      "items_per_page": 200
    },
    "sicas_response": {
      "responsenbr": "150",
      "responsetxt": "SUCESS",
      "message": ""
    },
    "diagnostic": {
      "raw_result_length": 45000,
      "has_dataset": true,
      "tables_found": ["NewDataSet", "DatDocumentos"],
      "first_row_sample": {
        "id_documento": "DOC123",
        "no_poliza": "POL456",
        "vend_id": "V001"
      }
    }
  }
}
```

### Caso 3: Parser Falla (Tabla Diferente)
```json
{
  "status": "failed",
  "error_message": "No se obtuvieron registros de SICAS",
  "metadata": {
    "diagnostic": {
      "has_dataset": true,
      "tables_found": ["NewDataSet", "DatOtraTabla"],
      "raw_preview": "<NewDataSet><DatOtraTabla>..."
    }
  }
}
```
**Diagnóstico:** El reporte SÍ devuelve datos, pero en tabla `DatOtraTabla` en lugar de `DatDocumentos`. Hay que actualizar el parser.

---

## Archivos Modificados

### Edge Functions
1. ✅ `sync-sicas-polizas-vigentes/index.ts`
   - Detección de dataset real
   - Diagnóstico completo
   - Request info sin credenciales
   - Nunca success sin datos

2. ✅ `sicas-test-simple/index.ts`
   - Test sin filtros
   - Diagnóstico completo
   - Recomendaciones claras

3. ✅ `sicas-sync-manual/index.ts`
   - Propagación de errores correcta

### Frontend
4. ✅ `src/pages/MiProduccionSICAS.tsx`
   - Detección de errores internos
   - Mensajes claros al usuario

### Base de Datos
5. ✅ Migration: `add_sicas_alternate_reports.sql`
   - Sistema de fallback a reportes alternativos

---

## Próximos Pasos

### Acción Inmediata

**Ejecutar test simple:**
```bash
curl -X POST \
  "${SUPABASE_URL}/functions/v1/sicas-test-simple" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"reportCode": "H03117", "page": 1, "itemsPerPage": 1}'
```

**Revisar diagnóstico en base de datos:**
```sql
SELECT * FROM sicas_production_sync_log
WHERE sync_type = 'test_simple'
ORDER BY started_at DESC
LIMIT 1;
```

### Si el test falla

**Contactar a SICAS con:**
- Código de reporte: H03117
- Error completo: (del campo `error_message`)
- Request usado: (del campo `metadata.request`)
- XML preview: (del campo `metadata.diagnostic.raw_preview`)

**Preguntas:**
1. ¿El reporte H03117 está disponible para mi usuario?
2. ¿Cuál es el código correcto para pólizas vigentes?
3. ¿Qué reportes alternativos recomiendan?

### Probar reportes alternativos

```bash
# Probar H03115
curl -X POST ... -d '{"reportCode": "H03115", ...}'

# Probar H03100
curl -X POST ... -d '{"reportCode": "H03100", ...}'

# Probar H03120 (cobranza)
curl -X POST ... -d '{"reportCode": "H03120", ...}'
```

---

## Resumen de Mejoras

| Antes | Después |
|-------|---------|
| ❌ `success: true` con error | ✅ `success: false` si hay error o sin dataset |
| ❌ Solo `responsenbr` en metadata | ✅ Diagnóstico completo: request, response, diagnostic |
| ❌ No se guarda request | ✅ Request completo (sin credenciales) |
| ❌ No se detectan tablas | ✅ `tables_found` muestra todas las tablas |
| ❌ No se guarda XML | ✅ `raw_preview` con primeros 2000 caracteres |
| ❌ Asume dataset por HTTP 200 | ✅ Verifica dataset real en XML |
| ❌ Sin forma de aislar problema | ✅ Función `sicas-test-simple` para diagnóstico |
| ❌ Error tratado como "sin datos" | ✅ Error detectado y marcado como `failed` |

---

## Conclusión

El sistema ahora tiene **visibilidad completa** de qué está pasando con SICAS:

1. **Nunca miente** sobre el éxito (no más `success: true` falso)
2. **Guarda todo** lo necesario para diagnosticar (request, response, diagnostic)
3. **Detecta errores** correctamente (mensaje con "Error" = failed)
4. **Permite aislar** el problema (función de test simple)
5. **Da recomendaciones** claras basadas en el diagnóstico

Con esta información, puedes:
- Identificar en 1 minuto si el problema es de SICAS o del parser
- Proporcionar información precisa al proveedor de SICAS
- Probar reportes alternativos sin cambiar código
- Entender exactamente qué devuelve SICAS en cada caso
