# Solución: Lotes vacíos al convertir batch

## Problema detectado

Al convertir un lote de importación:
1. La página se ponía en blanco
2. El modal se cerraba automáticamente
3. Los lotes de comisiones se creaban pero quedaban vacíos (0 items)

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

#### 1. Validación estricta antes de mostrar éxito
```typescript
// Verificar que tenemos batches y items
if (!result.createdBatches || result.createdBatches.length === 0) {
  throw new Error('NO_ITEMS_CONVERTED: No se crearon lotes.');
}

if (!result.totalInsertedItems || result.totalInsertedItems === 0) {
  throw new Error('NO_ITEMS_CONVERTED: No se insertaron documentos.');
}
```

#### 2. Render condicional robusto
```typescript
// Solo mostrar pantalla de éxito si HAY batches con items
if (conversionResult &&
    !converting &&
    conversionResult.createdBatches &&
    conversionResult.createdBatches.length > 0) {
  // Mostrar éxito
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

## Criterios de éxito

✅ No se crean lotes vacíos (se eliminan automáticamente)
✅ Errores muestran código real de DB, no UNKNOWN
✅ Se identifican filas problemáticas específicas
✅ Modal no se cierra en blanco, muestra error detallado
✅ Usuario puede reintentar después de corregir datos
✅ Logs detallados permiten debugging

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
