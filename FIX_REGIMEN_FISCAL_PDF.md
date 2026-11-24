# Corrección: PDF mostrando régimen fiscal incorrecto

## Problema Detectado
Los PDFs de comisiones mostraban el régimen fiscal incorrecto (RESICO en lugar de HONORARIOS) para algunos usuarios.

## Causas Raíz Identificadas

### 1. **Nombres de regímenes con formato inconsistente**
- Los regímenes estaban guardados como "Honorarios", "Asimilados" (mayúscula inicial)
- Las funciones SQL comparaban con "HONORARIOS", "ASIMILADOS" (todo mayúsculas)
- Esto causaba que algunos usuarios se les asignara el régimen incorrecto

### 2. **PDF usando régimen desactualizado del batch**
- El PDF mostraba `batch.regimen_fiscal` (régimen al momento del cálculo)
- Si el usuario cambió su régimen después, el PDF seguía mostrando el anterior
- Los cálculos del batch pueden estar desactualizados respecto al régimen actual

### 3. **Falta de normalización en funciones de cálculo**
- No había normalización robusta en las funciones de cálculo fiscal
- No se manejaban variantes como "RESICO", "Simplificado de Confianza", etc.

## Soluciones Implementadas

### 1. **Estandarización de nombres de regímenes** ✅
**Archivo:** Migration `fix_fiscal_regime_names_uppercase.sql`

```sql
-- Actualizar todos los nombres a MAYÚSCULAS
UPDATE commission_fiscal_regimes
SET name = UPPER(name)
WHERE name != UPPER(name);

-- Asegurar que existan los tres regímenes principales
INSERT INTO commission_fiscal_regimes (name, ...) VALUES
  ('HONORARIOS', ...),
  ('RESICO', ...),
  ('ASIMILADOS', ...)
ON CONFLICT (name) DO UPDATE ...
```

### 2. **Normalización robusta en funciones de cálculo** ✅
**Archivo:** Migrations `fix_detail_trigger_normalize_regime.sql` y `fix_batch_aggregates_normalize_regime.sql`

Ambas funciones (`calculate_detail_fiscal_values` y `calculate_batch_fiscal_aggregates`) ahora:

```sql
-- Obtener y normalizar régimen fiscal
SELECT UPPER(TRIM(COALESCE(cfr.name, 'HONORARIOS')))
INTO v_regimen_fiscal
FROM usuarios u
LEFT JOIN commission_fiscal_regimes cfr ON cfr.id = u.regimen_fiscal_id
WHERE u.id = v_usuario_id;

-- Normalizar variantes comunes
IF v_regimen_fiscal LIKE '%RESICO%' OR v_regimen_fiscal LIKE '%SIMPLIFICADO%' THEN
  v_regimen_fiscal := 'RESICO';
ELSIF v_regimen_fiscal LIKE '%ASIMILAD%' THEN
  v_regimen_fiscal := 'ASIMILADOS';
ELSIF v_regimen_fiscal LIKE '%HONORARIO%' THEN
  v_regimen_fiscal := 'HONORARIOS';
END IF;
```

### 3. **PDF usando régimen ACTUAL del usuario** ✅
**Archivo:** `src/lib/pdfUtils.ts`

El PDF ahora:
1. **Consulta el régimen fiscal ACTUAL del usuario** (no el del batch)
2. **Detecta desajustes** entre el régimen del usuario y el régimen usado en el cálculo
3. **Muestra advertencia** si hay desajuste:

```typescript
// Obtener el régimen fiscal ACTUAL del usuario
const { data: usuarioData } = await supabase
  .from('usuarios')
  .select(`
    id,
    regimen_fiscal:commission_fiscal_regimes!regimen_fiscal_id(name)
  `)
  .eq('id', usuario_id)
  .single();

const regimenFiscalActual = usuarioData.regimen_fiscal?.name || 'HONORARIOS';

// Detectar desajuste
const hayDesajuste = batchData.regimen_fiscal &&
  regimenFiscalActual.toUpperCase() !== batchData.regimen_fiscal.toUpperCase();

// Mostrar advertencia en el PDF si hay desajuste
if (hayDesajuste) {
  doc.text(`ADVERTENCIA: Este lote fue calculado con régimen ${batchData.regimen_fiscal}.
            Recomendamos recalcular.`, ...);
}
```

### 4. **Función de recálculo masivo** ✅
**Archivo:** Migration `create_recalculate_all_batches_function.sql`

```sql
-- Recalcular todos los lotes de los últimos 30 días
SELECT * FROM recalculate_all_commission_batches();
```

Esta función:
- Recalcula todos los lotes con el régimen fiscal ACTUAL del usuario
- Retorna un reporte detallado de los cambios
- Útil después de corregir regímenes fiscales o actualizar fórmulas

### 5. **Logs detallados para diagnóstico** ✅
**Archivo:** `src/lib/pdfUtils.ts`

```typescript
console.log(`[PDF] Régimen ACTUAL del usuario: ${regimenFiscalActual}`);
console.log(`[PDF] Régimen guardado en el batch: ${batchData.regimen_fiscal}`);
if (hayDesajuste) {
  console.warn(`[PDF] ⚠️ DESAJUSTE DETECTADO: Usuario=${regimenFiscalActual},
                Batch=${batchData.regimen_fiscal}`);
}
```

## Scripts de Diagnóstico Creados

### 1. **verify_and_fix_regimes.sql**
Script SQL con queries para:
- Ver regímenes fiscales disponibles
- Ver usuarios y sus regímenes asignados
- Identificar lotes con desajuste entre usuario y batch
- Ver usuarios sin régimen fiscal asignado
- Comparar cálculos HONORARIOS vs RESICO
- Acciones para corregir (comentadas por seguridad)

### 2. **check_regime_mismatch.sql**
Script SQL adicional con diagnósticos detallados.

## Pasos para Verificar y Corregir

### 1. Verificar regímenes actuales
```sql
-- Ejecutar en Supabase SQL Editor
SELECT * FROM commission_fiscal_regimes ORDER BY name;
```

### 2. Identificar usuarios con problemas
```sql
-- Ver usuarios y sus regímenes
SELECT
  u.nombre,
  u.apellidos,
  u.email_laboral,
  cfr.name as regimen_fiscal
FROM usuarios u
LEFT JOIN commission_fiscal_regimes cfr ON cfr.id = u.regimen_fiscal_id
WHERE u.rol = 'Agente'
ORDER BY u.nombre;
```

### 3. Identificar lotes con desajuste
```sql
-- Ver lotes que necesitan recálculo
SELECT * FROM check_regime_mismatch.sql -- Query #3
```

### 4. Asignar régimen a usuarios sin régimen
```sql
-- Asignar HONORARIOS por defecto a usuarios sin régimen
UPDATE usuarios
SET regimen_fiscal_id = (
  SELECT id FROM commission_fiscal_regimes WHERE name = 'HONORARIOS'
)
WHERE regimen_fiscal_id IS NULL
  AND rol IN ('Agente', 'Gerente')
  AND deleted_at IS NULL;
```

### 5. Recalcular todos los lotes
```sql
-- EJECUTAR ESTO para recalcular todos los lotes con el régimen correcto
SELECT * FROM recalculate_all_commission_batches();
```

## Fórmulas Fiscales Correctas

### HONORARIOS (10% ISR)
```
Base: Commission Bruta (Sin Vida)
IVA = Base × 16%
Subtotal con IVA = Base + IVA
Ret ISR = (Base + IVA) × 10%
Ret IVA = IVA × 2/3 (66.67%)
Total Neto = Subtotal con IVA - Ret ISR - Ret IVA
```

### RESICO (1.25% ISR)
```
Base: Commission Bruta (Sin Vida)
IVA = Base × 16%
Subtotal con IVA = Base + IVA
Ret ISR = (Base + IVA) × 1.25%
Ret IVA = IVA × 2/3 (66.67%)
Total Neto = Subtotal con IVA - Ret ISR - Ret IVA
```

### ASIMILADOS (10% ISR, sin IVA)
```
Base: Commission Neta
Ret Contable (Vida) = Base Vida × 16%
Costo Dispersión (Daños) = Base Daños × 9%
ISR Vida = (Base Vida / 1.16) × 10%
ISR Daños = (Base Daños / 1.09) × 10%
Total Neto = Base - Ret Contable - Costo Dispersión - ISR Total
```

## Diferencias Clave entre HONORARIOS y RESICO

| Concepto | HONORARIOS | RESICO |
|----------|-----------|---------|
| **Ret ISR** | 10% | 1.25% |
| **Base ISR** | (Bruta + IVA) | (Bruta + IVA) |
| **Ret IVA** | 2/3 del IVA | 2/3 del IVA |
| **IVA** | 16% | 16% |
| **Total Neto** | Menor (más ISR) | Mayor (menos ISR) |

## Ejemplo Numérico

Para una comisión bruta de $10,000:

### HONORARIOS
```
Base:           $10,000.00
IVA (16%):      $ 1,600.00
Subtotal:       $11,600.00
Ret ISR (10%):  $ 1,160.00
Ret IVA (2/3):  $ 1,066.67
Total Neto:     $ 9,373.33
```

### RESICO
```
Base:           $10,000.00
IVA (16%):      $ 1,600.00
Subtotal:       $11,600.00
Ret ISR (1.25%):$   145.00
Ret IVA (2/3):  $ 1,066.67
Total Neto:     $10,388.33
```

**Diferencia:** $1,015.00 (RESICO paga más porque tiene menos ISR retenido)

## Conclusión

Las correcciones aseguran que:
1. ✅ Los nombres de regímenes están estandarizados (MAYÚSCULAS)
2. ✅ Las funciones normalizan correctamente el régimen fiscal
3. ✅ El PDF muestra el régimen ACTUAL del usuario, no el del batch
4. ✅ Se detectan y advierten desajustes entre usuario y batch
5. ✅ Existe una función para recalcular masivamente los lotes
6. ✅ Hay logs detallados para diagnóstico

**Próximo paso:** Ejecutar `recalculate_all_commission_batches()` para recalcular todos los lotes con el régimen correcto.
