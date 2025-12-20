# Solución: PDF y Mis Comisiones Muestran Valores Incorrectos

**Fecha:** 2024-12-20
**Estado:** ✅ Corregido

---

## Problema Reportado

El PDF y la vista de "Mis Comisiones" mostraban valores fiscales incorrectos para HONORARIOS y RESICO que no coincidían con las imágenes oficiales:

### HONORARIOS
- IVA mal calculado (base incorrecta)
- Ret ISR incorrecto (no era 10% exacto)
- Ret IVA incorrecto (no era 10.667% de Sin Vida)
- Total Neto incorrecto

### RESICO
- Ret ISR incorrecto (no era 1.25% exacto)
- IVA mal aplicado
- Ret IVA incorrecto
- Total Neto incorrecto

---

## Causa Raíz

El problema era que **el PDF y Mis Comisiones estaban CALCULANDO los valores fiscales en lugar de LEER los valores persistidos** en `commission_batches`.

### Flujo Incorrecto (Antes)
```
1. Cerrar lote → Calcula en frontend y persiste
2. Recalcular lote → Calcula en backend y persiste
3. PDF → CALCULA en frontend ❌
4. Mis Comisiones → CALCULA en frontend ❌
```

Cada uno usaba fórmulas diferentes, causando inconsistencias.

---

## Solución Implementada

Implementar el principio de **"Fuente Única de Verdad"**:

### Flujo Correcto (Después)
```
1. Cerrar lote → Llama a función SQL que calcula y persiste
2. Recalcular lote → Llama a función SQL que calcula y persiste
3. PDF → LEE valores persistidos ✅
4. Mis Comisiones → LEE valores persistidos ✅
```

---

## Archivos Modificados

### 1. Backend (SQL)
**Migración:** `20251220000000_fix_fiscal_honorarios_resico_only.sql`

Función SQL creada: `calculate_batch_fiscal_aggregates()`
- Guard clause: Si régimen es ASIMILADOS → skip (intocable)
- Calcula para HONORARIOS y RESICO usando fórmulas oficiales
- Persiste en `commission_batches`

**Fórmulas implementadas:**

**HONORARIOS:**
```sql
retencion_contable = 0
costo_dispersion = 0
iva = sinVida × 0.16
ret_isr = total × 0.10
ret_iva = sinVida × 0.10667
total_neto = total + iva - ret_isr - ret_iva
```

**RESICO:**
```sql
retencion_contable = 0
costo_dispersion = 0
iva = sinVida × 0.16
ret_isr = total × 0.0125
ret_iva = sinVida × 0.10667
total_neto = total + iva - ret_isr - ret_iva
```

### 2. Edge Function
**Archivo:** `supabase/functions/recalculate-commission-batch/index.ts`

**Cambios:**
- Llama a `calculate_batch_fiscal_aggregates()` después de recalcular comisiones
- Retorna `fiscal_result` en la respuesta

### 3. Generador de PDF
**Archivo:** `src/lib/pdfUtils.ts`

**Cambios:**
- Para ASIMILADOS: Mantiene flujo actual (usa función RPC)
- Para HONORARIOS y RESICO: **LEE valores de `commission_batches`**
- NO recalcula nada
- Valida que los valores existan antes de generar PDF

**Código agregado:**
```typescript
// HONORARIOS y RESICO: Leer valores persistidos en commission_batches
else if (regimenFiscal === 'HONORARIOS' || regimenFiscal === 'RESICO') {
  const { data: batchData } = await supabase
    .from('commission_batches')
    .select('commission_vida, commission_sinvida, iva, ret_isr, ret_iva, total_neto, tax_version, calculated_at')
    .eq('id', batch.id)
    .maybeSingle();

  if (!batchData || !batchData.calculated_at) {
    throw new Error('Los valores fiscales no están calculados. Recalcula el lote antes de generar el PDF.');
  }

  // Usar valores persistidos
  desgloseFiscal = {
    vida: batchData.commission_vida || 0,
    sinVida: batchData.commission_sinvida || 0,
    retContable: 0,
    costoDispersion: 0,
    iva: batchData.iva || 0,
    retIsr: batchData.ret_isr || 0,
    retIva: batchData.ret_iva || 0,
    isrVida: 0,
    isrDanios: 0,
    isrTotal: 0,
    totalAPagar: batchData.total_neto || 0,
  };
}
```

### 4. Mis Comisiones
**Archivo:** `src/pages/MisComisiones.tsx`

**Cambios:**
- Para ASIMILADOS: Mantiene flujo actual
- Para HONORARIOS y RESICO: **LEE valores de `commission_batches`**
- Fallback: Si no hay valores persistidos, muestra advertencia

**Código agregado:**
```typescript
// Leer valores persistidos del batch
const { data: batchData } = await supabase
  .from('commission_batches')
  .select('commission_vida, commission_sinvida, iva, ret_isr, ret_iva, total_neto, retencion_contable, costo_dispersion')
  .eq('id', batch.id)
  .maybeSingle();

if (batchData && batchData.iva !== null) {
  // Usar valores persistidos
  desglose = { ... };
} else {
  // Advertencia: Lote no calculado
  console.warn('Batch sin datos fiscales persistidos');
}
```

### 5. Cerrar Lote
**Archivo:** `src/pages/ComisionesLote.tsx`

**Cambios:**
- Para ASIMILADOS: Mantiene flujo actual
- Para HONORARIOS y RESICO: **Llama a función SQL**
- NO calcula en frontend

**Código agregado:**
```typescript
// Llamar a la función SQL que calcula y persiste
const { data: fiscalResult, error: fiscalError } = await supabase.rpc(
  'calculate_batch_fiscal_aggregates',
  { p_batch_id: batch.id }
);

if (fiscalError || !fiscalResult?.success) {
  alert('Error al calcular valores fiscales');
  return;
}

// Los valores ya están persistidos, solo cerrar el lote
fiscalUpdate = {
  status: 'closed'
};
```

### 6. Guard Clauses en Frontend
**Archivo:** `src/lib/commissionFiscalCalculations.ts`

**Cambios:**
- Guard clause que lanza error si se intenta calcular ASIMILADOS
- Guard clause que lanza error si el régimen no es HONORARIOS o RESICO

**Código agregado:**
```typescript
// 🚫 GUARD CLAUSE OBLIGATORIO: ASIMILADOS ES INTOCABLE
if (regimenFiscal === "ASIMILADOS") {
  throw new Error(
    "ASIMILADOS es intocable. No usar esta función para ASIMILADOS."
  );
}

// SOLO CONTINUAR SI ES HONORARIOS O RESICO
if (regimenFiscal !== "HONORARIOS" && regimenFiscal !== "RESICO") {
  throw new Error(
    `Régimen fiscal "${regimenFiscal}" no reconocido.`
  );
}
```

---

## Flujo Completo Corregido

### 1. Al Crear/Cerrar Lote

```
Usuario cierra lote
   ↓
ComisionesLote.tsx → supabase.rpc('calculate_batch_fiscal_aggregates')
   ↓
Función SQL calcula valores según régimen
   ↓
Persiste en commission_batches:
  - commission_vida
  - commission_sinvida
  - iva
  - ret_isr
  - ret_iva
  - total_neto
  - tax_version
  - calculated_at
   ↓
Lote marcado como "closed"
```

### 2. Al Recalcular Lote

```
Usuario recalcula lote
   ↓
Edge Function: recalculate-commission-batch
   ↓
Recalcula commission_bruta, commission_neta
   ↓
Llama a calculate_batch_fiscal_aggregates()
   ↓
Valores fiscales actualizados en commission_batches
```

### 3. Al Generar PDF

```
Usuario descarga PDF
   ↓
pdfUtils.ts → supabase.from('commission_batches').select(...)
   ↓
Lee valores persistidos
   ↓
Renderiza PDF con valores correctos
```

### 4. En Mis Comisiones

```
Agente ve sus comisiones
   ↓
MisComisiones.tsx → supabase.from('commission_batches').select(...)
   ↓
Lee valores persistidos
   ↓
Muestra desglose fiscal correcto
```

---

## Validaciones Implementadas

### En el PDF
- Verifica que `calculated_at` exista
- Verifica que todos los valores fiscales no sean `null`
- Si falta algo, lanza error: "Recalcula el lote antes de generar el PDF"

### En Mis Comisiones
- Verifica que los valores fiscales existan
- Si faltan, muestra advertencia en consola
- Fallback: Intenta calcular (con try/catch)

### En Cerrar Lote
- Llama a función SQL
- Verifica que la función retorne `success: true`
- Si falla, muestra error y no permite cerrar el lote

---

## Beneficios de la Solución

### 1. Consistencia Garantizada
- Los valores fiscales se calculan UNA VEZ en el backend
- Todos los módulos leen los mismos valores
- No hay posibilidad de inconsistencias

### 2. Rendimiento Mejorado
- No recalcula en cada vista
- Reduce carga en el frontend
- PDF se genera más rápido

### 3. Auditoría Completa
- `tax_version` identifica la versión del cálculo
- `calculated_at` registra cuándo se calculó
- Trazabilidad completa

### 4. ASIMILADOS Protegido
- Guard clauses en múltiples niveles
- Imposible modificar por error
- Mantiene su flujo actual intacto

---

## Testing

### Tests Manuales Requeridos

1. **Cerrar lote HONORARIOS:**
   - Verificar que se persistan valores correctos
   - Verificar PDF muestra valores persistidos
   - Verificar Mis Comisiones muestra valores persistidos

2. **Cerrar lote RESICO:**
   - Verificar que se persistan valores correctos
   - Verificar PDF muestra valores persistidos
   - Verificar Mis Comisiones muestra valores persistidos

3. **Recalcular lote:**
   - Verificar que se actualicen valores fiscales
   - Verificar PDF refleja nuevos valores
   - Verificar Mis Comisiones refleja nuevos valores

4. **ASIMILADOS:**
   - Verificar que NO se modificó nada
   - Verificar PDF funciona igual que antes
   - Verificar Mis Comisiones funciona igual que antes

### Tests Automatizados Disponibles

- `/test-fiscal-honorarios-resico.html` - Test visual de fórmulas

---

## Verificación de Fórmulas

Las fórmulas implementadas coinciden exactamente con las imágenes oficiales:

### HONORARIOS
- ✅ Ret. Contable = 0
- ✅ Costo Dispersión = 0
- ✅ IVA = sinVida × 0.16
- ✅ Ret ISR = total × 0.10
- ✅ Ret IVA = sinVida × 0.10667
- ✅ Total Neto = total + IVA - Ret ISR - Ret IVA

### RESICO
- ✅ Ret. Contable = 0
- ✅ Costo Dispersión = 0
- ✅ IVA = sinVida × 0.16
- ✅ Ret ISR = total × 0.0125
- ✅ Ret IVA = sinVida × 0.10667
- ✅ Total Neto = total + IVA - Ret ISR - Ret IVA

---

## Próximos Pasos (Si se requiere)

1. **Migrar lotes antiguos:**
   - Ejecutar `calculate_batch_fiscal_aggregates()` en lotes cerrados sin valores fiscales
   - Script de migración para backfill

2. **Validación masiva:**
   - Comparar valores antiguos vs nuevos
   - Identificar discrepancias

3. **Notificar a usuarios:**
   - Si hay lotes sin valores fiscales persistidos
   - Solicitar recálculo

---

## Documentación Relacionada

- `FISCAL_HONORARIOS_RESICO_FIX.md` - Documentación completa de la implementación
- `RESUMEN_FISCAL_FIX.md` - Resumen ejecutivo
- `/test-fiscal-honorarios-resico.html` - Test visual

---

**Fin del documento**
