# Cálculo ISR para ASIMILADOS - Documentación Oficial

## Fórmulas Oficiales

### Cálculos Principales

```
1. Retención Contable = Comisión Vida × 16% (SOLO Vida)
2. Costo Dispersión = Comisión Sin Vida × 9% (SOLO Sin Vida)

3. Base ISR Vida = Comisión Vida - Retención Contable
4. ISR Vida = Base ISR Vida × 10%

5. Base ISR Daños = Comisión Sin Vida - Costo Dispersión
6. ISR Daños = Base ISR Daños × 10%

7. ISR Total = ISR Vida + ISR Daños

8. Total a Pagar = Comisión Total - Ret. Contable - Costo Dispersión - ISR Total
```

## Regla de Oro

**El ISR se calcula sobre la base DESPUÉS de restar los descuentos correspondientes:**
- ISR Vida: Base = Comisión Vida - Retención Contable
- ISR Daños: Base = Comisión Sin Vida - Costo Dispersión

## Ejemplo 1: Comisión Mixta

### Datos
```
Comisión Vida:      $5,000
Comisión Sin Vida:  $7,000
Total:             $12,000
```

### Paso 1: Retenciones y Dispersión
```
Retención Contable = 5,000 × 0.16 = $800
Costo Dispersión   = 7,000 × 0.09 = $630
```

### Paso 2: Bases ISR
```
Base ISR Vida  = 5,000 - 800   = $4,200
Base ISR Daños = 7,000 - 630   = $6,370
```

### Paso 3: Cálculo ISR
```
ISR Vida  = 4,200 × 0.10 = $420
ISR Daños = 6,370 × 0.10 = $637
ISR Total               = $1,057
```

### Paso 4: Total a Pagar
```
Total = 12,000 - 800 - 630 - 1,057 = $9,513
```

## Ejemplo 2: Caso Real

### Datos
```
Comisión Vida:      $544.20
Comisión Sin Vida: $14,263.87
Total:            $14,808.07
```

### Cálculos
```
Retención Contable = 544.20 × 0.16        = $87.07
Costo Dispersión   = 14,263.87 × 0.09     = $1,283.75

Base ISR Vida      = 544.20 - 87.07       = $457.13
ISR Vida           = 457.13 × 0.10        = $45.71

Base ISR Daños     = 14,263.87 - 1,283.75 = $12,980.12
ISR Daños          = 12,980.12 × 0.10     = $1,298.01

ISR Total          = 45.71 + 1,298.01     = $1,343.72

Total a Pagar      = 14,808.07 - 87.07 - 1,283.75 - 1,343.72 = $12,093.53
```

## Archivos Modificados

1. **src/lib/commissionFiscalCalculations.ts**
   - Función `calcularAsimilados()` actualizada
   - Fórmulas documentadas en comentarios

2. **src/lib/commissionFiscalCalculations.test.ts**
   - Tests agregados para validar cálculos de ASIMILADOS
   - Tests: Solo Vida, Solo Sin Vida, Mixto

## Pruebas Unitarias

Se agregaron 3 tests para ASIMILADOS:
- `testAsimiladosSoloVida()`: Valida cálculo solo con Vida
- `testAsimiladosSoloSinVida()`: Valida cálculo solo con Daños
- `testAsimiladosMixto()`: Valida cálculo mixto Vida + Daños

Para ejecutar los tests:
```typescript
import { runAllAsimiladosTests } from './commissionFiscalCalculations.test';
runAllAsimiladosTests();
```

## Impacto

Este cambio afecta **únicamente** al PDF fiscal de ASIMILADOS en la página "Mis Comisiones".

Los otros regímenes (RESICO y HONORARIOS) mantienen sus fórmulas sin cambios.
