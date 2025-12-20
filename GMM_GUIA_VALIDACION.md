# Guía de Validación GMM BX+ Motor V2

## Checklist de Validación

### ✅ Antes de Desplegar

- [ ] El proyecto compila sin errores (`npm run build`)
- [ ] Las tablas de tarifas están cargadas en Supabase
- [ ] Al menos 3 casos de prueba validados contra Excel

---

## Validación Rápida (5 minutos)

### Caso 1: Básico

**Parámetros:**
- **Asegurado:** Hombre, 30 años
- **Estado:** Aguascalientes
- **Nivel hospitalario:** Estándar
- **Tabulador:** 1
- **Suma asegurada:** $5,000,000
- **Deducible:** $20,000
- **Coaseguro:** 10%
- **Coberturas:** Ninguna

**Pasos:**
1. Abrir cotizador GMM
2. Llenar los datos anteriores
3. Clic en "Calcular"
4. Comparar prima neta con Excel

**¿Qué validar?**
- Prima base por asegurado
- Prima neta total
- Gastos de expedición
- IVA
- Total con IVA

**Tolerancia:** ≤ $0.01

---

### Caso 2: Con Coberturas

**Parámetros:**
- **Asegurado:** Mujer, 45 años
- **Estado:** CDMX
- **Nivel hospitalario:** Premium
- **Tabulador:** 2
- **Suma asegurada:** $10,000,000
- **Deducible:** $50,000
- **Coaseguro:** 20%
- **Coberturas:**
  - ✅ Medicamentos fuera
  - ✅ VIP
  - ✅ Emergencia médica extranjero

**¿Qué validar?**
- Prima base correcta
- Cada cobertura calculada correctamente
- Prima neta = prima base + coberturas
- Total final

---

### Caso 3: Familia

**Parámetros:**
- **Asegurado 1:** Hombre, 35 años (Titular)
- **Asegurado 2:** Mujer, 32 años (Cónyuge)
- **Asegurado 3:** Niño, 5 años (Hijo)
- **Estado:** Jalisco
- **Nivel hospitalario:** Estándar Plus
- **Tabulador:** 1
- **Suma asegurada:** $7,500,000
- **Deducible:** $30,000
- **Coaseguro:** 15%
- **Coberturas:** Padecimientos preexistentes

**¿Qué validar?**
- Prima de cada asegurado
- Suma correcta de primas
- Gastos de expedición (3 × $150 = $450)
- Total final

---

## Modo Debug

### Activar en Desarrollo

```typescript
// En GMMCotizador.tsx, buscar la llamada a calculateQuote
const resultado = calculateQuote(quoteInput, tariffTables);
```

Cambiar temporalmente a:

```typescript
const resultado = calculateQuote(quoteInput, tariffTables, true); // debug = true
```

### Leer Logs

Abrir consola del navegador (F12) y buscar:

```
[DEBUG] Asegurado 1 - Juan Pérez: {
  capa1_datosBase: { ... },
  capa2_primaBaseFinal: 2500.00,
  capa3_cargas: { ... },
  ...
}
```

### Comparar Paso a Paso con Excel

| Paso | Excel | Sistema | ¿Coincide? |
|------|-------|---------|------------|
| Base edad/sexo | 1500.00 | 1500.00 | ✅ |
| Factor estado | 1.05 | 1.05 | ✅ |
| Factor nivel | 1.20 | 1.20 | ✅ |
| ... | ... | ... | ... |
| Prima base final | 2500.00 | 2500.00 | ✅ |
| Prima con cargas | 2800.00 | 2800.00 | ✅ |
| Cobertura VIP | 150.00 | 150.00 | ✅ |
| Prima neta | 2950.00 | 2950.00 | ✅ |

---

## Errores Comunes

### Error: "Valor no encontrado en tabla"

**Síntoma:**
```
[CAPA 1 - LOOKUP] Valor "Aguascalientes" no encontrado en tabla "Factor Estado"
```

**Solución:**
1. Verificar que las tablas estén cargadas en Supabase
2. Verificar el formato del valor (mayúsculas, acentos, espacios)
3. Verificar que la tabla tenga el valor esperado

---

### Error: "Denominador inválido"

**Síntoma:**
```
[CAPA 3 - CARGAS] Denominador inválido: -0.05
```

**Causa:** La suma de cargas es ≥ 1

**Solución:**
1. Revisar la tabla `denominador_cargas` en Supabase
2. Las cargas deben ser porcentajes < 1 (ej: 0.10, 0.05, 0.03)
3. La suma de todas las cargas debe ser < 1

---

### Error: "Factor = 0"

**Síntoma:**
```
[VALIDACIÓN] Factor "factorEstado" = 0 (debe ser > 0)
```

**Causa:** Un factor no se encontró o es inválido

**Solución:**
1. Verificar que el valor buscado existe en la tabla
2. Verificar que la celda en Excel no está vacía
3. Verificar que el valor es numérico (no texto)

---

## Validación de Tablas en Supabase

### Verificar que las Tablas Existan

```sql
SELECT table_key, jsonb_array_length(data_json) as rows
FROM gmm_tariff_tables
WHERE producto = 'BX+'
ORDER BY table_key;
```

**Resultado esperado:**
- `base_intermedia_edad_sexo`: ~80 filas (edades 0-80)
- `factor_estado`: ~32 filas (32 estados)
- `factor_nivel_hospitalario`: ~4 filas
- `factor_tabulador`: ~3 filas
- `factor_suma_asegurada`: ~8 filas
- `factor_deducible`: ~6 filas
- `factor_coaseguro`: ~4 filas
- `denominador_cargas`: 3-5 valores

### Verificar Coeficientes

```sql
SELECT table_key, data_json->0->'col_0' as coeficiente
FROM gmm_tariff_tables
WHERE table_key LIKE 'coef_%' AND producto = 'BX+'
ORDER BY table_key;
```

**Verificar:**
- Todos los coeficientes son numéricos
- Ningún coeficiente es NULL
- Los valores están en el rango esperado (0.01 - 2.00)

---

## Checklist de Regresión

Antes de cada actualización, validar que:

- [ ] Las 3 cotizaciones de prueba siguen generando los mismos valores
- [ ] El PDF se genera correctamente
- [ ] Las coberturas se muestran correctamente en el PDF
- [ ] Los totales cuadran con el Excel
- [ ] El modo debug muestra información coherente
- [ ] No hay errores en consola

---

## Reportar Discrepancias

Si encuentras una diferencia > $0.01:

1. **Activar modo debug**
2. **Anotar:**
   - Parámetros de entrada (edad, estado, coberturas, etc.)
   - Valor esperado (Excel)
   - Valor obtenido (sistema)
   - Logs de debug completos
3. **Comparar paso a paso** con Excel para identificar dónde divergen
4. **Verificar tablas** en Supabase

---

## Casos Edge

### Edad límite

- **Mínima:** 0 años (recién nacido)
- **Máxima:** 80 años

**Validar:**
- Sistema no acepta edades fuera de rango
- Error es claro: "Edad 85 no encontrada. Rango válido: 0 - 80 años"

### Coberturas sin coeficiente

Si una cobertura está seleccionada pero no tiene coeficiente en Supabase:

**Comportamiento esperado:**
- Coeficiente = 0
- Cobertura se muestra pero con valor $0.00
- No rompe el cálculo

### Tope de coaseguro fuera de rango

**Comportamiento esperado:**
- Sistema valida el rango antes de calcular
- Error: "Tope de coaseguro $500,000 fuera de rango. Para coaseguro 10%, el rango permitido es $50,000 - $300,000"

---

## Validación de Formas de Pago

**Fórmulas:**
- **Anual:** total × 1.00 (sin recargo)
- **Semestral:** (total × 1.03) / 2
- **Trimestral:** (total × 1.05) / 4
- **Mensual:** (total × 1.07) / 12

**Ejemplo:**
Si total anual = $10,000:
- Anual: $10,000
- Semestral: $5,150 × 2 = $10,300
- Trimestral: $2,625 × 4 = $10,500
- Mensual: $892 × 12 = $10,700 (aprox)

---

## Próximos Pasos

Una vez validado el motor:

1. Marcar esta guía como revisada
2. Guardar casos de prueba para regresión
3. Documentar cualquier caso especial encontrado
4. Actualizar esta guía si se agregan coberturas nuevas

---

**Fecha:** 2024-12-20
**Motor:** V2.0.0
**Estado:** Listo para validación
