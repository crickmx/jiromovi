# 🚨 PROBLEMA CRÍTICO GMM BX+ - Cálculo de Primas

## ❌ Análisis del PDF GMM-2025-00014

### Comparación: Valores Generados vs Correctos

| Asegurado | Prima Base | Prima Adic. Generada | Prima Adic. Correcta | Diferencia |
|-----------|-----------|---------------------|---------------------|------------|
| Hombre 40 | $11,509.57 | $57,547.85 ❌ | $7,094.43 ✓ | +$50,453 (711%) |
| Mujer 39 | $14,595.59 | $72,977.95 ❌ | $8,996.64 ✓ | +$63,981 (711%) |
| Mujer 1 | $6,043.98 | $30,219.90 ❌ | $3,725.47 ✓ | +$26,494 (711%) |

### Totales de la Cotización

| Concepto | Valor Generado | Valor Correcto | Diferencia |
|----------|---------------|---------------|------------|
| Prima Neta Total | $192,894.84 | $51,965.68 | +$140,929 (271%) |
| Gastos Expedición | $900.00 | $900.00 | ✓ OK |
| Subtotal | $193,794.84 | $52,865.68 | +$140,929 |
| IVA (16%) | $31,007.17 | $8,458.51 | +$22,549 |
| **TOTAL A PAGAR** | **$224,802.01** ❌ | **$61,324.20** ✓ | **+$163,478 (266%)** |

## 🔍 Causa Raíz

Los **coeficientes de coberturas adicionales** en la base de datos están **multiplicados por ~8.12x**.

### Fórmula Correcta (del Excel)

```
Prima Adicional = Prima Base Con Cargas × Suma de Coeficientes

Donde Suma de Coeficientes = 0.616394 (61.64%)
```

Desglose de las 5 coberturas activas en el PDF:
1. **Medicamentos Fuera** ≈ 0.12 (12%)
2. **VIP** ≈ 0.05 (5%)
3. **Emergencia Extranjero** ≈ 0.08 (8%)
4. **Eliminación Deducible (35k)** ≈ ? (por verificar)
5. **Multiregión (QRO)** ≈ ? (por verificar)

**Suma esperada:** 0.616394

### Problema Actual

```
Ratio Actual = Prima Adicional / Prima Base
            = $57,547.85 / $11,509.57
            = 5.0000 (500%)
```

**Esto indica que la suma de coeficientes en la BD es ~5.0 en lugar de 0.616394**

**Factor de error: 5.0 / 0.616394 = 8.11x**

## 🛠️ Soluciones

### Opción 1: Re-subir Excel Original ⭐ RECOMENDADO

1. Abrir: **Administración → Tarifas GMM**
2. Click: **"Subir Nuevo Paquete de Tarifas"**
3. Seleccionar: `unikuzdic25.xlsm`
4. **Verificar que el parser no multiplique valores**
5. Activar el paquete
6. Crear cotización de prueba

### Opción 2: Corregir con Script SQL

**IMPORTANTE: HACER BACKUP ANTES**

```sql
-- 1. Obtener el ID del paquete activo
SELECT id, name FROM tariff_packages WHERE status = 'active';

-- 2. Verificar valores actuales (anota estos valores)
SELECT table_key, data_json->0->'col_0' as valor
FROM tariff_tables
WHERE tariff_package_id = '<ID_PAQUETE>'
  AND table_key IN (
    'coef_medicamentos',
    'coef_vip',
    'coef_emergencia_ext'
  );

-- 3. Calcular factor de corrección
-- Factor = 0.616394 / (suma_actual_de_coeficientes)
-- Por ejemplo, si suma_actual = 5.0, entonces:
-- Factor = 0.616394 / 5.0 = 0.123279

-- 4. Aplicar corrección (SUSTITUIR <FACTOR> y <ID_PAQUETE>)
UPDATE tariff_tables
SET data_json = jsonb_set(
  data_json,
  '{0,col_0}',
  to_jsonb((data_json->0->>'col_0')::numeric * <FACTOR>)
)
WHERE tariff_package_id = '<ID_PAQUETE>'
  AND table_key IN (
    'coef_medicamentos',
    'coef_vip',
    'coef_emergencia_ext',
    'coef_preexistentes',
    'coef_complicaciones',
    'coef_antiguedad',
    'coef_ayuda_diaria',
    'coef_ampliacion_servicios',
    'coef_enf_graves_ext'
  );

-- 5. Corregir array de factores de deducible
UPDATE tariff_tables
SET data_json = (
  SELECT jsonb_agg(
    ((item)::numeric * <FACTOR>)::text::jsonb
  )
  FROM jsonb_array_elements_text(data_json) AS item
)
WHERE tariff_package_id = '<ID_PAQUETE>'
  AND table_key = 'deducible_accidente_factors';

-- 6. Corregir tabla multiregión (solo col_1)
UPDATE tariff_tables
SET data_json = (
  SELECT jsonb_agg(
    jsonb_set(
      elem,
      '{col_1}',
      to_jsonb((elem->>'col_1')::numeric * <FACTOR>)
    )
  )
  FROM jsonb_array_elements(data_json) AS elem
)
WHERE tariff_package_id = '<ID_PAQUETE>'
  AND table_key = 'multiregion_carga_sistema';

-- 7. Verificar corrección
SELECT table_key, data_json->0->'col_0' as valor_corregido
FROM tariff_tables
WHERE tariff_package_id = '<ID_PAQUETE>'
  AND table_key IN (
    'coef_medicamentos',
    'coef_vip',
    'coef_emergencia_ext'
  );
```

### Opción 3: Usar Herramienta de Diagnóstico

```
1. Abrir: http://localhost:5173/diagnostico-gmm-calculo-detallado.html
2. Click: "Diagnosticar Coeficientes en BD"
3. Revisar:
   - Valores actuales
   - Valores correctos
   - Factor de corrección calculado
   - Script SQL generado automáticamente
4. Copiar y ejecutar el script SQL
```

## ✅ Validación Post-Corrección

### Caso de Prueba

**Configuración (idéntica al PDF):**
- Estado: QUERETARO
- Nivel: PLUS
- Tabulador: ORO-110,000
- Suma Asegurada: 50,000,000
- Deducible: 35,000
- Coaseguro: 15%
- Tope Coaseguro: $60,000
- Asegurados: Hombre 40, Mujer 39, Mujer 1
- **Coberturas activas:**
  - ✓ Medicamentos Fuera
  - ✓ Eliminación Deducible por Accidente
  - ✓ Multiregión
  - ✓ VIP
  - ✓ Emergencia Médica Extranjero

### Resultados Esperados

| Asegurado | Prima Base | Prima Adicional | Prima Total |
|-----------|-----------|-----------------|-------------|
| Hombre 40 | $11,509.57 | $7,094.43 | $18,604.00 |
| Mujer 39 | $14,595.59 | $8,996.64 | $23,592.23 |
| Mujer 1 | $6,043.98 | $3,725.47 | $9,769.45 |

**Totales:**
```
Prima Neta Total:      $51,965.68
Gastos de Expedición:  $900.00
Subtotal:              $52,865.68
IVA (16%):             $8,458.51
───────────────────────────────
Total a Pagar:         $61,324.20 ✓
```

### Fórmula de Verificación

```javascript
// Para CUALQUIER configuración:
const ratio = primaAdicional / primaBase;

// Con las 5 coberturas activas del PDF:
console.log('Ratio esperado:', 0.616394);
console.log('Ratio actual:', ratio);
console.log('Diferencia:', Math.abs(ratio - 0.616394));

// ✅ Pasa si: diferencia < 0.001
```

### Checklist de Validación

- [ ] Suma de coeficientes = 0.616394 ± 0.001
- [ ] Prima Adicional ≈ 61.64% de Prima Base
- [ ] Total de cotización coincide con Excel
- [ ] Crear 3 cotizaciones diferentes y verificar ratios
- [ ] Comparar PDFs antiguos vs nuevos

## 📊 Análisis del Parser (Causa Probable)

El problema puede estar en el **parser del Excel** (`gmm-upload-tariff` edge function):

```typescript
// ❌ INCORRECTO: Si el parser está multiplicando valores
const coefficient = parseFloat(cell.v) * someMultiplier; // ← Buscar esto

// ✅ CORRECTO: Parser debe usar valores directos
const coefficient = parseFloat(cell.v); // ← Sin multiplicadores
```

**Archivos a revisar:**
1. `supabase/functions/gmm-upload-tariff/index.ts`
2. Buscar funciones que procesen coeficientes
3. Verificar que NO haya multiplicadores adicionales

## 🎯 Conclusión

**Estado del código:** ✅ CORRECTO
- Motor de cálculo (`gmmCalculationEngineV2.ts`) implementa correctamente las fórmulas del Excel
- Generador de PDF muestra correctamente los valores calculados

**Problema:** ❌ DATOS INCORRECTOS
- Los coeficientes en la tabla `tariff_tables` están multiplicados por ~8x
- Esto causa que las primas adicionales sean 5x más altas

**Solución inmediata:**
1. Usar herramienta de diagnóstico para calcular factor de corrección
2. Aplicar script SQL de corrección
3. Validar con cotización de prueba

**Solución definitiva:**
1. Re-subir Excel original
2. Verificar parser no multiplique valores
3. Implementar validación automática post-carga

---

**Archivos relacionados:**
- `diagnostico-gmm-calculo-detallado.html` - Herramienta de diagnóstico
- `GMM_DIAGNOSTICO_Y_SOLUCION_DEFINITIVA.md` - Análisis previo
- `report.md` - Análisis del Excel original
