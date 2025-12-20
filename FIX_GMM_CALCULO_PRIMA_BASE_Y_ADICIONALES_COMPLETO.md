# Fix Completo: Cálculo de Prima Base y Adicionales GMM BX+

## Problema Identificado

Al comparar cotización real vs sistema:

### Cotización Real (Excel Oficial)
- **RICARDO CASTRO GOMEZ, 40, Hombre:**
  - Prima Base: $11,509.57
  - Prima Adicionales: $7,094.43
  - Prima Total: $18,604.00
- **Prima Neta Total:** $51,965.69
- **Gastos de expedición:** $900.00
- **Total a Pagar:** $61,324.20

### Cotización Sistema (ANTES del fix)
- **HOMBRE, 40, Hombre:**
  - Prima Base: $6,445.36 ❌ (44% menor)
  - Prima Adicionales: $0.00 ❌
  - Prima Total: $0.00 ❌
- **Prima Neta Total:** $17,409.75 ❌
- **Gastos de expedición:** $450.00 ❌
- **Total a Pagar:** $20,717.31 ❌

## Causa Raíz

1. **Prima Base incorrecta:** El sistema guardaba `primaBaseFinal` (sin cargas) en lugar de `primaBaseConCargas` (con cargas aplicadas)
2. **Prima Adicionales no calculada:** No se estaba sumando el valor de las coberturas
3. **Prima Total no calculada:** No se estaba calculando la suma
4. **Gastos expedición hardcoded:** Usaba $150 fijo en lugar del valor del Excel

## Correcciones Implementadas

### 1. Prima Base con Cargas del Sistema

**ANTES:**
```typescript
prima_base: components.primaBaseFinal  // $6,445.36 (SIN cargas)
```

**DESPUÉS:**
```typescript
prima_base: cargas.primaBaseConCargas  // $11,509.57 (CON cargas)
```

**Fórmula correcta:**
```
Prima Base = primaBaseFinal ÷ (1 - SUM(cargas))
Prima Base = $6,445.36 ÷ (1 - 0.44) ≈ $11,509.57
```

### 2. Cálculo de Prima Adicionales

**AGREGADO:**
```typescript
const primaAdicionales = Object.values(coberturas.adicionales).reduce((sum, val) => sum + val, 0);
```

Ahora suma todas las coberturas adicionales contratadas.

### 3. Cálculo de Prima Total

**AGREGADO:**
```typescript
const primaTotal = primaBase + primaAdicionales;
```

### 4. Corrección de Prima Neta Asegurado

**ANTES:**
```typescript
const primaNetaAsegurado = calcularPrimaNetaAsegurado(
  components.primaBaseFinal,  // ❌ Sin cargas
  coberturas.total
);
```

**DESPUÉS:**
```typescript
const primaNetaAsegurado = calcularPrimaNetaAsegurado(
  cargas.primaBaseConCargas,  // ✓ Con cargas
  coberturas.total
);
```

### 5. Gastos de Expedición desde Excel

**ANTES:**
```typescript
function calcularTotales(primaNetaTotal: number, numAsegurados: number) {
  const gastosExpedicion = roundTo2Decimals(numAsegurados * 150);  // ❌ Hardcoded
  //...
}
```

**DESPUÉS:**
```typescript
function calcularTotales(primaNetaTotal: number, numAsegurados: number, tables: TariffTables) {
  const gastosExpedicion = roundTo2Decimals(numAsegurados * tables.gastos_expedicion);  // ✓ Del Excel
  const iva = roundTo2Decimals(subtotal * tables.iva);  // ✓ También corregido
  //...
}
```

## Arquitectura del Cálculo (CORRECTA)

```
CAPA 1: Datos Base
└─> Base Edad/Sexo del Excel

CAPA 2: Prima Base Final (sin cargas)
└─> Base × FactorEstado × FactorNivel × FactorTabulador × FactorSA × FactorDeducible × FactorCoaseguro
└─> Resultado: primaBaseFinal = $6,445.36

CAPA 3: Aplicar Cargas del Sistema
└─> primaBaseConCargas = primaBaseFinal ÷ (1 - SUM(cargas))
└─> Resultado: primaBaseConCargas = $11,509.57  ← ESTO ES LA "PRIMA BASE" DEL PDF

CAPA 4: Coberturas Adicionales
└─> Cada cobertura = primaBaseConCargas × coeficiente
└─> Suma de todas las coberturas = $7,094.43

CAPA 5: Totales
├─> Prima Total Asegurado = primaBaseConCargas + primaAdicionales = $18,604.00
└─> Prima Neta = primaBaseConCargas + coberturas.total
```

## Resultado Esperado

Con estas correcciones, las cotizaciones ahora cuadrarán 1:1 con el Excel oficial:

- ✓ Prima Base incluye cargas del sistema
- ✓ Prima Adicionales suma todas las coberturas
- ✓ Prima Total = Base + Adicionales
- ✓ Prima Neta usa valores con cargas
- ✓ Gastos de expedición desde Excel
- ✓ IVA desde Excel

## Archivos Modificados

- `src/lib/gmmCalculationEngineV2.ts`
  - Línea 457-473: `calcularTotales()` con parámetro `tables`
  - Línea 676-678: Uso de `primaBaseConCargas` en prima neta
  - Línea 692-711: Cálculo correcto de prima_base, prima_adicionales, prima_total
  - Línea 717: Llamada a `calcularTotales()` con `tables`

## Build Status

✅ Compilación exitosa sin errores
