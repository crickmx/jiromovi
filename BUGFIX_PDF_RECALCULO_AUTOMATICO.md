# Bug Fix: Error al Generar PDF por Valores Fiscales Faltantes

## Problema Reportado

**Error mostrado:**
```
Error al generar el PDF: Los valores fiscales no están calculados para este lote.

Campos faltantes: calculated_at

Solución: El sistema recalculará automáticamente. Si el problema persiste, contacta al administrador.
```

**Contexto:**
El usuario intentó descargar el PDF de un lote de comisiones desde la vista "Mis Comisiones" pero el lote no tenía valores fiscales calculados (`calculated_at` era nulo).

---

## Causa Raíz

El código en `MisComisiones.tsx` tenía una lógica de recálculo automático **incompleta**:

1. ✅ Detectaba que faltaban valores fiscales
2. ✅ Llamaba a la función SQL para recalcular
3. ✅ Recargaba los datos en memoria
4. ❌ **PERO** generaba el PDF con el objeto `batch` **ANTIGUO** (antes del recálculo)

El objeto `batch` era una referencia al estado local que **no se actualizaba** después del recálculo, por lo que el PDF intentaba leer valores nulos y fallaba con el error reportado.

---

## Solución Implementada

### Cambios en `src/pages/MisComisiones.tsx`

**Antes:**
```typescript
if (!batchCheck?.calculated_at || ...) {
  await supabase.rpc('calculate_batch_fiscal_aggregates', { p_batch_id });
  await loadCommissions(); // Recarga estado local
}

// Genera PDF con batch ANTIGUO (sin valores)
const pdfBlob = await generateOrdenDePagoPDF(details, batch);
```

**Después:**
```typescript
if (!batchCheck?.calculated_at || ...) {
  // 1. Recalcular y capturar resultado
  const { data: recalcResult, error } = await supabase.rpc(
    'calculate_batch_fiscal_aggregates',
    { p_batch_id }
  );

  // 2. Verificar que el recálculo fue exitoso
  if (recalcResult?.skipped || !recalcResult?.success) {
    alert('Mensaje de error apropiado');
    return;
  }

  // 3. Recargar el batch ACTUALIZADO de la BD
  const { data: updatedBatch } = await supabase
    .from('commission_batches')
    .select('*')
    .eq('id', batch.id)
    .single();

  // 4. Generar PDF con batch ACTUALIZADO
  const pdfBlob = await generateOrdenDePagoPDF(details, updatedBatch);

  // 5. Recargar vista completa
  await loadCommissions();

  return; // Salir para no generar PDF dos veces
}

// Si ya tenía valores, generar con batch original
const pdfBlob = await generateOrdenDePagoPDF(details, batch);
```

---

## Mejoras Adicionales

### 1. Validación Robusta del Resultado de Recálculo

Ahora se valida explícitamente el resultado de la función SQL:

```typescript
// Verificar si fue omitido (ASIMILADOS)
if (recalcResult?.skipped) {
  alert('No se puede generar el PDF automáticamente.\n\n' +
        'Motivo: ' + recalcResult.reason + '\n\n' +
        'Por favor, contacta al administrador...');
  return;
}

// Verificar si hubo error
if (!recalcResult?.success) {
  alert('Error al recalcular valores fiscales.\n\n' +
        (recalcResult?.error || 'Error desconocido'));
  return;
}
```

### 2. Recarga del Batch desde BD

Se agregó una consulta explícita para recargar el batch con valores actualizados:

```typescript
const { data: updatedBatch, error: reloadError } = await supabase
  .from('commission_batches')
  .select('*')
  .eq('id', batch.id)
  .single();

if (reloadError || !updatedBatch) {
  alert('Error al recargar datos del lote.\n\nIntenta de nuevo.');
  return;
}

// Usar updatedBatch para generar PDF
const pdfBlob = await generateOrdenDePagoPDF(details, updatedBatch);
```

### 3. Mensajes de Error Mejorados

Ahora los mensajes son más específicos y claros:

- **Error de recálculo:** Muestra el mensaje específico del error SQL
- **Lote omitido (ASIMILADOS):** Explica por qué no se pudo recalcular
- **Error de recarga:** Pide reintentar

---

## Flujo Corregido

```
┌─────────────────────────────────────────┐
│ Usuario: Click "Descargar PDF"          │
└───────────────┬─────────────────────────┘
                │
                v
┌─────────────────────────────────────────┐
│ Verificar: ¿Tiene valores fiscales?     │
└───┬─────────────────────────────────┬───┘
    │ SÍ                              │ NO
    v                                 v
┌───────────────────┐     ┌──────────────────────────────┐
│ Generar PDF       │     │ Recalcular valores fiscales   │
│ con batch actual  │     └────────────┬─────────────────┘
└───────────────────┘                  │
                                       v
                           ┌──────────────────────────────┐
                           │ ¿Recálculo exitoso?           │
                           └─┬──────────────────────────┬─┘
                             │ SÍ                       │ NO
                             v                          v
                   ┌──────────────────────┐    ┌────────────────┐
                   │ Recargar batch de BD │    │ Mostrar error  │
                   └──────────┬───────────┘    │ y cancelar     │
                              v                └────────────────┘
                   ┌──────────────────────┐
                   │ Generar PDF con      │
                   │ batch ACTUALIZADO    │
                   └──────────┬───────────┘
                              v
                   ┌──────────────────────┐
                   │ Recargar vista       │
                   └──────────────────────┘
```

---

## Escenarios Cubiertos

### ✅ Escenario 1: Lote HONORARIOS/RESICO sin Valores
1. Usuario descarga PDF
2. Sistema detecta valores faltantes
3. Recalcula automáticamente
4. Recarga batch actualizado
5. Genera PDF con valores correctos
6. Muestra PDF al usuario

### ✅ Escenario 2: Lote ASIMILADOS sin Valores
1. Usuario descarga PDF
2. Sistema detecta valores faltantes
3. Intenta recalcular
4. Función SQL retorna `skipped: true` (guard clause)
5. Muestra mensaje específico: "Este lote requiere recálculo manual"
6. Usuario contacta a administrador

### ✅ Escenario 3: Error de Base de Datos
1. Usuario descarga PDF
2. Sistema intenta recalcular
3. Función SQL retorna error
4. Muestra mensaje con detalles del error
5. Usuario puede reintentar o contactar soporte

### ✅ Escenario 4: Lote con Valores ya Calculados
1. Usuario descarga PDF
2. Sistema detecta valores existentes
3. Genera PDF directamente (flujo normal)
4. Muestra PDF al usuario

---

## Testing

### Manual Test 1: Lote Sin Valores (HONORARIOS)
```
1. Como admin, crear un lote de prueba
2. NO cerrar el lote (para que no tenga valores fiscales)
3. Como agente, ir a Mis Comisiones
4. Intentar descargar PDF del lote
5. Verificar que:
   - Sistema muestra "Generando..." (sin error inmediato)
   - Recalcula automáticamente
   - Genera y descarga el PDF exitosamente
   - PDF muestra todos los valores fiscales correctos
```

### Manual Test 2: Verificar Consola
```
Abrir DevTools → Console
Buscar logs:
  [MisComisiones] PDF: Valores fiscales faltantes, recalculando...
  [MisComisiones] PDF: Recálculo exitoso: { success: true, ... }
```

### Manual Test 3: Lote con Valores
```
1. Como admin, crear y cerrar un lote normalmente
2. Como agente, descargar PDF
3. Verificar que:
   - PDF se genera inmediatamente (sin recálculo)
   - No aparecen logs de recálculo en consola
```

---

## Archivos Modificados

### `src/pages/MisComisiones.tsx`
- **Función:** `handleDownloadPDF()`
- **Líneas:** 272-326
- **Cambios:**
  - Capturar resultado de recálculo
  - Validar resultado antes de continuar
  - Recargar batch actualizado de BD
  - Generar PDF con batch actualizado
  - Mensajes de error específicos

---

## Validación del Build

```bash
npm run build
# ✓ built in 21.25s (sin errores)
```

---

## Impacto

**Severidad:** ALTA
**Prioridad:** CRÍTICA
**Usuarios Afectados:** Todos los agentes que descargan PDFs de lotes sin valores fiscales

**Antes del Fix:**
- ❌ PDF fallaba con error confuso
- ❌ Usuario debía contactar a admin manualmente
- ❌ Admin debía recalcular y cerrar lote
- ❌ Usuario debía reintentar descarga

**Después del Fix:**
- ✅ PDF se genera automáticamente
- ✅ Transparente para el usuario
- ✅ Sin intervención de admin necesaria
- ✅ Mensajes claros en caso de error real

---

## Recomendaciones

### Para Prevenir Este Bug

1. **Siempre cerrar lotes antes de que agentes los vean:**
   - Implementar validación en backend
   - Solo mostrar lotes con `status = 'closed'` en Mis Comisiones

2. **Agregar indicador visual en UI:**
   - Mostrar badge "Sin calcular" si `calculated_at` es null
   - Deshabilitar botón PDF hasta que esté calculado

3. **Automatizar cálculo al cerrar lote:**
   - Ya está implementado en `ComisionesLote.tsx`
   - Verificar que siempre se ejecuta

### Para Monitorear

```sql
-- Verificar lotes cerrados sin valores fiscales
SELECT
  id,
  name,
  status,
  regimen_fiscal,
  calculated_at,
  iva,
  ret_isr,
  ret_iva,
  total_neto
FROM commission_batches
WHERE status = 'closed'
  AND (calculated_at IS NULL OR iva IS NULL);

-- Deberían ser 0 filas
```

---

## Conclusión

El bug ha sido corregido completamente. El sistema ahora:

✅ Recalcula automáticamente valores fiscales si faltan
✅ Usa valores actualizados para generar PDFs
✅ Maneja errores gracefully
✅ Proporciona feedback claro al usuario
✅ No requiere intervención manual en casos normales

La experiencia del usuario al descargar PDFs es ahora completamente fluida y transparente.
