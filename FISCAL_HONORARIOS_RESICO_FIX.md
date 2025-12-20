# Corrección Fiscal: HONORARIOS y RESICO

**Fecha:** 2024-12-20
**Versión Fiscal:** HONORARIOS_IMAGEN_OFICIAL_V1 / RESICO_IMAGEN_OFICIAL_V1
**Estado:** ✅ Implementado

---

## 🚫 REGLA ABSOLUTA DE ALCANCE

**ASIMILADOS ES INTOCABLE**

- NO se modificó ningún cálculo de ASIMILADOS
- NO se modificó ningún PDF de ASIMILADOS
- NO se modificó ningún redondeo de ASIMILADOS
- Guard clauses protegen contra modificaciones accidentales

---

## Módulos Afectados

✅ **Backend:**
- Edge Function: `recalculate-commission-batch`
- Función SQL: `calculate_batch_fiscal_aggregates()`
- Tabla: `commission_batches` (campos fiscales)

✅ **Frontend:**
- Archivo: `src/lib/commissionFiscalCalculations.ts` (guard clauses)

✅ **Flujo:**
1. Recalcular lote → Llama a función SQL
2. Cerrar lote → Llama a función SQL
3. PDF → Lee valores del lote
4. Mis Comisiones → Lee valores del lote

---

## Base Común (HONORARIOS y RESICO)

### Comisión por Póliza

```
comision_poliza = Importe × (PorPart / 100)
```

**Nota:** `PrimaNeta` es 100% informativa. NO se usa en cálculos fiscales.

### Totales

```
vida = suma(comision_poliza donde ramo == "Vida")
sinVida = suma(comision_poliza donde ramo != "Vida")
total = vida + sinVida
```

---

## Régimen: HONORARIOS

### Conceptos que Aplican

- ❌ Ret. Contable = 0
- ❌ Costo Dispersión = 0
- ✅ IVA
- ✅ Ret ISR (10%)
- ✅ Ret IVA

### Fórmulas EXACTAS

```sql
retencion_contable = 0
costo_dispersion = 0

iva = sinVida × 0.16
ret_isr = total × 0.10
ret_iva = sinVida × 0.10667

total_neto = total + iva - ret_isr - ret_iva
```

### Redondeo

- Calcular con precisión completa
- Redondear a 2 decimales SOLO los valores finales:
  - `iva`
  - `ret_isr`
  - `ret_iva`
  - `total_neto`

### Ejemplo Numérico

**Entrada:**
- Comisión Vida: $5,000.00
- Comisión Sin Vida: $15,000.00
- Total: $20,000.00

**Cálculo:**
```
Ret. Contable = $0.00
Costo Dispersión = $0.00
IVA = $15,000.00 × 0.16 = $2,400.00
Ret ISR = $20,000.00 × 0.10 = $2,000.00
Ret IVA = $15,000.00 × 0.10667 = $1,600.05

Total Neto = $20,000.00 + $2,400.00 - $2,000.00 - $1,600.05 = $18,799.95
```

---

## Régimen: RESICO

⚠️ **RESICO NO ES IGUAL A HONORARIOS**

La diferencia crítica está en **Ret ISR: 1.25%** (vs 10% en HONORARIOS)

### Conceptos que Aplican

- ❌ Ret. Contable = 0
- ❌ Costo Dispersión = 0
- ✅ IVA
- ✅ Ret ISR (1.25%)
- ✅ Ret IVA

### Fórmulas EXACTAS

```sql
retencion_contable = 0
costo_dispersion = 0

iva = sinVida × 0.16
ret_isr = total × 0.0125
ret_iva = sinVida × 0.10667

total_neto = total + iva - ret_isr - ret_iva
```

### Redondeo

- Redondear a 2 decimales SOLO valores finales
- No redondear bases intermedias

### Ejemplo Numérico

**Entrada:**
- Comisión Vida: $5,000.00
- Comisión Sin Vida: $15,000.00
- Total: $20,000.00

**Cálculo:**
```
Ret. Contable = $0.00
Costo Dispersión = $0.00
IVA = $15,000.00 × 0.16 = $2,400.00
Ret ISR = $20,000.00 × 0.0125 = $250.00
Ret IVA = $15,000.00 × 0.10667 = $1,600.05

Total Neto = $20,000.00 + $2,400.00 - $250.00 - $1,600.05 = $20,549.95
```

---

## Persistencia en Lote (OBLIGATORIA)

### Campos en `commission_batches`

```sql
commission_total      -- Total comisiones
commission_vida       -- Comisiones ramo Vida
commission_sinvida    -- Comisiones otros ramos
retencion_contable    -- 0 para HONORARIOS/RESICO
costo_dispersion      -- 0 para HONORARIOS/RESICO
iva                   -- sinVida × 0.16
ret_isr               -- total × % según régimen
ret_iva               -- sinVida × 0.10667
total_neto            -- Total a pagar
regimen_fiscal        -- HONORARIOS o RESICO
tax_version           -- Versión del cálculo
calculated_at         -- Timestamp del cálculo
```

### Tax Versions

- `HONORARIOS_IMAGEN_OFICIAL_V1`
- `RESICO_IMAGEN_OFICIAL_V1`
- `ASIMILADOS_*` → NO TOCAR

---

## Implementación Backend

### Función SQL: `calculate_batch_fiscal_aggregates()`

**Ubicación:** Migración `20251220000000_fix_fiscal_honorarios_resico_only.sql`

**Características:**
1. Guard clause obligatorio para ASIMILADOS
2. Solo procesa HONORARIOS y RESICO
3. Calcula y persiste en `commission_batches`
4. Retorna JSON con resultado

**Uso:**

```sql
SELECT calculate_batch_fiscal_aggregates('batch-uuid');
```

**Respuesta para HONORARIOS/RESICO:**

```json
{
  "success": true,
  "regimen_fiscal": "HONORARIOS",
  "tax_version": "HONORARIOS_IMAGEN_OFICIAL_V1",
  "commission_vida": 5000.00,
  "commission_sinvida": 15000.00,
  "commission_total": 20000.00,
  "retencion_contable": 0.00,
  "costo_dispersion": 0.00,
  "iva": 2400.00,
  "ret_isr": 2000.00,
  "ret_iva": 1600.05,
  "total_neto": 18799.95
}
```

**Respuesta para ASIMILADOS (skip):**

```json
{
  "success": true,
  "skipped": true,
  "reason": "ASIMILADOS es intocable - no se modificó nada",
  "regimen_fiscal": "ASIMILADOS"
}
```

---

## Implementación Frontend

### Guard Clauses en `commissionFiscalCalculations.ts`

```typescript
export function calcularDesgloseFiscal(params: CalculoFiscalParams): DesgloseFiscal {
  // ===============================================================================
  // 🚫 GUARD CLAUSE OBLIGATORIO: ASIMILADOS ES INTOCABLE
  // ===============================================================================
  if (regimenFiscal === "ASIMILADOS") {
    throw new Error(
      "ASIMILADOS es intocable. No usar esta función para ASIMILADOS. " +
      "Los cálculos de ASIMILADOS ya están implementados y no deben modificarse."
    );
  }

  // ===============================================================================
  // SOLO CONTINUAR SI ES HONORARIOS O RESICO
  // ===============================================================================
  if (regimenFiscal !== "HONORARIOS" && regimenFiscal !== "RESICO") {
    throw new Error(
      `Régimen fiscal "${regimenFiscal}" no reconocido. ` +
      "Solo se permiten HONORARIOS o RESICO."
    );
  }

  // ... resto del cálculo
}
```

---

## Edge Function: `recalculate-commission-batch`

### Flujo Actualizado

1. Recalcular comisiones individuales (commission_bruta, commission_neta)
2. **NUEVO:** Llamar a `calculate_batch_fiscal_aggregates()`
3. Auditar recálculo
4. Retornar resultado con `fiscal_result`

**Código agregado:**

```typescript
// ============================================================================
// CALCULAR AGREGADOS FISCALES (SOLO HONORARIOS Y RESICO)
// ============================================================================
console.log('[recalculate] Calculating fiscal aggregates...');

const { data: fiscalResult, error: fiscalError } = await supabase.rpc(
  'calculate_batch_fiscal_aggregates',
  { p_batch_id: batchId }
);

if (fiscalError) {
  console.error('[recalculate] Error calculating fiscal aggregates:', fiscalError);
  warnings.push({
    type: 'fiscal_calculation_error',
    message: `Error al calcular agregados fiscales: ${fiscalError.message}`
  });
} else {
  console.log('[recalculate] Fiscal aggregates calculated:', fiscalResult);
}
```

---

## PDF "Orden de Pago"

### Regla ÚNICA

El PDF:
- ❌ NO calcula
- ❌ NO ajusta
- ❌ NO infiere
- ✅ SOLO renderiza valores del lote

### Mostrar en PDF para HONORARIOS y RESICO

```
CONCEPTO                      IMPORTE
──────────────────────────────────────
Comisión Vida                 $X,XXX.XX
Comisión Sin Vida             $X,XXX.XX
Comisión Total                $X,XXX.XX

IVA (16%)                     $X,XXX.XX
Ret. ISR (X%)                 $X,XXX.XX
Ret. IVA (10.667%)            $X,XXX.XX
──────────────────────────────────────
TOTAL A PAGAR                 $X,XXX.XX
```

### Mostrar en PDF para ASIMILADOS

❌ **NO TOCAR** su formato actual

---

## Validación Bloqueante

### Antes de:
- Cerrar lote
- Descargar PDF
- Mostrar Mis Comisiones

### Validación

Si régimen es **HONORARIOS** o **RESICO** y falta alguno de:

```
iva, ret_isr, ret_iva, total_neto, calculated_at
```

**Entonces:**
1. Ejecutar `calculate_batch_fiscal_aggregates()`
2. Si sigue faltando, bloquear con error claro

### Pseudocódigo

```typescript
if (regimen === "HONORARIOS" || regimen === "RESICO") {
  if (!batch.iva || !batch.ret_isr || !batch.ret_iva || !batch.total_neto || !batch.calculated_at) {
    // Intentar calcular
    const result = await supabase.rpc('calculate_batch_fiscal_aggregates', { p_batch_id: batchId });

    if (!result.success) {
      throw new Error("No se pueden calcular los agregados fiscales. Contacte a soporte.");
    }
  }
}
```

---

## Tests Obligatorios

### Test HONORARIOS

```javascript
const input = {
  vida: 5000,
  sinVida: 15000,
  total: 20000
};

const expected = {
  retencion_contable: 0,
  costo_dispersion: 0,
  iva: 2400.00,        // sinVida × 0.16
  ret_isr: 2000.00,    // total × 0.10
  ret_iva: 1600.05,    // sinVida × 0.10667
  total_neto: 18799.95 // total + iva - ret_isr - ret_iva
};
```

### Test RESICO

```javascript
const input = {
  vida: 5000,
  sinVida: 15000,
  total: 20000
};

const expected = {
  retencion_contable: 0,
  costo_dispersion: 0,
  iva: 2400.00,        // sinVida × 0.16
  ret_isr: 250.00,     // total × 0.0125
  ret_iva: 1600.05,    // sinVida × 0.10667
  total_neto: 20549.95 // total + iva - ret_isr - ret_iva
};
```

### Test ASIMILADOS

```javascript
// Verificar que NO se ejecuta ni modifica nada
const result = await calculate_batch_fiscal_aggregates(asimiladosBatchId);

assert(result.success === true);
assert(result.skipped === true);
assert(result.reason.includes("intocable"));
```

---

## Archivos Modificados

### Backend

1. ✅ **Migración:** `supabase/migrations/20251220000000_fix_fiscal_honorarios_resico_only.sql`
   - Función `calculate_batch_fiscal_aggregates()`
   - Guard clause para ASIMILADOS
   - Cálculos fiscales correctos

2. ✅ **Edge Function:** `supabase/functions/recalculate-commission-batch/index.ts`
   - Llama a `calculate_batch_fiscal_aggregates()` después de recalcular comisiones
   - Retorna `fiscal_result` en respuesta

### Frontend

3. ✅ **Librería:** `src/lib/commissionFiscalCalculations.ts`
   - Guard clauses obligatorios
   - Protección contra uso con ASIMILADOS
   - Fórmulas correctas ya implementadas

---

## Archivos NO Modificados

### ❌ NO SE TOCARON (ASIMILADOS INTOCABLE)

- ❌ Ningún archivo que contenga cálculos de ASIMILADOS
- ❌ Ningún PDF de ASIMILADOS
- ❌ Ninguna función de redondeo de ASIMILADOS
- ❌ Ninguna migración anterior de ASIMILADOS

---

## Comparación: Antes vs Después

### HONORARIOS

| Concepto | Antes | Después |
|----------|-------|---------|
| Ret. Contable | Variable | ✅ 0 |
| Costo Dispersión | Variable | ✅ 0 |
| IVA | sinVida × 0.16 | ✅ sinVida × 0.16 |
| Ret ISR | Variable | ✅ total × 0.10 |
| Ret IVA | sinVida × ? | ✅ sinVida × 0.10667 |

### RESICO

| Concepto | Antes | Después |
|----------|-------|---------|
| Ret. Contable | Variable | ✅ 0 |
| Costo Dispersión | Variable | ✅ 0 |
| IVA | sinVida × 0.16 | ✅ sinVida × 0.16 |
| Ret ISR | Variable | ✅ total × 0.0125 |
| Ret IVA | sinVida × ? | ✅ sinVida × 0.10667 |

### ASIMILADOS

| Concepto | Antes | Después |
|----------|-------|---------|
| TODO | ✅ Funciona | ✅ **INTOCABLE - NO MODIFICADO** |

---

## Checklist de Verificación

### Backend

- [x] Función SQL creada con guard clause
- [x] Fórmulas correctas para HONORARIOS
- [x] Fórmulas correctas para RESICO
- [x] ASIMILADOS se salta completamente
- [x] Persistencia en `commission_batches`
- [x] Tax version correcta

### Edge Functions

- [x] `recalculate-commission-batch` llama a función SQL
- [x] Manejo de errores implementado
- [x] Resultado incluye `fiscal_result`

### Frontend

- [x] Guard clauses implementados
- [x] Protección contra ASIMILADOS
- [x] Solo permite HONORARIOS y RESICO

### Tests

- [ ] Test HONORARIOS
- [ ] Test RESICO
- [ ] Test ASIMILADOS (verificar skip)
- [ ] Test PDF con valores persistidos
- [ ] Test Mis Comisiones

---

## Próximos Pasos

### 1. Llamar a la función SQL desde otros puntos

- `create-weekly-batches` → Al crear lote nuevo
- `send-commission-batch-notifications` → Antes de enviar notificaciones
- Frontend al cerrar lote

### 2. Actualizar PDF

- Leer valores de `commission_batches`
- NO recalcular nada
- Renderizar solo

### 3. Actualizar Mis Comisiones

- Leer valores de `commission_batches`
- Mostrar desglose fiscal
- NO recalcular nada

---

## Notas Importantes

### Fuente Única de Verdad

✅ **Backend (Función SQL)** → Calcula y persiste
✅ **Base de Datos** → Almacena valores
✅ **Frontend y PDF** → Solo leen y renderizan

❌ **NUNCA** calcular en frontend
❌ **NUNCA** calcular en generador de PDF
❌ **NUNCA** modificar ASIMILADOS

### Seguridad

Los guard clauses en múltiples niveles protegen contra:
- Uso accidental con ASIMILADOS
- Cálculos incorrectos
- Recálculos innecesarios

### Auditoría

Cada cálculo queda registrado en:
- `commission_batches.calculated_at`
- `commission_batches.tax_version`
- `commission_recalculations` (auditoría completa)

---

**Fin del documento**
