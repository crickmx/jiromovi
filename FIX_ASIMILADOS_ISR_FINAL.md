# Corrección Cálculo ISR - ASIMILADOS (FINAL)

## Resumen

Se corrigió el cálculo del ISR para el régimen **ASIMILADOS** en el PDF de comisiones según las especificaciones oficiales del sistema.

## Fórmulas Implementadas

### 1. Retención Contable (SOLO Vida)
```
Retención Contable = Comisión Vida × 16%
```

### 2. Costo de Dispersión (SOLO Sin Vida)
```
Costo Dispersión = Comisión Sin Vida × 9%
```

### 3. ISR Vida
```
Base ISR Vida = Comisión Vida - Retención Contable
ISR Vida = Base ISR Vida × 10%
```

### 4. ISR Daños
```
Base ISR Daños = Comisión Sin Vida - Costo Dispersión
ISR Daños = Base ISR Daños × 10%
```

### 5. Total a Pagar
```
Total = Comisión Total - Ret. Contable - Costo Dispersión - ISR Total
```

## Regla Fundamental

**El ISR se calcula sobre la base DESPUÉS de restar los descuentos:**
- ISR Vida: 10% de (Comisión Vida - Retención Contable)
- ISR Daños: 10% de (Comisión Sin Vida - Costo Dispersión)

## Validación

### Caso de Prueba (Especificación del Usuario)

**Entrada:**
- Comisión Total: $14,808.07
- Vida: $544.20
- Sin Vida: $14,263.87

**Salida Esperada:**
- Ret. Contable: $87.07
- Costo Dispersión: $1,283.75
- ISR Vida: $45.71
- ISR Daños: $1,298.01
- ISR Total: $1,343.72
- **TOTAL A PAGAR: $12,093.53**

**Cálculos Paso a Paso:**
```
1. Retención Contable = 544.20 × 0.16 = 87.07 ✓
2. Costo Dispersión = 14,263.87 × 0.09 = 1,283.75 ✓

3. Base ISR Vida = 544.20 - 87.07 = 457.13
4. ISR Vida = 457.13 × 0.10 = 45.71 ✓

5. Base ISR Daños = 14,263.87 - 1,283.75 = 12,980.12
6. ISR Daños = 12,980.12 × 0.10 = 1,298.01 ✓

7. ISR Total = 45.71 + 1,298.01 = 1,343.72 ✓

8. Total = 14,808.07 - 87.07 - 1,283.75 - 1,343.72 = 12,093.53 ✓
```

## Archivos Modificados

### 1. `src/lib/commissionFiscalCalculations.ts`
**Función:** `calcularAsimilados()`

**Cambios:**
```typescript
// Cálculo correcto del ISR
const isrVida = roundTo2Decimals((vida - retContable) * 0.10);
const isrDanios = roundTo2Decimals((sinVida - costoDispersion) * 0.10);
```

### 2. `src/lib/commissionFiscalCalculations.test.ts`
**Nuevos tests:**
- `testAsimiladosSoloVida()`: Valida solo Vida
- `testAsimiladosSoloSinVida()`: Valida solo Daños
- `testAsimiladosMixto()`: Valida Vida + Daños
- `testAsimiladosCasoReal()`: Valida caso real del usuario

**Función para ejecutar tests:**
```typescript
runAllAsimiladosTests();
```

## Estructura del PDF

El PDF "Orden de Pago" para ASIMILADOS muestra:

### Resumen por Ramo
- Vehículos
- Accidentes y Enfermedades
- Vida
- **TOTAL Comisión**

### Desglose Fiscal
- Ret. Contable (16% Vida)
- Costo de Dispersión (9% Sin Vida)
- ISR Vida (10% base)
- ISR Daños (10% base)
- ISR Total

### Total Final
- **TOTAL A PAGAR**

## Impacto

Este cambio afecta **únicamente** al PDF fiscal de ASIMILADOS en:
- Página "Mis Comisiones" (vista del agente)
- Dashboard de administrador
- PDF de Orden de Pago

**Los otros regímenes (RESICO y HONORARIOS) NO se modificaron.**

## Notas Técnicas

1. **Separación Vida/Sin Vida es obligatoria**
   - NO se puede calcular ISR directo sobre el total
   - Cada ramo tiene su propia base ISR

2. **Redondeos**
   - Se aplican a 2 decimales en cada paso
   - Función: `roundTo2Decimals()`

3. **Persistencia**
   - Los cálculos se realizan a nivel lote
   - Los valores se guardan en base de datos
   - El PDF solo lee los valores calculados

4. **Fuente de Verdad**
   - Función `calcularAsimilados()` es la única fuente de verdad
   - Backend y PDF usan la misma lógica

## Verificación

Para verificar la implementación:

1. Crear un lote de comisiones con régimen ASIMILADOS
2. Incluir pólizas de Vida y Sin Vida
3. Generar el PDF
4. Verificar que los cálculos coincidan con las fórmulas

Si los valores NO coinciden → ERROR DE IMPLEMENTACIÓN

## Prohibiciones

**NUNCA:**
- Calcular ISR directo sobre la comisión total
- Ignorar la separación Vida/Sin Vida
- Usar 10% para el costo de dispersión (es 9%)
- Calcular ISR antes de restar los descuentos
