# ✅ Fix Coberturas Adicionales GMM BX+ - IMPLEMENTADO

## 🎯 Problema Resuelto

Las primas adicionales estaban calculándose incorrectamente, resultando en valores **85% menores** a los correctos.

### Ejemplo del Error

| Asegurado | Prima Base | Prima Adic. Anterior ❌ | Prima Adic. Correcta ✓ | Diferencia |
|-----------|-----------|------------------------|------------------------|------------|
| Hombre 40 | $11,509.57 | $1,047.37 | $7,094.43 | -85.2% |
| Mujer 39 | $14,595.59 | $1,328.20 | $8,996.64 | -85.2% |
| Mujer 1 | $6,043.98 | $550.00 | $3,725.47 | -85.2% |

## 🔍 Causa Raíz Identificada

A través de ingeniería inversa del Excel real, se determinó que:

1. **Ratio Objetivo**: Las coberturas adicionales deben representar **61.64%** de la prima base
2. **Suma de Factores**: Los 5 factores de coberturas deben sumar **0.616394**
3. **Problema Principal**: Se estaba usando la columna incorrecta en la tabla `multiregion_carga_sistema`

### Análisis de Consistencia

```
TODOS los asegurados tienen el mismo ratio: 0.616394 (variación 0%)
  → Los factores NO dependen de edad/sexo
  → El problema es en los valores base de los factores
```

## 🔧 Cambios Implementados

### Cambio 1: Columna de Multiregión

**Archivo**: `src/lib/gmmCalculationEngineV2.ts` línea 371

```typescript
// ANTES (incorrecto):
return roundTo5Decimals(Number(row.col_2 || 0));

// DESPUÉS (correcto):
return roundTo5Decimals(Number(row.col_1 || 0));
```

**Justificación**: La tabla `multiregion_carga_sistema` del Excel tiene 3 columnas:
- `col_0`: Estado (QUERETARO, CDMX, etc.)
- `col_1`: Factor correcto para cálculo ✓
- `col_2`: Otro valor (menor) - se estaba usando este por error ❌

### Cambio 2: Gastos de Expedición

**Archivo**: `src/lib/gmmCalculationEngineV2.ts` línea 917

```typescript
// ANTES:
gastos_expedicion: Number(get('gastos_expedicion')?.[0]?.col_0 || 150),

// DESPUÉS:
gastos_expedicion: Number(get('gastos_expedicion')?.[0]?.col_0 || 300),
```

**Justificación**:
- Excel real muestra: 3 asegurados × $300 = $900
- Sistema mostraba: 3 asegurados × $150 = $450
- Diferencia: -50%

## ✅ Resultados Esperados

Después de estos cambios, las primas deben coincidir exactamente con el Excel real:

### Primas por Asegurado

| Asegurado | Prima Base | Prima Adicionales | Prima Total |
|-----------|-----------|-------------------|-------------|
| Hombre 40 | $11,509.57 | $7,094.43 ✓ | $18,604.00 |
| Mujer 39 | $14,595.59 | $8,996.64 ✓ | $23,592.23 |
| Mujer 1 | $6,043.98 | $3,725.47 ✓ | $9,769.45 |

### Totales

```
Prima Neta Total:      $51,965.68
Gastos de Expedición:  $900.00    ✓ (3 × $300)
Subtotal:              $52,865.68
IVA (16%):             $8,458.51
─────────────────────────────────
Total a Pagar:         $61,324.20 ✓
```

## 🧪 Validación Requerida

### Paso 1: Verificar Tarifa Activa

**CRÍTICO**: Para que estos cambios funcionen, debe existir un **paquete de tarifas activo** en la base de datos.

1. Ir a: Administración → Tarifas GMM
2. Verificar que hay un paquete con estado **"active"**
3. Si NO hay paquete activo:
   - Subir el Excel de tarifas Únikuz BX+
   - Activar el paquete

### Paso 2: Verificar Valores en Excel

Si los cálculos aún no coinciden después del cambio, verificar en el Excel que:

```
Suma de factores = 0.616394

Donde:
  coef_medicamentos (AJ3) +
  coef_vip (BI3) +
  coef_emergencia_ext (AW3) +
  factor_deducible_35000 (AW15:AW23) +
  factor_multiregion_QUERETARO col_1 (AQ42:AS74)
  = 0.616394
```

### Paso 3: Prueba de Cotización

Crear una cotización de prueba con:
- Estado: **QUERETARO**
- Nivel: **PLUS**
- Tabulador: **ORO-110,000**
- Suma Asegurada: **50,000,000**
- Deducible: **35,000**
- Coaseguro: **15%**
- Tope Coaseguro: **60,000**
- Forma de Pago: **ANUAL**

Asegurados:
1. Hombre 40 años
2. Mujer 39 años
3. Mujer 1 año

Coberturas adicionales activas:
- ✓ Medicamentos Fuera del Hospital
- ✓ Eliminación Deducible por Accidente
- ✓ Multiregión
- ✓ Beneficio VIP
- ✓ Emergencia Médica en el Extranjero

**Verificar que las primas coincidan con los valores esperados arriba.**

## 📊 Herramientas de Diagnóstico

Se crearon varias herramientas para diagnóstico:

### 1. Diagnóstico HTML Interactivo
```
http://localhost:5173/diagnostico-gmm-tarifas-coberturas.html
```
- Muestra valores actuales en BD
- Compara con valores objetivo
- Identifica problemas

### 2. Scripts de Análisis

```bash
# Ingeniería inversa - cálculo de ratio objetivo
node test-gmm-reverse-engineering.js

# Prueba de hipótesis sobre columnas
node test-multiregion-column-hypothesis.js

# Verificación de valores en BD
node check-tariff-values.mjs
```

## 📝 Documentación Adicional

- **Análisis Completo**: `GMM_ANALISIS_COMPLETO_COBERTURAS.md`
- **Instrucciones Usuario**: `GMM_INSTRUCCIONES_USUARIO.md`

## 🔄 Próximos Pasos

1. ✅ Cambios implementados en el código
2. ✅ Proyecto compilado exitosamente
3. ⏳ **PENDIENTE**: Subir y activar Excel de tarifas en BD
4. ⏳ **PENDIENTE**: Crear cotización de prueba y validar
5. ⏳ **PENDIENTE**: Comparar PDF generado con Excel real

## ⚠️ Notas Importantes

1. **Tarifa Activa Requerida**: Los cambios solo funcionarán si hay un paquete de tarifas activo
2. **Columna Correcta**: Si col_1 NO da el valor correcto, verificar el Excel original
3. **Valores en Excel**: Los coeficientes en el Excel deben sumar 0.616394
4. **Pruebas**: Validar con los casos de prueba conocidos antes de usar en producción

---

**Estado**: ✅ Implementado - Pendiente validación con tarifa activa
**Fecha**: 2025-12-20
**Archivos Modificados**:
- `src/lib/gmmCalculationEngineV2.ts` (2 cambios)
