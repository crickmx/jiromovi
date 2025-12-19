# Cálculo ISR para ASIMILADOS - Actualizado

## Cambio Implementado

Se actualizó el cálculo del ISR para el régimen fiscal **ASIMILADOS** en el PDF de comisiones.

## Fórmulas Actualizadas

### Antes (Incorrecto)
```
ISR Vida = (Comisión Vida - Retención Contable) × 10%
ISR Daños = (Comisión Daños - Costo Dispersión) × 10%
```

### Ahora (Correcto)
```
ISR Vida = Comisión Vida × 10%
ISR Daños = Comisión Daños × 10%
```

## Explicación

El ISR para ASIMILADOS ahora se calcula directamente sobre:
- **ISR de Vida**: 10% de la comisión de Vida **SIN** restar la retención contable
- **ISR de Daños**: 10% de la comisión de Daños **SIN** restar el costo de dispersión

## Ejemplo de Cálculo

### Caso: Comisión Mixta
```
Comisión Vida:      $5,000
Comisión Sin Vida:  $7,000
Total:             $12,000
```

### Retenciones y Dispersión
```
Retención Contable = 5,000 × 16% = $800
Costo Dispersión   = 7,000 × 9%  = $630
```

### ISR (Nueva Fórmula)
```
ISR Vida  = 5,000 × 10% = $500
ISR Daños = 7,000 × 10% = $700
ISR Total              = $1,200
```

### Total a Pagar
```
Total = 12,000 - 800 - 630 - 1,200 = $9,370
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
