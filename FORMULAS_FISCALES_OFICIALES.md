# Fórmulas Fiscales Oficiales - Sistema de Comisiones

## Fuente de Verdad

Este documento contiene las fórmulas oficiales basadas en las imágenes proporcionadas por el cliente el 16 de diciembre de 2025.

**IMPORTANTE:** Estas fórmulas son la única fuente de verdad para cálculos fiscales de HONORARIOS y RESICO. Cualquier cambio debe ser aprobado por el cliente y documentado aquí.

---

## HONORARIOS

### Base de cálculo
**Comisión Neta** (`commission_neta` o `adjusted_commission_neta` si `is_manual_adjusted = true`)

### Campos calculados

1. **Comisión Base Total**: Suma de `commission_neta` (o `adjusted_commission_neta` si fue ajustada manualmente)
2. **Vida**: Suma de comisiones donde `ramo = 'vida'`
3. **Sin Vida**: Total - Vida
4. **IVA**: Sin Vida × 0.16 (16%)
5. **Ret ISR**: Total × 0.10 (10%)
6. **Ret IVA**: Sin Vida × 0.10667 (10.667%)
7. **Total a Pagar**: Total + IVA - Ret ISR - Ret IVA

### Ejemplo (Imagen 2 - Valores Oficiales)

```
Comisión Base Total:  $14,808.07
Vida:                 $   544.20
Sin Vida:             $14,263.87

IVA:                  $ 2,282.22  (14,263.87 × 0.16)
Ret ISR:              $ 1,480.81  (14,808.07 × 0.10)
Ret IVA:              $ 1,521.48  (14,263.87 × 0.10667)

Total a Pagar:        $14,088.00  (14,808.07 + 2,282.22 - 1,480.81 - 1,521.48)
```

### Validación

```javascript
// IVA
const iva = Math.round(sinVida * 0.16 * 100) / 100;
// Esperado: 2282.22

// Ret ISR
const retIsr = Math.round(total * 0.10 * 100) / 100;
// Esperado: 1480.81

// Ret IVA
const retIva = Math.round(sinVida * 0.10667 * 100) / 100;
// Esperado: 1521.48

// Total a Pagar
const totalAPagar = Math.round((total + iva - retIsr - retIva) * 100) / 100;
// Esperado: 14088.00
```

---

## RESICO

### Base de cálculo
**Comisión Neta** (`commission_neta` o `adjusted_commission_neta` si `is_manual_adjusted = true`)

### Campos calculados

1. **Comisión Base Total**: Suma de `commission_neta` (o `adjusted_commission_neta` si fue ajustada manualmente)
2. **Vida**: Suma de comisiones donde `ramo = 'vida'`
3. **Sin Vida**: Total - Vida
4. **IVA**: Sin Vida × 0.16 (16%)
5. **Ret ISR**: Total × 0.0125 (1.25%)
6. **Ret IVA**: Sin Vida × 0.10667 (10.667%)
7. **Total a Pagar**: Total + IVA - Ret ISR - Ret IVA

### Ejemplo (Imagen 3 - Valores Oficiales)

```
Comisión Base Total:  $14,808.07
Vida:                 $   544.20
Sin Vida:             $14,263.87

IVA:                  $ 2,282.22  (14,263.87 × 0.16)
Ret ISR:              $   185.10  (14,808.07 × 0.0125)
Ret IVA:              $ 1,521.48  (14,263.87 × 0.10667)

Total a Pagar:        $15,383.70  (14,808.07 + 2,282.22 - 185.10 - 1,521.48)
```

### Validación

```javascript
// IVA
const iva = Math.round(sinVida * 0.16 * 100) / 100;
// Esperado: 2282.22

// Ret ISR
const retIsr = Math.round(total * 0.0125 * 100) / 100;
// Esperado: 185.10

// Ret IVA
const retIva = Math.round(sinVida * 0.10667 * 100) / 100;
// Esperado: 1521.48

// Total a Pagar
const totalAPagar = Math.round((total + iva - retIsr - retIva) * 100) / 100;
// Esperado: 15383.70
```

---

## ASIMILADOS

### IMPORTANTE: NO MODIFICAR

ASIMILADOS tiene su propio sistema de cálculo fiscal implementado en funciones de base de datos separadas.

**NUNCA se debe tocar, modificar o alterar ningún código relacionado con ASIMILADOS.**

El sistema usa:
- Retención Contable: 16% de Vida
- Costo Dispersión: 9% de Sin Vida
- ISR con división por 1.09 para base gravable

Para más detalles, consultar los archivos:
- `SISTEMA_FISCAL_ASIMILADOS_DEFINITIVO.md`
- `FIX_ASIMILADOS_ISR_FINAL.md`

---

## Diferencias Clave entre Regímenes

| Campo | HONORARIOS | RESICO | ASIMILADOS |
|-------|-----------|---------|------------|
| **Base** | commission_neta | commission_neta | commission_neta |
| **Ret. Contable** | 0 | 0 | 16% Vida |
| **Costo Dispersión** | 0 | 0 | 9% Sin Vida |
| **IVA** | 16% Sin Vida | 16% Sin Vida | N/A |
| **Ret ISR** | 10% Total | 1.25% Total | Complejo* |
| **Ret IVA** | 10.667% Sin Vida | 10.667% Sin Vida | N/A |

*ASIMILADOS: ISR se calcula sobre base después de descuentos con división por 1.09

---

## Notas Técnicas

### 1. Ajustes Manuales

Cuando `is_manual_adjusted = true`, usar `adjusted_commission_neta` en lugar de `commission_neta`:

```sql
CASE
  WHEN is_manual_adjusted AND adjusted_commission_neta IS NOT NULL
    THEN adjusted_commission_neta
  ELSE COALESCE(commission_neta, 0)
END
```

### 2. Redondeo

Todos los valores monetarios se redondean a 2 decimales usando `ROUND(valor::numeric, 2)` en SQL o `Math.round(valor * 100) / 100` en JavaScript.

### 3. Persistencia

Los valores fiscales se calculan cuando:
1. Se cierra un lote (botón "Cerrar Lote")
2. Se recalcula un lote (botón "Recalcular Lote")
3. Se ajusta manualmente una comisión y se recalcula

Los valores se guardan en la tabla `commission_batches`:
- `commission_vida`
- `commission_sinvida`
- `commission_total`
- `iva`
- `ret_isr`
- `ret_iva`
- `total_neto`
- `calculated_at` (timestamp del cálculo)
- `tax_version` (versión de las fórmulas usadas)

### 4. Generación de PDFs

Los PDFs **SIEMPRE** leen valores persistidos de la base de datos. **NUNCA** recalculan.

Si los valores no existen, el PDF:
1. Intenta recalcular automáticamente
2. Si falla, muestra error claro al usuario

### 5. Vista "Mis Comisiones"

La vista de agentes:
1. Lee valores persistidos de `commission_batches`
2. Si no hay valores, recalcula automáticamente
3. **NUNCA** calcula manualmente en el frontend

### 6. Validación de Consistencia

Usar la función SQL `validate_commission_batch(batch_id)` para validar:
- Suma de detalles = total del batch
- Vida + Sin Vida = Total
- Fórmulas fiscales correctas
- Valores no nulos para lotes cerrados

```sql
SELECT validate_commission_batch('batch-id-aqui');
```

Retorna JSON con:
- `valid`: boolean
- `errors`: array de errores críticos
- `warnings`: array de advertencias
- `summary`: resumen de valores

### 7. Tax Versions

Cada cálculo marca la versión de fórmulas usada:

- `HONORARIOS_AJUSTES_MANUALES_V2`: HONORARIOS con soporte de ajustes
- `RESICO_AJUSTES_MANUALES_V2`: RESICO con soporte de ajustes
- `ASIMILADOS_*`: NO MODIFICAR (múltiples versiones históricas)

---

## Tests Unitarios

Tests ubicados en: `src/lib/commissionFiscalCalculations.test.ts`

Para ejecutar tests con valores oficiales:

```javascript
import { runImagenesOficialesTests } from './commissionFiscalCalculations.test';

runImagenesOficialesTests();
```

Tests incluidos:
- `testHonorariosImagenOficial()`: Valida valores exactos de Imagen 2
- `testResicoImagenOficial()`: Valida valores exactos de Imagen 3
- `testAsimiladosRechazado()`: Valida que ASIMILADOS no se calcula en frontend

---

## Archivos Relacionados

### Backend (SQL)
- `supabase/migrations/*_fix_fiscal_with_manual_adjustments.sql` - Función principal de cálculo
- `supabase/migrations/*_create_batch_validation_function.sql` - Función de validación

### Frontend
- `src/lib/commissionFiscalCalculations.ts` - Cálculos en frontend (SOLO para preview)
- `src/lib/pdfUtils.ts` - Generación de PDFs
- `src/pages/MisComisiones.tsx` - Vista de agente
- `src/pages/ComisionesLote.tsx` - Vista de admin

### Edge Functions
- `supabase/functions/recalculate-commission-batch/` - Recálculo manual
- `supabase/functions/create-weekly-batches/` - Creación de lotes

### Documentación
- `FORMULAS_FISCALES_OFICIALES.md` - Este archivo
- `SISTEMA_FISCAL_ASIMILADOS_DEFINITIVO.md` - ASIMILADOS (NO TOCAR)
- `CALCULO_FISCAL_ASIMILADOS.md` - ASIMILADOS histórico

---

## Historial de Cambios

### 2025-12-20: Implementación de Fórmulas Oficiales
- Función SQL actualizada para considerar ajustes manuales
- Eliminado cálculo fallback en MisComisiones
- Agregados tests con valores de imágenes oficiales
- Creada función de validación de consistencia
- Documentadas fórmulas oficiales

### 2025-12-16: Especificación de Fórmulas
- Cliente proporcionó imágenes oficiales con fórmulas exactas
- Confirmadas diferencias entre HONORARIOS (10% ISR) y RESICO (1.25% ISR)
- Confirmado que ASIMILADOS no se modifica

---

## Soporte

Para preguntas sobre fórmulas fiscales:
1. Consultar este documento primero
2. Verificar con cliente si hay dudas sobre interpretación
3. Usar función `validate_commission_batch()` para diagnosticar problemas
4. Ejecutar tests unitarios para validar cálculos

**NUNCA modificar fórmulas sin aprobación explícita del cliente y sin actualizar este documento.**
