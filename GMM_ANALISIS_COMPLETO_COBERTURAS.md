# Análisis Completo: Coberturas Adicionales GMM BX+

## 🎯 Problema Identificado

Las **coberturas adicionales** generan primas **85% menores** de lo correcto:

| Asegurado | Prima Base ✓ | Prima Adicionales | Esperado | Diferencia |
|-----------|-------------|-------------------|----------|------------|
| Hombre 40 | $11,509.57  | $1,047.37 ❌     | $7,094.43 | -85.2% |
| Mujer 39  | $14,595.59  | $1,328.20 ❌     | $8,996.64 | -85.2% |
| Mujer 1   | $6,043.98   | $550.00 ❌       | $3,725.47 | -85.2% |

## 🔍 Ingeniería Inversa - Hallazgos Clave

### 1. **Ratio Perfecto: 61.64%**

```
TODOS los asegurados tienen EXACTAMENTE el mismo ratio:
  Prima Adicionales / Prima Base = 0.616394 (61.64%)

Variación entre asegurados: 0.00%
```

**Conclusión**: Los factores de coberturas adicionales **NO dependen de edad/sexo**.

### 2. **Suma de Factores Objetivo**

Para que las primas coincidan con el Excel, la suma de los 5 factores de coberturas debe ser:

```
coef_medicamentos +
coef_vip +
coef_emergencia_ext +
factor_eliminacion_deducible_35000 +
factor_multiregion_QUERETARO

= 0.616394
```

### 3. **Distribución Estimada**

Si Multiregión es la cobertura más grande (típico 30-40%):
- **Multiregión**: ~0.2157 (21.57%)
- **Otras 4**: ~0.1002 cada una (10.02%)

## 📊 Mapeo de Valores Excel

### Coeficientes Simples (valores únicos)

| Cobertura | Celda Excel | Rango en Código | Debe Ser ~|
|-----------|-------------|-----------------|-----------|
| Medicamentos Fuera | `Tarifa!AJ3` | `coef_medicamentos` | 0.10 |
| VIP | `Tarifa!BI3` | `coef_vip` | 0.10 |
| Emergencia Extranjero | `Tarifa!AW3` | `coef_emergencia_ext` | 0.10 |
| Antigüedad | `Tarifa!BI7` | `coef_antiguedad` | N/A (no activa) |
| Ayuda Diaria | `Tarifa!BC3` | `coef_ayuda_diaria` | N/A (no activa) |

### Tablas de Factores

| Cobertura | Rango Excel | Código | Nota |
|-----------|-------------|--------|------|
| Eliminación Deducible | `Tarifa!AW15:AW23` | `deducible_accidente_factors` | Buscar valor para deducible 35000 |
| Multiregión | `Tarifa!AQ42:AS74` | `multiregion_carga_sistema` | **3 columnas**: col_0 (Estado), col_1 (?), col_2 (?) |
| Cobertura Internacional | `Tarifa!AY42:BA76` | `cobertura_internacional_carga_sistema` | No activa |

### Gastos y Cargas

| Concepto | Celda Excel | Valor Objetivo |
|----------|-------------|----------------|
| Gastos Expedición | `Cotizacion!O67` | **$300** por asegurado |
| IVA | `Cotizacion!O69` | 0.16 (16%) ✓ |

## 🔧 Problema Probable #1: Columna Incorrecta en Multiregión

El código actualmente usa:

```typescript
// Línea 369-371 en gmmCalculationEngineV2.ts
const row = tables.multiregion_carga_sistema.find(r => r.col_0 === input.estado);
if (row) {
  return roundTo5Decimals(Number(row.col_2 || 0)); // ← USA col_2
}
```

**Hipótesis**: La tabla `AQ42:AS74` tiene 3 columnas:
- `col_0`: Estado (QUERETARO, CDMX, etc.)
- `col_1`: **Factor correcto** (~0.20)
- `col_2`: Otro valor (menor) ← **se está usando este por error**

**Solución**: Cambiar a `row.col_1`

## 🔧 Problema Probable #2: Gastos de Expedición

El Excel muestra:
- 3 asegurados × $300 = $900

El código usa:
- Valor de `Cotizacion!O67`

**Acción**: Verificar que la celda `O67` tenga `300` (no `150`)

## ✅ Acciones Requeridas

### Paso 1: Abrir el Diagnóstico HTML

1. Navegar a: `http://localhost:5173/diagnostico-gmm-tarifas-coberturas.html`
2. Click en "🚀 Ejecutar Diagnóstico"
3. Anotar los valores actuales de:
   - `coef_medicamentos`
   - `coef_vip`
   - `coef_emergencia_ext`
   - `factor_deducible_35000`
   - `multiregion QUERETARO` (col_1 y col_2)
   - `gastos_expedicion`

### Paso 2: Abrir el Excel de Tarifas Original

Verificar MANUALMENTE estos valores en el Excel:

```
Tarifa!AJ3  (coef_medicamentos)      = ?
Tarifa!BI3  (coef_vip)               = ?
Tarifa!AW3  (coef_emergencia_ext)    = ?

Tarifa!AW15:AW23 (deducible_accidente_factors)
  Buscar fila con deducible 35000    = ?

Tarifa!AQ42:AS74 (multiregion_carga_sistema)
  Buscar fila con QUERETARO
    Columna A (Estado)                = QUERETARO
    Columna B (col_1)                 = ?
    Columna C (col_2)                 = ?

Cotizacion!O67 (gastos_expedicion)    = ?
```

### Paso 3: Calcular la Suma

Sumar los 5 valores:
```
SUMA = coef_medicamentos + coef_vip + coef_emergencia_ext +
       factor_deducible_35000 + factor_multiregion

¿La SUMA es 0.616394?
```

Si NO:
- Identificar cuál columna de multiregión usar (col_1 o col_2)
- O hay un error en la carga del Excel

### Paso 4: Aplicar Corrección

**Opción A**: Si el problema es la columna de multiregión:

```typescript
// En gmmCalculationEngineV2.ts línea 371
// CAMBIAR DE:
return roundTo5Decimals(Number(row.col_2 || 0));

// A:
return roundTo5Decimals(Number(row.col_1 || 0));
```

**Opción B**: Si los valores del Excel son incorrectos:
- Re-subir el Excel correcto usando la interfaz de GMMTarifasAdmin

**Opción C**: Si gastos_expedicion es incorrecto:
- Actualizar la celda `Cotizacion!O67` en el Excel a `300`
- Re-subir el Excel

## 🧪 Validación

Después de aplicar la corrección, probar con los datos conocidos:

```javascript
// Hombre 40, QUERETARO, PLUS, ORO-110000, SA 50M, DED 35000, COAS 15%
// Con: Medicamentos, Elim.Deducible, Multiregión, VIP, Emergencia

Prima Base = $11,509.57

Prima Adicionales Esperada = $7,094.43
  = $11,509.57 × 0.616394

Validar que cada cobertura individual sume:
  Medicamentos:     $11,509.57 × factor_med  = $X
  VIP:              $11,509.57 × factor_vip  = $Y
  Emergencia:       $11,509.57 × factor_emerg = $Z
  Elim.Deducible:   $11,509.57 × factor_ded  = $W
  Multiregión:      $11,509.57 × factor_multi = $Q
  ───────────────────────────────────────────────
  SUMA:             $X + $Y + $Z + $W + $Q = $7,094.43 ✓
```

## 📝 Resumen

**Estado Actual:**
- ✅ Prima Base: Correcta
- ❌ Prima Adicionales: 85% menor
- ❌ Gastos Expedición: Posiblemente 50% menor

**Causa Raíz:**
- Los factores de coberturas suman mucho menos que 0.616394
- Posiblemente usando la columna incorrecta en multiregion (col_2 vs col_1)
- O los valores en el Excel cargado no son los correctos

**Solución:**
1. Verificar valores en Excel original
2. Comparar con valores en BD (usando diagnóstico HTML)
3. Cambiar columna de multiregion de col_2 a col_1
4. O re-subir Excel con valores correctos

**Impacto Esperado:**
- Prima Adicionales aumentará de ~$1,047 a $7,094 ✓
- Total Cotización aumentará de ~$41,209 a $61,324 ✓
