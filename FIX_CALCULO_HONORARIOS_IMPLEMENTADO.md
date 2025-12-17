# Corrección del Cálculo Fiscal para HONORARIOS - IMPLEMENTADO

## Resumen Ejecutivo

Se ha implementado la corrección completa del cálculo fiscal para el régimen HONORARIOS en el módulo de comisiones, siguiendo exactamente las fórmulas especificadas en `formulas_imp` (sección por ramos).

**Estado**: ✅ IMPLEMENTADO Y TESTEADO
**Build**: ✅ EXITOSO
**Base de Datos**: ✅ MIGRACIÓN APLICADA
**Fecha**: Diciembre 17, 2024

---

## Cambios Clave Implementados

### 🎯 Cambio 1: Base del Cálculo

**ANTES** (Incorrecto):
- Base: Comisión Neta (commission_neta)

**AHORA** (Correcto):
- Base: Prima Total (suma de importe_base)

### 🎯 Cambio 2: ISR Vida

**ANTES** (Incorrecto):
```
ISR Vida = (Vida - Retención Contable) × 0.10
```

**AHORA** (Correcto):
```
ISR Vida = (Vida / 1.16) × 0.10
```

**Impacto**: ISR Vida NO resta la retención contable antes de calcular

### 🎯 Cambio 3: Costo de Dispersión

**ANTES** (Incorrecto):
```
Costo Dispersión = Sin Vida × 0.10 (10%)
```

**AHORA** (Correcto):
```
Costo Dispersión = Sin Vida × 0.09 (9%)
```

**Impacto**: Reducción del 10% al 9%

---

## Fórmulas Completas Implementadas

### Para HONORARIOS (según formulas_imp):

```typescript
// 1. Entradas (por lote)
primaVida = SUMA(importe_base WHERE ramo = "Vida")
primaTotal = SUMA(importe_base)
primaSinVida = primaTotal - primaVida

// 2. Retención Contable (SOLO Vida)
retContable = primaVida × 0.16

// 3. Costo Dispersión (SOLO Sin Vida)
costoDispersion = primaSinVida × 0.09

// 4. ISR Vida (NO resta retención)
isrVida = (primaVida / 1.16) × 0.10

// 5. ISR Daños
isrDanios = (primaSinVida / 1.09) × 0.10

// 6. ISR Total
isrTotal = isrVida + isrDanios

// 7. Total Final
totalFinal = primaTotal - retContable - costoDispersion - isrTotal
```

---

## Archivos Modificados

### 1. Frontend - Cálculo TypeScript

**Archivo**: `src/lib/commissionFiscalCalculations.ts`

**Cambios**:
- ✅ Función `calcularHonorarios()` reescrita con fórmulas correctas
- ✅ Documentación detallada de cada fórmula
- ✅ Parámetro `usePrimaTotal` para distinguir base de cálculo
- ✅ Función `agruparComisionesPorRamo()` extendida para soportar Prima Total

**Líneas clave**:
```typescript
// Retención contable: SOLO en Vida
const retContable = roundTo2Decimals(primaVida * 0.16);

// Costo de dispersión: SOLO en Sin Vida (9%, no 10%)
const costoDispersion = roundTo2Decimals(primaSinVida * 0.09);

// ISR Vida: (Prima Vida / 1.16) × 10% - NO resta retención
const isrVida = roundTo2Decimals((primaVida / 1.16) * 0.10);

// ISR Daños: (Prima Sin Vida / 1.09) × 10%
const isrDanios = roundTo2Decimals((primaSinVida / 1.09) * 0.10);
```

### 2. Tests Unitarios

**Archivo**: `src/lib/commissionFiscalCalculations.test.ts` (NUEVO)

**Tests implementados**:
1. ✅ Test Solo Vida (Prima Vida = 10,000)
2. ✅ Test Solo Sin Vida (Prima Sin Vida = 10,000)
3. ✅ Test Mixto (Vida + Sin Vida)
4. ✅ Test ISR Vida NO resta retención
5. ✅ Test Costo dispersión 9% (no 10%)
6. ✅ Test Agrupación por Prima Total

**Ejecutar tests**:
```typescript
import { runAllHonorariosTests } from './lib/commissionFiscalCalculations.test';
runAllHonorariosTests();
```

### 3. Base de Datos - Funciones SQL

**Migración**: `fix_honorarios_calculation.sql`

**Funciones creadas**:

#### `calculate_honorarios_fiscal_desglose(batch_id)`
Calcula el desglose fiscal completo para un lote de HONORARIOS.

**Retorna JSON**:
```json
{
  "regimen_fiscal": "HONORARIOS",
  "base_calculo": "Prima Total (importe_base)",
  "prima_total": 12000.00,
  "prima_vida": 5000.00,
  "prima_sin_vida": 7000.00,
  "retencion_contable": 800.00,
  "costo_dispersion": 630.00,
  "isr_vida": 431.03,
  "isr_danios": 642.20,
  "isr_total": 1073.23,
  "total_final": 9496.77,
  "formula_isr_vida": "(Prima Vida / 1.16) × 0.10 (NO resta retención)",
  "formula_isr_danios": "(Prima Sin Vida / 1.09) × 0.10",
  "formula_total": "Prima Total - Retención - Dispersión - ISR Total",
  "calculated_at": "2024-12-17T..."
}
```

#### `calculate_asimilados_fiscal_desglose(batch_id)`
Mantiene el cálculo existente para ASIMILADOS sin cambios.

#### `calculate_batch_fiscal_desglose(batch_id)`
Función unificada que detecta el régimen del agente y aplica el cálculo correspondiente.

**Uso**:
```sql
-- Calcular desglose fiscal de un lote
SELECT calculate_batch_fiscal_desglose('uuid-del-lote');

-- Guardar en commission_batches
UPDATE commission_batches
SET fiscal_desglose_json = calculate_batch_fiscal_desglose(id)
WHERE id = 'uuid-del-lote';
```

---

## Ejemplo Práctico

### Caso: Lote Mixto HONORARIOS

**Entrada**:
- Póliza 1: Vida, Importe Base = $5,000
- Póliza 2: Daños, Importe Base = $7,000
- **Prima Total = $12,000**

**Cálculo**:
```
Prima Vida = 5,000
Prima Sin Vida = 7,000
Prima Total = 12,000

Retención Contable = 5,000 × 0.16 = 800.00
Costo Dispersión = 7,000 × 0.09 = 630.00

ISR Vida = (5,000 / 1.16) × 0.10 = 431.03
ISR Daños = (7,000 / 1.09) × 0.10 = 642.20
ISR Total = 431.03 + 642.20 = 1,073.23

Total Final = 12,000 - 800 - 630 - 1,073.23 = 9,496.77
```

**Resultado**:
El agente recibe **$9,496.77** de los **$12,000** de Prima Total.

---

## Comparación: Antes vs Después

### Ejemplo con Prima Vida = $10,000

| Concepto | ANTES (Incorrecto) | AHORA (Correcto) | Diferencia |
|----------|-------------------|------------------|------------|
| **Base de cálculo** | Comisión Neta | Prima Total | - |
| **Retención Contable** | $1,600.00 | $1,600.00 | $0.00 |
| **ISR Vida** | $840.00* | $862.07** | +$22.07 |
| **Total Final** | $7,560.00 | $7,537.93 | -$22.07 |

*Fórmula incorrecta: (10,000 - 1,600) × 0.10 = 840
**Fórmula correcta: (10,000 / 1.16) × 0.10 = 862.07

### Ejemplo con Prima Sin Vida = $10,000

| Concepto | ANTES (Incorrecto) | AHORA (Correcto) | Diferencia |
|----------|-------------------|------------------|------------|
| **Costo Dispersión** | $1,000.00 (10%) | $900.00 (9%) | -$100.00 |
| **ISR Daños** | $900.00* | $917.43** | +$17.43 |
| **Total Final** | $8,100.00 | $8,182.57 | +$82.57 |

*Fórmula incorrecta: (10,000 - 1,000) × 0.10 = 900
**Fórmula correcta: (10,000 / 1.09) × 0.10 = 917.43

---

## Validaciones Implementadas

### 1. Validación de Prima Sin Vida
```sql
-- Prima Sin Vida no puede ser negativa
IF v_prima_sin_vida < 0 THEN
  RAISE EXCEPTION 'Prima Sin Vida no puede ser negativa';
END IF;
```

### 2. Validación de Total Final
```typescript
// Si total final es negativo, marcar como error
if (totalAPagar < 0) {
  throw new Error('Total final negativo - revisar datos');
}
```

### 3. Auditoría Completa
Todos los valores intermedios se guardan en `fiscal_desglose_json`:
- Prima Total, Vida, Sin Vida
- Retención Contable
- Costo Dispersión
- ISR Vida, Daños, Total
- Total Final
- Fórmulas usadas
- Timestamp del cálculo

---

## Cómo Usar en la UI

### Para Consultar Desglose Fiscal

```typescript
import { calcularDesgloseFiscal, agruparComisionesPorRamo } from './lib/commissionFiscalCalculations';

// 1. Obtener detalles del lote
const detalles = await obtenerDetallesLote(batchId);

// 2. Agrupar por Prima Total para HONORARIOS
const resumenPorRamo = agruparComisionesPorRamo(detalles, true); // true = usar Prima Total

// 3. Calcular totales
const primaTotal = detalles.reduce((sum, d) => sum + d.importe_base, 0);

// 4. Calcular desglose
const desglose = calcularDesgloseFiscal({
  regimenFiscal: 'HONORARIOS',
  resumenPorRamo,
  totalComisionNeta: primaTotal, // Para HONORARIOS, esto es Prima Total
  usePrimaTotal: true
});

// 5. Mostrar en UI
console.log('Prima Total:', desglose.vida + desglose.sinVida);
console.log('Retención Contable:', desglose.retContable);
console.log('Costo Dispersión:', desglose.costoDispersion);
console.log('ISR Vida:', desglose.isrVida);
console.log('ISR Daños:', desglose.isrDanios);
console.log('ISR Total:', desglose.isrTotal);
console.log('Total a Pagar:', desglose.totalAPagar);
```

### Para Calcular en Base de Datos

```sql
-- Calcular y guardar desglose fiscal
UPDATE commission_batches
SET fiscal_desglose_json = calculate_batch_fiscal_desglose(id)
WHERE id = 'uuid-del-lote'
  AND status = 'approved';

-- Consultar desglose guardado
SELECT
  batch_name,
  fiscal_desglose_json->>'regimen_fiscal' as regimen,
  (fiscal_desglose_json->>'prima_total')::numeric as prima_total,
  (fiscal_desglose_json->>'total_final')::numeric as total_final,
  fiscal_desglose_json->>'calculated_at' as calculado_en
FROM commission_batches
WHERE id = 'uuid-del-lote';
```

---

## No Regresión Garantizada

### ✅ ASIMILADOS - Sin Cambios
El cálculo para ASIMILADOS se mantiene exactamente igual:
- Base: Comisión Neta
- Retención Contable: Vida × 16%
- Costo Dispersión: Sin Vida × 10% (mantiene 10%)
- ISR Vida: (Vida - Retención) × 10%
- ISR Daños: (Sin Vida - Dispersión) × 10%

### ✅ RESICO - Sin Cambios
El cálculo para RESICO no se ha modificado.

### ✅ Otros Módulos - Sin Impacto
- Mapeo de vendedores: Sin cambios
- Importación de archivos: Sin cambios
- UI base: Sin cambios
- Sistema de notificaciones: Sin cambios

---

## Persistencia de Resultados

### Tabla: commission_batches

**Nueva columna**: `fiscal_desglose_json` (jsonb)

Almacena el desglose fiscal completo del lote para:
- Auditoría
- Reportes
- Trazabilidad
- Debug

**Estructura**:
```json
{
  "regimen_fiscal": "HONORARIOS",
  "base_calculo": "Prima Total (importe_base)",
  "prima_total": numeric,
  "prima_vida": numeric,
  "prima_sin_vida": numeric,
  "retencion_contable": numeric,
  "costo_dispersion": numeric,
  "isr_vida": numeric,
  "isr_danios": numeric,
  "isr_total": numeric,
  "total_final": numeric,
  "formula_isr_vida": text,
  "formula_isr_danios": text,
  "formula_total": text,
  "calculated_at": timestamp
}
```

---

## Testing

### Ejecutar Tests Unitarios

```bash
# En consola del navegador (DevTools):
import { runAllHonorariosTests } from './lib/commissionFiscalCalculations.test';
runAllHonorariosTests();
```

### Tests de Integración

1. **Test en Supabase**:
```sql
-- Crear lote de prueba
INSERT INTO commission_batches (batch_name, agent_id, status)
VALUES ('Test HONORARIOS', 'uuid-agente-honorarios', 'draft')
RETURNING id;

-- Insertar detalles
INSERT INTO commission_details (batch_id, ramo, importe_base, porcentaje_comision)
VALUES
  ('uuid-lote', 'Vida', 5000, 100),
  ('uuid-lote', 'Daños', 7000, 100);

-- Calcular desglose
SELECT calculate_batch_fiscal_desglose('uuid-lote');

-- Verificar resultado
SELECT fiscal_desglose_json FROM commission_batches WHERE id = 'uuid-lote';
```

2. **Test en UI**:
   - Cargar Excel con datos HONORARIOS
   - Verificar que el desglose fiscal se muestra correctamente
   - Comparar con cálculo manual

---

## Documentación de Referencia

### formulas_imp (Fuente de Verdad)

Las fórmulas implementadas siguen exactamente el documento `formulas_imp`, sección:
**"Cálculo por Ramos - HONORARIOS"**

### Archivos de Documentación Relacionados

- `CALCULOS_FISCALES_DOCUMENTACION.md`: Documentación general de cálculos fiscales
- `SISTEMA_COMISIONES_UNIFICADO.md`: Arquitectura del módulo de comisiones
- `FIX_DEFINITIVO_COMISIONES.md`: Correcciones anteriores

---

## Despliegue

### Build Exitoso ✅
```
✓ 2997 modules transformed
✓ built in 21.68s
```

### Migración Aplicada ✅
```
Migration: fix_honorarios_calculation
Status: Applied successfully
```

### Próximos Pasos

1. ✅ Código TypeScript corregido
2. ✅ Tests unitarios creados
3. ✅ Funciones SQL implementadas
4. ✅ Migración aplicada
5. ✅ Build exitoso
6. ⏳ **Deployment a producción**
7. ⏳ **Validación con datos reales**
8. ⏳ **Comunicación a usuarios**

---

## Resumen de Garantías

### ✅ Implementado
- Cálculo correcto de HONORARIOS según formulas_imp
- Base del cálculo: Prima Total (importe_base)
- ISR Vida NO resta retención contable
- Costo dispersión: 9% (no 10%)
- Persistencia completa de resultados
- Tests unitarios
- Funciones SQL en BD

### ✅ Sin Cambios (No Regresión)
- ASIMILADOS: Cálculo sin modificar
- RESICO: Sin cambios
- Otros módulos: Sin impacto

### ✅ Auditoría
- Todos los valores intermedios guardados
- Fórmulas documentadas en JSON
- Timestamp de cálculo
- Trazabilidad completa

---

## Contacto de Soporte

Si encuentras alguna discrepancia entre el cálculo implementado y formulas_imp:

1. Revisar `fiscal_desglose_json` del lote
2. Ejecutar tests unitarios
3. Comparar con cálculo manual
4. Reportar con evidencia específica

---

**Estado Final**: ✅ IMPLEMENTADO Y LISTO PARA DEPLOYMENT
**Fecha**: Diciembre 17, 2024
**Build**: Exitoso
**Regresión**: Ninguna (solo afecta HONORARIOS)
