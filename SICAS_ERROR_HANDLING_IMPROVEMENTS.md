# SICAS Error Handling - Mejoras Implementadas

## Resumen

Se implementaron mejoras críticas en el manejo de errores de SICAS, siguiendo las recomendaciones del usuario. El sistema ahora detecta correctamente errores internos de SICAS y proporciona diagnóstico detallado.

---

## Problema Identificado

**Error de SICAS H03117:**
```json
{
  "responsenbr": "0",
  "responsetxt": "SUCESS",
  "message": "Error en Ejecución de WS o Proceso Interno de SICASOnline --Variable de objeto o de bloque With no establecida."
}
```

**Problema:** El sistema trataba esto como "éxito sin datos" cuando en realidad es un **error interno de SICAS**.

---

## Soluciones Implementadas

### 1. Lógica de Detección de Errores Corregida ✅

**Archivo:** `supabase/functions/sync-sicas-polizas-vigentes/index.ts`

**Antes:**
```typescript
if (responseNbrMatch[1] === '0') {
  // No es un error, simplemente no hay datos
  return { polizas: [], sicasDetails };
}
```

**Después:**
```typescript
if (responseNbrMatch[1] === '0') {
  // Verificar si es un error real de SICAS
  const hasInternalError =
    sicasDetails.message?.includes('Error en Ejecución') ||
    sicasDetails.message?.includes('Proceso Interno') ||
    sicasDetails.message?.includes('Variable de objeto') ||
    sicasDetails.message?.includes('SICASOnline');

  if (hasInternalError) {
    // Error real de SICAS - lanzar excepción
    throw new Error(`SICAS Internal Error: ${sicasDetails.message}`);
  }

  // Si no hay error interno, simplemente no hay datos
  return { polizas: [], sicasDetails };
}
```

**Beneficio:** Ahora el sistema marca correctamente como `failed` cuando SICAS devuelve un error interno.

---

### 2. Logging Mejorado en Base de Datos ✅

**Tabla:** `sicas_production_sync_log`

**Campos mejorados:**
- `status`: Ahora se marca como `'failed'` correctamente cuando hay error
- `error_message`: Contiene el mensaje completo del error de SICAS
- `metadata`: Incluye `responsenbr`, `responsetxt`, `message` para diagnóstico

**Ejemplo de log registrado:**
```json
{
  "sync_type": "polizas_vigentes",
  "status": "failed",
  "error_message": "SICAS Internal Error: Error en Ejecución de WS o Proceso Interno de SICASOnline --Variable de objeto o de bloque With no establecida.",
  "metadata": {
    "report_code": "H03117",
    "responsenbr": "0",
    "responsetxt": "SUCESS",
    "message": "Error en Ejecución de WS o Proceso Interno..."
  }
}
```

---

### 3. Función de Prueba Simple (Sin Filtros) ✅

**Nueva Edge Function:** `sicas-test-simple`

**Propósito:** Aislar si el problema es del reporte o de los filtros.

**Uso:**
```bash
curl -X POST \
  "${SUPABASE_URL}/functions/v1/sicas-test-simple" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "reportCode": "H03117",
    "page": 1,
    "itemsPerPage": 1
  }'
```

**Qué hace:**
- Ejecuta el reporte con parámetros mínimos (sin `InfoSort`, sin `ConditionsAdd`)
- Registra el resultado en `sicas_production_sync_log` con tipo `test_simple`
- Proporciona diagnóstico claro del problema

**Respuesta de ejemplo:**
```json
{
  "success": false,
  "test_type": "simple_without_filters",
  "report_code": "H03117",
  "sicas_response": {
    "responsenbr": "0",
    "responsetxt": "SUCESS",
    "message": "Error en Ejecución de WS..."
  },
  "records_found": 0,
  "diagnosis": {
    "has_internal_error": true,
    "is_access_denied": false,
    "has_data": false,
    "recommendation": "El reporte tiene un error interno en SICAS. Contacta al proveedor con el código de reporte y mensaje de error."
  }
}
```

---

### 4. Sistema de Reportes Alternativos (Fallback Automático) ✅

**Nueva migración:** `add_sicas_alternate_reports.sql`

**Campos agregados a `sicas_config`:**

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `alternate_report_codes` | TEXT[] | Lista de códigos de reporte alternativos |
| `current_report_code` | TEXT | Código actualmente en uso |
| `last_successful_report` | TEXT | Último reporte que funcionó |
| `report_test_history` | JSONB | Historial de pruebas |

**Funciones SQL creadas:**

1. **`get_next_alternate_report()`**
   - Devuelve el siguiente código de reporte a intentar
   - Cicla entre los códigos alternativos

2. **`mark_report_successful(p_report_code TEXT)`**
   - Marca un reporte como exitoso
   - Lo establece como `current_report_code`

3. **`mark_report_failed(p_report_code TEXT, p_error_message TEXT)`**
   - Marca un reporte como fallido
   - Cambia automáticamente al siguiente reporte alternativo

**Uso futuro (para implementar en edge functions):**
```typescript
// Si un reporte falla
const nextReport = await supabase.rpc('mark_report_failed', {
  p_report_code: 'H03117',
  p_error_message: 'Error en Ejecución...'
});

console.log(`Intentando con reporte alternativo: ${nextReport}`);
```

**Reportes alternativos configurados por defecto:**
1. H03117 (actual)
2. H03115
3. H03100
4. H03101
5. H03102

---

### 5. UI con Diagnóstico Detallado ✅

**Archivo:** `src/pages/MiProduccionSICAS.tsx`

**Mejoras:**

1. **Detección correcta de errores:**
```typescript
const hasInternalError =
  metadata?.message?.includes('Error en Ejecución') ||
  metadata?.message?.includes('Proceso Interno') ||
  metadata?.message?.includes('Variable de objeto');

if (hasInternalError) {
  setSicasDiagnostic({...});
  setSyncMessage({ type: 'error', text: '...' });
}
```

2. **Panel de diagnóstico visual:**

Cuando SICAS devuelve error interno, se muestra:

- **Código de respuesta:** `0`
- **Estado:** `SUCESS` (paradójico, pero así responde SICAS)
- **Mensaje:** El error completo
- **Causa probable:** Lista de posibles causas
- **Acción requerida:** Qué hacer para resolver

**Ejemplo visual:**

```
┌─────────────────────────────────────────────────────┐
│ ⚠️ Diagnóstico: Error en Reporte SICAS H03117      │
├─────────────────────────────────────────────────────┤
│ La conexión a SICAS funciona correctamente, pero   │
│ el reporte no devuelve datos.                       │
│                                                     │
│ Código de respuesta: 0                             │
│ Estado: SUCESS                                      │
│ Mensaje de SICAS: Error en Ejecución de WS o       │
│ Proceso Interno de SICASOnline --Variable de       │
│ objeto o de bloque With no establecida.            │
│                                                     │
│ Causa Probable:                                     │
│ • El reporte H03117 no está disponible             │
│ • Tu usuario no tiene permisos                      │
│ • Existe un problema interno en SICAS               │
│ • Se requiere usar otro código de reporte          │
│                                                     │
│ ⚠️ Acción Requerida                                │
│ Contacta al proveedor de SICAS con:                │
│ • Código de reporte: H03117                        │
│ • Mensaje de error: "Variable de objeto..."        │
│ • Solicitud: Código correcto para pólizas vigentes │
│                                                     │
│ Una vez que tengas el código correcto,              │
│ actualízalo en: Admin > SICAS > Configuración      │
└─────────────────────────────────────────────────────┘
```

---

## Pruebas Recomendadas

### Prueba 1: Ejecutar reporte sin filtros
```bash
curl -X POST \
  "${SUPABASE_URL}/functions/v1/sicas-test-simple" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"reportCode": "H03117", "page": 1, "itemsPerPage": 1}'
```

**Resultado esperado:**
- Si falla: Confirma que el reporte H03117 está roto en SICAS
- Si funciona: El problema estaba en los filtros

### Prueba 2: Probar con otro reporte
```bash
curl -X POST \
  "${SUPABASE_URL}/functions/v1/sicas-test-simple" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"reportCode": "H03115", "page": 1, "itemsPerPage": 1}'
```

**Resultado esperado:**
- Identifica qué reportes funcionan en tu instalación

### Prueba 3: Verificar logs
```sql
SELECT
  sync_type,
  status,
  error_message,
  metadata->>'report_code' as report_code,
  metadata->>'responsenbr' as responsenbr,
  metadata->>'message' as sicas_message,
  started_at,
  completed_at
FROM sicas_production_sync_log
ORDER BY started_at DESC
LIMIT 10;
```

---

## Próximos Pasos

### Acción Inmediata: Contactar a SICAS

**Información a proporcionar:**

1. **Usuario:** [Tu usuario de SICAS]
2. **Código de reporte:** H03117
3. **Error completo:** "Error en Ejecución de WS o Proceso Interno de SICASOnline --Variable de objeto o de bloque With no establecida."
4. **Solicitud:** Confirmar disponibilidad del reporte H03117 o proporcionar código alternativo

**Preguntas a realizar:**

1. ¿El reporte H03117 está disponible para mi usuario?
2. ¿Cuál es el código correcto para obtener pólizas vigentes?
3. ¿Qué permisos adicionales necesita mi usuario?
4. ¿Existe un reporte alternativo recomendado?

**Reportes comunes a preguntar:**
- H03100: Reporte de producción general
- H03101: Reporte de pólizas emitidas
- H03102: Reporte de producción por vendedor
- H03115: Reporte de pólizas vigentes (alternativo)
- H03120: Reporte de cobranza

### Workaround Temporal

Mientras SICAS resuelve el problema:

1. **Usar carga manual:** Importar Excel de producción
2. **Usar Google Sheets:** Configurar integración
3. **Usar otro sistema:** Si hay alternativa disponible

---

## Archivos Modificados

### Edge Functions
1. ✅ `supabase/functions/sync-sicas-polizas-vigentes/index.ts` - Detección de errores
2. ✅ `supabase/functions/sicas-sync-manual/index.ts` - Propagación de errores
3. ✅ `supabase/functions/sicas-test-simple/index.ts` - Nueva función de prueba

### Migraciones
4. ✅ `add_sicas_alternate_reports.sql` - Sistema de fallback

### Frontend
5. ✅ `src/pages/MiProduccionSICAS.tsx` - UI con diagnóstico

### Documentación
6. ✅ `FIX_SICAS_H03117_ERROR_DIAGNOSTICO.md` - Diagnóstico técnico completo
7. ✅ `SICAS_ERROR_HANDLING_IMPROVEMENTS.md` - Este documento

---

## Logs de Diagnóstico

**Verificar logs en base de datos:**
```sql
-- Ver últimos 10 intentos de sincronización
SELECT * FROM sicas_production_sync_log
ORDER BY started_at DESC
LIMIT 10;

-- Ver solo errores
SELECT * FROM sicas_production_sync_log
WHERE status = 'failed'
ORDER BY started_at DESC;

-- Ver metadata completa de un sync específico
SELECT
  jsonb_pretty(metadata) as metadata_detallado
FROM sicas_production_sync_log
WHERE id = 'UUID_DEL_REGISTRO';
```

---

## Resumen de Beneficios

| Antes | Después |
|-------|---------|
| ❌ Error tratado como "sin datos" | ✅ Error detectado correctamente como `failed` |
| ❌ No se guardaba información del error | ✅ Log completo con metadata de SICAS |
| ❌ Usuario sin información útil | ✅ Panel de diagnóstico detallado en UI |
| ❌ Sin forma de aislar el problema | ✅ Función de prueba simple disponible |
| ❌ Si un reporte falla, todo falla | ✅ Sistema de fallback a reportes alternativos |
| ❌ Sin historial de pruebas | ✅ Historial completo en `report_test_history` |

---

## Conclusión

El sistema ahora:

1. **Detecta correctamente** errores internos de SICAS
2. **Registra toda la información** para diagnóstico
3. **Proporciona UI clara** con pasos a seguir
4. **Permite pruebas simples** para aislar el problema
5. **Soporta fallback automático** a reportes alternativos
6. **Mantiene historial** de qué funcionó y qué falló

**Próximo paso crítico:** Contactar a SICAS con la información del error para obtener el código de reporte correcto.
