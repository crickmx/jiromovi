# Solución: Lotes vacíos y página en blanco al convertir batch

## Problema detectado

Al convertir un lote de importación:
1. La página se ponía en blanco
2. El modal se cerraba automáticamente antes de mostrar resultados
3. Los lotes de comisiones se creaban pero quedaban vacíos (0 items)
4. No se podía ver la pantalla de éxito ni hacer clic en "Abrir lote"

## Causa raíz

El proceso de conversión tenía estas fallas:

### 1. Lotes vacíos no se eliminaban
- **Problema**: Se creaban `commission_batches` ANTES de insertar los `commission_details`
- **Impacto**: Si la inserción fallaba, el batch quedaba creado pero vacío
- **Solución**: Ahora si `insertedCount === 0`, el batch se elimina automáticamente

### 2. Errores no se reportaban correctamente
- **Problema**: Error mostrado como "UNKNOWN" sin detalles
- **Impacto**: Imposible diagnosticar qué fila causaba el error
- **Solución**: Sistema de captura de errores de PostgreSQL con códigos y constraints reales

### 3. Frontend no validaba respuestas
- **Problema**: El modal aceptaba respuestas con `createdBatches` vacío como éxito
- **Impacto**: Cerraba el modal sin mostrar error
- **Solución**: Validación estricta de respuesta antes de mostrar éxito

### 4. Modal se cerraba prematuramente
- **Problema**: `handleConvert` llamaba `onSuccess(result)` inmediatamente después de conversión exitosa
- **Impacto**: El componente padre ejecutaba `setShowConvertModal(false)` ANTES de renderizar pantalla de éxito
- **Flujo problemático**:
  1. Conversión exitosa → `setConversionResult(result)`
  2. Llamada inmediata → `onSuccess(result)`
  3. Padre ejecuta → `setShowConvertModal(false)`
  4. Modal se desmonta ANTES de renderizar pantalla de éxito
  5. Usuario ve página en blanco o navegación inesperada
- **Solución**: NO llamar `onSuccess` hasta que usuario cierre el modal manualmente

## Correcciones implementadas

### Backend: Edge Function

#### 1. Eliminación automática de lotes vacíos
```typescript
// Después de insertar items
if (insertResult.insertedCount === 0) {
  console.warn(`Eliminando lote porque no se insertaron items`);
  await supabase
    .from("commission_batches")
    .delete()
    .eq("id", commissionBatch.id);

  // Remover de lista de batches creados
  createdBatches.pop();
  createdBatchIds.pop();
}
```

#### 2. Validación final mejorada
```typescript
if (createdBatches.length === 0 || totalInsertedItems === 0) {
  // Guardar reporte detallado en conversion_jobs
  // Retornar error 400 con detalles
  return Response con:
    - code: "NO_ITEMS_CONVERTED"
    - message: explicación clara
    - details: {
        totalSourceItems,
        sample_errors (primeras 5 filas con error)
      }
}
```

#### 3. Logs detallados
- Resumen de conversión por semana
- Conteo de items insertados vs fallidos
- Sample de errores con póliza y vendedor

### Frontend: Modal de Conversión

#### 1. Flujo correcto de cierre de modal
```typescript
async function handleConvert() {
  // ... conversión exitosa ...

  // CRÍTICO: Establecer resultado PRIMERO, NO llamar onSuccess todavía
  setConversionResult(result);
  setConverting(false);

  // NO llamamos onSuccess aquí, se llamará cuando el usuario cierre el modal
}

function handleCloseSuccess() {
  // Llamar onSuccess ANTES de cerrar para actualizar la lista
  if (conversionResult) {
    onSuccess(conversionResult);
  }
  onClose();
}

function handleNavigateToBatch(batchId: string) {
  // Llamar onSuccess ANTES de navegar
  if (conversionResult) {
    onSuccess(conversionResult);
  }
  onClose();
  navigate(`/comisiones/lote/${batchId}`);
}
```

**Flujo corregido**:
1. Conversión exitosa → `setConversionResult(result)`
2. Modal renderiza pantalla de éxito
3. Usuario ve los lotes creados
4. Usuario hace clic en "Abrir lote" o "X"
5. Se llama `onSuccess(result)` → actualiza lista de batches
6. Se llama `onClose()` → cierra modal
7. Si fue "Abrir lote", navega a `/comisiones/lote/{id}`

#### 2. Validación estricta antes de mostrar éxito
```typescript
// Verificar que tenemos batches y items
if (!result.createdBatches || result.createdBatches.length === 0) {
  throw new Error('NO_ITEMS_CONVERTED: No se crearon lotes.');
}

if (!result.totalInsertedItems || result.totalInsertedItems === 0) {
  throw new Error('NO_ITEMS_CONVERTED: No se insertaron documentos.');
}
```

#### 3. Render condicional robusto
```typescript
// Validación completa antes de renderizar
const hasValidResult =
  conversionResult &&
  !converting &&
  Array.isArray(conversionResult.createdBatches) &&
  conversionResult.createdBatches.length > 0 &&
  typeof conversionResult.totalInsertedItems === 'number' &&
  conversionResult.totalInsertedItems > 0;

if (hasValidResult) {
  // Mostrar pantalla de éxito
}
```

#### 3. UI mejorada para errores
- Muestra código de error real (no UNKNOWN)
- Muestra constraint violado si aplica
- Muestra detalles técnicos de PostgreSQL
- Muestra ejemplos de filas con error (póliza, vendedor, mensaje)
- Botón "Reintentar" disponible

### Schema: Defaults seguros

```sql
-- date_fpago ahora nullable
ALTER TABLE commission_details
  ALTER COLUMN date_fpago DROP NOT NULL;

-- Defaults para campos numéricos
ALTER TABLE commission_details
  ALTER COLUMN prima_neta SET DEFAULT 0,
  ALTER COLUMN commission_bruta SET DEFAULT 0,
  ALTER COLUMN commission_neta SET DEFAULT 0,
  ALTER COLUMN importe_base SET DEFAULT 0,
  ALTER COLUMN porcentaje_comision SET DEFAULT 0;

-- Defaults para campos de texto
ALTER TABLE commission_details
  ALTER COLUMN ramo SET DEFAULT 'N/A',
  ALTER COLUMN aseguradora SET DEFAULT 'N/A',
  ALTER COLUMN poliza SET DEFAULT 'N/A';
```

## Cómo diagnosticar si vuelve a ocurrir

### 1. Ver logs del edge function
```bash
# En Supabase Dashboard > Edge Functions > convert-import-to-commission-batches
# Buscar:
[Conversion] Iniciando conversión de batch...
[Conversion] Creando lote para semana X con Y items
[Insert] Chunk failed: <error>
[Insert] Row N failed: <detalles>
[Conversion] Lote semana X creado con Y items (Z errores)
```

### 2. Consultar conversion_jobs
```sql
SELECT
  id,
  status,
  error_code,
  error_message,
  conversion_report
FROM conversion_jobs
WHERE batch_id = '<batch_id>'
ORDER BY started_at DESC
LIMIT 1;
```

El campo `conversion_report` contiene:
- `summary`: Resumen de items procesados
- `validation_errors`: Errores de pre-validación
- `insert_errors`: Errores de inserción con detalles de fila

### 3. Verificar commission_batches creados
```sql
-- Ver batches del import
SELECT
  cb.id,
  cb.name,
  cb.week_number,
  cb.status,
  COUNT(cd.id) as items_count
FROM commission_batches cb
LEFT JOIN commission_details cd ON cd.batch_id = cb.id
WHERE cb.source_id = '<import_batch_id>'
GROUP BY cb.id, cb.name, cb.week_number, cb.status;
```

**Resultado esperado**:
- Si items_count = 0, el batch debería haber sido eliminado
- Si items_count > 0, el batch es válido

### 4. Ver items pendientes de asignación
```sql
SELECT
  batch_id,
  COUNT(*) as pending_count,
  array_agg(DISTINCT vendor_name_raw) as vendors
FROM commission_details
WHERE pending_assignment = true
GROUP BY batch_id;
```

## Flujo correcto de conversión

```
1. Validar que imported_documents tiene items (sourceCount > 0)
2. Crear conversion_job (status: running)
3. Agrupar por semana usando FPago
4. Para cada semana:
   a. Crear commission_batch
   b. Normalizar items
   c. Pre-validar items
   d. Insertar en chunks de 200
   e. Si falla chunk, insertar 1 por 1 para identificar fila
   f. Si insertedCount = 0, ELIMINAR batch
   g. Si insertedCount > 0, mantener batch
5. Validar que createdBatches.length > 0
6. Validar que totalInsertedItems > 0
7. Marcar import batch como convertido
8. Actualizar conversion_job (status: success)
9. Retornar resultado al frontend
```

## Verificar en navegador

Abre la consola del navegador (F12) y busca estos logs:

### Conversión exitosa
```
[ConvertirLoteModal] Iniciando conversión...
[ConvertirLoteModal] Conversión exitosa: {success: true, createdBatches: [...], ...}
[ConvertirLoteModal] Batches creados: [{id: "...", display_name: "...", ...}]
[ConvertirLoteModal] Total items: 150
[ConvertirLoteModal] Estableciendo conversionResult...
[ConvertirLoteModal] Estado actualizado. Esperando a que usuario cierre modal.
[ConvertirLoteModal] Render - Estado actual: {hasValidResult: true, ...}
[ConvertirLoteModal] Mostrando pantalla de éxito
```

### Comportamiento esperado
1. Después de conversión exitosa, el modal NO se cierra
2. Se muestra pantalla verde "Conversión Completada"
3. Se listan los lotes creados con botón "Abrir lote"
4. Usuario puede hacer clic en "Abrir lote" o "X"
5. Solo entonces se cierra el modal y se actualiza la lista

### Conversión con errores
```
[ConvertirLoteModal] Iniciando conversión...
[ConvertirLoteModal] Error en conversión: NO_ITEMS_CONVERTED: No se pudieron insertar documentos...
```

Debe mostrar:
- Mensaje de error claro
- Detalles técnicos expandibles
- Botón "Reintentar" visible
- Modal NO se cierra automáticamente

## Criterios de éxito

✅ No se crean lotes vacíos (se eliminan automáticamente)
✅ Errores muestran código real de DB, no UNKNOWN
✅ Se identifican filas problemáticas específicas
✅ Modal NO se cierra automáticamente después de conversión
✅ Pantalla de éxito se muestra completamente antes de permitir cerrar
✅ Modal solo se cierra cuando usuario hace clic en "X" o "Abrir lote"
✅ Usuario puede reintentar después de corregir datos
✅ Logs detallados permiten debugging en consola

## Comandos útiles para verificar

```sql
-- Ver todos los conversion jobs del día
SELECT
  id,
  batch_id,
  status,
  total_source_items,
  total_inserted_items,
  error_code,
  error_message,
  started_at
FROM conversion_jobs
WHERE started_at::date = CURRENT_DATE
ORDER BY started_at DESC;

-- Ver batches sin items (NO DEBERÍAN EXISTIR)
SELECT
  cb.id,
  cb.name,
  cb.created_at,
  COUNT(cd.id) as items
FROM commission_batches cb
LEFT JOIN commission_details cd ON cd.batch_id = cb.id
GROUP BY cb.id, cb.name, cb.created_at
HAVING COUNT(cd.id) = 0;

-- Si encuentras batches sin items, eliminarlos:
DELETE FROM commission_batches
WHERE id IN (
  SELECT cb.id
  FROM commission_batches cb
  LEFT JOIN commission_details cd ON cd.batch_id = cb.id
  GROUP BY cb.id
  HAVING COUNT(cd.id) = 0
);
```

## Prevención futura

1. **Pre-validación**: Antes de convertir, validar datos en frontend
2. **Tests automáticos**: Agregar tests de integración para conversión
3. **Monitoring**: Alertas si se crean batches sin items
4. **Cleanup job**: Job automático que elimine batches huérfanos cada noche

---

## Resumen ejecutivo

### Problema
El modal de conversión se cerraba inmediatamente y los lotes quedaban vacíos.

### Causa raíz
1. Lotes se creaban ANTES de insertar items
2. Si inserción fallaba, lotes quedaban vacíos sin eliminarse
3. Modal llamaba `onSuccess()` inmediatamente, causando cierre antes de mostrar resultado

### Solución
1. **Backend**: Eliminar lotes automáticamente si `insertedCount === 0`
2. **Frontend**: NO llamar `onSuccess()` hasta que usuario cierre el modal manualmente
3. **Validación**: Verificar que `createdBatches.length > 0` Y `totalInsertedItems > 0`
4. **Logs**: Agregar logging exhaustivo para debugging

### Resultado
- Modal muestra pantalla de éxito completa
- Usuario ve lotes creados y puede hacer clic en "Abrir lote"
- No se crean lotes vacíos (se eliminan automáticamente)
- Errores se muestran con detalles completos
- Logs en consola permiten debugging inmediato

---

## Problema adicional: Lote se muestra vacío al abrirlo

### Síntoma
Después de hacer clic en "Abrir lote", la página muestra:
- Número correcto de pólizas en el contador
- Pero la tabla de pólizas está vacía
- No se muestran datos de agentes, ramos, etc.

### Posibles causas
1. **Datos no se insertaron**: `commission_details` está vacío
2. **JOINs fallando**: Los JOINs anidados no encuentran las foreign keys
3. **RLS bloqueando**: Las políticas no permiten leer los datos
4. **Error de renderizado**: El frontend tiene un problema al mostrar los datos

### Diagnóstico
Se agregó logging exhaustivo en `ComisionesLote.tsx`:

```typescript
[ComisionesLote] Cargando batch: {uuid}
[ComisionesLote] DIAGNÓSTICO - Conteo simple: {count: X}
[ComisionesLote] DIAGNÓSTICO - Query simple: {data: [...]}
[ComisionesLote] Details result: {data: [...], count: X}
```

**Ver documento `DEBUG_LOTE_VACIO.md` para guía completa de debugging.**

### Solución temporal
Se simplificaron los JOINs en el SELECT:
- Removido JOIN profundo a `usuario:usuario_id`
- Solo se hace JOIN a `agent`, `office` y `fiscal_regime`
- Esto previene que JOINs anidados fallen silenciosamente

### Verificación
1. Abre consola del navegador (F12)
2. Ve a un lote recién convertido
3. Revisa los logs de diagnóstico
4. Si `count: 0`, el problema está en backend (no se insertaron datos)
5. Si `count: X` pero `data: []`, el problema está en los JOINs o RLS
