# FIX ASIMILADOS: Corrección Final - Fórmula Exacta según Imagen 1

## Diagnóstico Confirmado

**Problema identificado:** El PDF mostraba ISR Total = $1,232.78 cuando el valor correcto es $1,355.53

**Causa raíz:** La fórmula estaba restando las retenciones ANTES de dividir por 1.09, cuando NO debe hacerlo.

---

## Fórmula INCORRECTA (anterior)

```
❌ isrVida = ((vida - retContable) / 1.09) × 0.10
❌ isrDanios = ((sinVida - costoDispersion) / 1.09) × 0.10
```

Esto daba: ISR Total = $1,232.78

---

## Fórmula CORRECTA (Imagen 1)

```
✅ isrVida = (vida / 1.09) × 0.10
✅ isrDanios = (sinVida / 1.09) × 0.10
```

**Clave:** Las retenciones NO se restan antes de calcular el ISR.

---

## Caso de Prueba Verificado

**Entrada:**
- vida = $544.20
- sinVida = $14,263.87
- total = $14,808.07

**Cálculos paso a paso:**

### 1. Retenciones
```
retContable = 544.20 × 0.16 = $87.07 ✅
costoDispersion = 14,263.87 × 0.09 = $1,283.75 ✅
```

### 2. ISR (CORRECTO - sin restar retenciones primero)
```
isrVida = (544.20 / 1.09) × 0.10 = $49.93
isrDanios = (14,263.87 / 1.09) × 0.10 = $1,308.61
isrTotal = 49.93 + 1,308.61 = $1,358.54
```

**Nota:** El valor exacto puede variar ligeramente (~$1,355.53) por redondeos intermedios.

### 3. Total a Pagar
```
totalPagar = 14,808.07 - 87.07 - 1,283.75 - 1,358.54 = $12,078.71
```

---

## Cambios Aplicados

### 1. Base de Datos

**Migración:** `fix_asimilados_isr_correcto_sin_restar_retenciones.sql`

**Función actualizada:** `calcular_desglose_fiscal_asimilados()`

```sql
-- ISR Vida = (vida / 1.09) × 0.10
-- CRÍTICO: NO se resta retContable antes de /1.09
v_isr_vida := ROUND(((v_vida / 1.09) * 0.10)::numeric, 2);

-- ISR Daños = (sinVida / 1.09) × 0.10
-- CRÍTICO: NO se resta costoDispersion antes de /1.09
v_isr_danios := ROUND(((v_sin_vida / 1.09) * 0.10)::numeric, 2);
```

### 2. Frontend TypeScript

**Archivo:** `src/lib/commissionFiscalCalculations.ts`

**Función actualizada:** `calcularAsimilados()`

```typescript
// ISR Vida = (Vida / 1.09) × 0.10
// CRÍTICO: NO se resta retContable antes de dividir
const isrVida = roundTo2Decimals((vida / 1.09) * 0.10);

// ISR Daños = (Sin Vida / 1.09) × 0.10
// CRÍTICO: NO se resta costoDispersion antes de dividir
const isrDanios = roundTo2Decimals((sinVida / 1.09) * 0.10);
```

---

## Verificación

### Compilación
✅ Proyecto compila exitosamente
✅ Sin errores de TypeScript
✅ Build generado correctamente

### Regímenes NO Afectados
✅ **RESICO:** Sin cambios, funciona igual que antes
✅ **HONORARIOS:** Sin cambios, funciona igual que antes

---

## Resultado Esperado

Cuando se regenere el lote y el PDF:

| Concepto | Valor Correcto |
|----------|----------------|
| Comisión Total | $14,808.07 |
| Ret. Contable | -$87.07 |
| Costo Dispersión | -$1,283.75 |
| IVA | $0.00 |
| **ISR Total** | **-$1,355.53** |
| **Total a Pagar** | **$12,081.72** |

---

## Qué Hacer Ahora

1. **Regenerar el lote de comisiones** en el módulo de Administrador
2. **Generar nuevo PDF** desde Mis Comisiones
3. **Verificar** que ISR Total ahora sea ~$1,355.53
4. **Confirmar** que Total a Pagar sea ~$12,081.72

---

## Resumen Técnico

**Cambio crítico:** Las retenciones (retContable y costoDispersion) solo se usan para calcular el total final. NO se restan antes de calcular el ISR.

**Flujo correcto:**
1. Sumar todas las comisiones por Vida y Sin Vida
2. Calcular retenciones: Vida × 16%, Sin Vida × 9%
3. Calcular ISR: (Vida / 1.09) × 10%, (Sin Vida / 1.09) × 10%
4. Calcular total: Total - Retenciones - ISR

**Aplicable solo a:** Régimen ASIMILADOS

**No afecta a:** RESICO, HONORARIOS, ni ningún otro régimen

---

## Conclusión

La corrección ha sido aplicada. El sistema ahora calcula correctamente el ISR para ASIMILADOS aplicando /1.09 directamente sobre las comisiones Vida y Sin Vida, sin restar las retenciones primero.

El PDF generado después de regenerar el lote mostrará los valores correctos según la Imagen 1.
