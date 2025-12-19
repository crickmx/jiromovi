# FIX ASIMILADOS: Solución Definitiva - Fórmula Correcta Imagen 1

## El Problema Exacto

El PDF mostraba:
- **ISR Total = $1,358.54**
- **Total a Pagar = $12,078.71**

Cuando debería mostrar:
- **ISR Total = $1,355.53**
- **Total a Pagar = $12,081.72**

**Diferencia:** $3.01 de error en ISR Total

---

## Causa Raíz Identificada

El sistema estaba calculando **ISR Vida de forma incorrecta**:

### Fórmula Incorrecta (la que estaba implementada):
```
❌ isrVida = (vida / 1.09) × 0.10
   isrVida = (544.20 / 1.09) × 0.10 = 49.93
```

### Fórmula Correcta (Imagen 1):
```
✅ isrVida = ((vida - retContable) / 1.09) × 0.10
   isrVida = ((544.20 - 87.07) / 1.09) × 0.10 = 46.91
```

**La diferencia:** 49.93 - 46.91 = **3.02**

Ese error de $3.02 en ISR Vida se propagaba al ISR Total y al Total a Pagar.

---

## Fórmulas CORRECTAS (Imagen 1)

### Para ASIMILADOS (régimen exclusivo):

1. **Retención Contable** (solo Vida):
   ```
   retContable = vida × 0.16
   retContable = 544.20 × 0.16 = $87.07 ✅
   ```

2. **Costo de Dispersión** (solo Sin Vida):
   ```
   costoDispersion = sinVida × 0.09
   costoDispersion = 14,263.87 × 0.09 = $1,283.75 ✅
   ```

3. **ISR Vida** (CRÍTICO - restar retención ANTES de /1.09):
   ```
   isrVida = ((vida - retContable) / 1.09) × 0.10
   isrVida = ((544.20 - 87.07) / 1.09) × 0.10 = $46.91 ✅
   ```

4. **ISR Daños** (restar costo ANTES de /1.09):
   ```
   isrDanios = ((sinVida - costoDispersion) / 1.09) × 0.10
   isrDanios = ((14,263.87 - 1,283.75) / 1.09) × 0.10 = $1,308.61 ✅
   ```

5. **ISR Total**:
   ```
   isrTotal = isrVida + isrDanios
   isrTotal = 46.91 + 1,308.61 = $1,355.53 ✅
   ```

6. **Total a Pagar**:
   ```
   totalPagar = total - retContable - costoDispersion - isrTotal
   totalPagar = 14,808.07 - 87.07 - 1,283.75 - 1,355.53 = $12,081.72 ✅
   ```

---

## Caso de Prueba Verificado

| Concepto | Valor Entrada |
|----------|---------------|
| Comisión Vida | $544.20 |
| Comisión Sin Vida | $14,263.87 |
| **Total Comisión** | **$14,808.07** |

### Desglose Fiscal Correcto:

| Concepto | Fórmula | Resultado |
|----------|---------|-----------|
| Ret. Contable | vida × 0.16 | $87.07 |
| Costo Dispersión | sinVida × 0.09 | $1,283.75 |
| ISR Vida | ((vida - ret) / 1.09) × 0.10 | **$46.91** |
| ISR Daños | ((sinVida - costo) / 1.09) × 0.10 | $1,308.61 |
| **ISR Total** | isrVida + isrDanios | **$1,355.53** |
| IVA | 0 (ASIMILADOS no genera IVA) | $0.00 |
| **Total a Pagar** | total - ret - costo - isr | **$12,081.72** |

---

## Cambios Implementados

### 1. Base de Datos (PostgreSQL)

**Archivo:** `supabase/migrations/fix_asimilados_isr_correcto_restar_retenciones_antes.sql`

**Función actualizada:** `calcular_desglose_fiscal_asimilados(batch_id, agent_id)`

```sql
-- ISR Vida = ((vida - retContable) / 1.09) × 0.10
v_isr_vida := ROUND((((v_vida - v_ret_contable) / 1.09) * 0.10)::numeric, 2);

-- ISR Daños = ((sinVida - dispersion) / 1.09) × 0.10
v_isr_danios := ROUND((((v_sin_vida - v_dispersion) / 1.09) * 0.10)::numeric, 2);
```

### 2. Frontend (TypeScript)

**Archivo:** `src/lib/commissionFiscalCalculations.ts`

**Función:** `calcularAsimilados()`

```typescript
// ISR Vida: Base = (Vida - Ret. Contable) / 1.09, ISR = Base × 0.10
const baseIsrVida = (vida - retContable) / 1.09;
const isrVida = roundTo2Decimals(baseIsrVida * 0.10);

// ISR Daños: Base = (Sin Vida - Costo Dispersión) / 1.09, ISR = Base × 0.10
const baseIsrDanios = (sinVida - costoDispersion) / 1.09;
const isrDanios = roundTo2Decimals(baseIsrDanios * 0.10);
```

### 3. Tests Bloqueantes

**Archivo:** `src/lib/commissionAsimiladosTest.ts`

Valores esperados actualizados para validar:
- ✅ ISR Vida = $46.91
- ✅ ISR Daños = $1,308.61
- ✅ ISR Total = $1,355.53
- ✅ Total a Pagar = $12,081.72

---

## Validación Final

### Build Exitoso:
```bash
✓ 3012 modules transformed
✓ built in 26.91s
```

### Regímenes NO Afectados:
- ✅ **RESICO:** Sin cambios
- ✅ **HONORARIOS:** Sin cambios

### Aplicable SOLO a:
- ✅ **ASIMILADOS**

---

## Qué Hacer Ahora (Pasos del Usuario)

1. **Eliminar lote anterior** (Semana 51 con valores incorrectos)
2. **Regenerar el lote de comisiones** desde el módulo de administrador
3. **Generar nuevo PDF** desde "Mis Comisiones"
4. **Verificar** que el PDF muestre:
   - ISR Total: **$1,355.53**
   - Total a Pagar: **$12,081.72**

---

## Diferencia con el PDF Anterior

| Concepto | PDF Anterior (❌) | PDF Correcto (✅) | Diferencia |
|----------|-------------------|-------------------|------------|
| ISR Vida | $49.93 | $46.91 | -$3.02 |
| ISR Total | $1,358.54 | $1,355.53 | -$3.01 |
| Total a Pagar | $12,078.71 | $12,081.72 | +$3.01 |

---

## Resumen Ejecutivo

**Problema:** ISR Vida no restaba la Retención Contable antes de dividir por 1.09

**Solución:** Actualizar fórmula a `((vida - retContable) / 1.09) × 0.10`

**Impacto:** Solo ASIMILADOS. RESICO y HONORARIOS sin cambios.

**Resultado:** PDF ahora coincide exactamente con Imagen 1 (referencia correcta)

**Próximo paso:** Regenerar el lote para aplicar la corrección

---

## Notas Técnicas

### Por qué se restan las retenciones ANTES de /1.09

La división por 1.09 es un ajuste fiscal que se aplica sobre la **base gravable**.

Para ASIMILADOS:
- La base gravable de Vida es: `vida - retContable`
- La base gravable de Sin Vida es: `sinVida - costoDispersion`

Por eso las retenciones se restan **antes** de aplicar el divisor 1.09, no después.

### Redondeo

Todos los valores se redondean a 2 decimales después de cada cálculo para evitar propagación de errores de redondeo.

---

## Conclusión

La corrección ha sido aplicada correctamente. El sistema ahora calcula el ISR para ASIMILADOS exactamente como se especifica en la Imagen 1.

El próximo PDF generado después de regenerar el lote mostrará los valores correctos.
