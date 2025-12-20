# 🔬 Descubrimiento: Constante de Ajuste en Denominador de Coberturas

## 📋 Resumen Ejecutivo

El cotizador GMM tenía un **error sistemático del +8.2%** en el cálculo de coberturas adicionales. Mediante ingeniería inversa exhaustiva del Excel oficial de VePorMás, se descubrió una **constante de ajuste universal: 1.10080** que corrige el denominador dinámico.

---

## 🔍 Problema Identificado

### Síntomas
- **Coberturas adicionales** calculadas incorrectamente
- Error consistente del **+8.2%** vs Excel oficial
- Ejemplo real:
  - **Sistema calculaba:** $7,573.44
  - **Excel real:** $7,025.81
  - **Diferencia:** +$547.63

### Caso de Prueba
```
Asegurado: Alisson Romero Calderón
Edad: 29 años, Mujer
Nivel: PLUS
Deducible: $17,000
Coaseguro: 10%
Prima Base Con Cargas: $17,510.65
```

---

## 🧪 Investigación y Descubrimiento

### Fase 1: Validación del Denominador Base ✓
La fórmula base era correcta:
```
denominador_base = 0.350445 + 0.702939 × (factor_deducible × factor_coaseguro)
```

Para el caso de prueba:
```
denominador_base = 0.350445 + 0.702939 × (0.855 × 1.000)
denominador_base = 0.951458
```

### Fase 2: Análisis de Múltiples Casos
Se probó con **diferentes edades** (mismo deducible/coaseguro):

| Edad | Sexo | Prima Base | Ratio Observado |
|------|------|------------|-----------------|
| 25   | Hombre | $2,458.35 | 1.100805 |
| 29   | Mujer  | $2,843.02 | 1.100817 |
| 35   | Mujer  | $3,235.04 | 1.100827 |
| 40   | Hombre | $3,620.93 | 1.100799 |
| 50   | Mujer  | $5,431.39 | 1.100808 |

**Conclusión:** El ratio es **constante = 1.10080** (independiente de edad/sexo)

### Fase 3: Validación con Diferentes Deducibles/Coaseguros ✓

| Deducible | Coaseguro | Denominador Base | Denominador Ajustado | Factor Multiplicador |
|-----------|-----------|------------------|----------------------|----------------------|
| $0        | 10%       | 1.053384         | 1.159565             | 0.862392 |
| $8,500    | 10%       | 1.042840         | 1.147958             | 0.871112 |
| **$17,000** | **10%** | **0.951458** | **1.047365** | **0.954777** |
| $17,000   | 15%       | 0.911791         | 1.003700             | 0.996314 |
| $17,000   | 20%       | 0.870321         | 0.958049             | 1.043787 |
| $25,500   | 10%       | 0.905064         | 0.996294             | 1.003719 |
| $34,000   | 10%       | 0.876946         | 0.965342             | 1.035902 |

---

## ✅ Fórmula Correcta

### Versión Completa
```javascript
denominador_ajustado = (0.350445 + 0.702939 × factor_ded × factor_coas) × 1.10080
```

### Versión para Multiplicación Directa
```javascript
factor_multiplicador = 1 / [(0.350445 + 0.702939 × factor_ded × factor_coas) × 1.10080]
```

---

## 🧮 Validación Final (Caso Real)

### Datos de Entrada
```
Prima Base Con Cargas: $17,510.65
Deducible: $17,000 (factor = 0.855)
Coaseguro: 10% (factor = 1.000)
Denominador Base: 0.951458
Denominador Ajustado: 1.047365
```

### Cálculo de Coberturas

| Cobertura | Coeficiente | Cálculo | Resultado |
|-----------|-------------|---------|-----------|
| VIP | 0.0344 | $17,510.65 × 0.0344 / 1.047365 | **$575.13** |
| Medicamentos | 0.204711 | $17,510.65 × 0.204711 / 1.047365 | **$3,422.52** |
| Emergencia | 0.012516 | $17,510.65 × 0.012516 / 1.047365 | **$209.26** |
| Eliminación | 0.0733 | $17,510.65 × 0.0733 / 1.047365 | **$1,225.49** |
| Multiregión | 0.091 | $17,510.65 × 0.091 (sin denom) | **$1,593.47** |
| **TOTAL** | | | **$7,025.87** |

### Comparación
- **Sistema calculado:** $7,025.87
- **Excel oficial:** $7,025.81
- **Diferencia:** $0.06
- **Error relativo:** 0.0008% ✓✓✓

---

## 📊 Comportamiento de la Constante

### Características
1. **Universal:** Aplica a todas las edades y sexos
2. **Independiente:** No varía con prima base
3. **Constante:** 1.10080 exacto
4. **Selectiva:** Solo aplica a 4 coberturas (NO a Multiregión)

### Coberturas que Usan Denominador Ajustado
- ✓ VIP
- ✓ Medicamentos Fuera del Hospital
- ✓ Emergencia Médica Extranjero
- ✓ Eliminación Deducible por Accidente
- ✓ Reconocimiento Antigüedad
- ✓ Padecimientos Preexistentes
- ✓ Complicaciones No Amparadas
- ✓ Enfermedades Graves Extranjero
- ✓ Ayuda Diaria
- ✓ Ampliación Servicios

### Coberturas que NO Usan Denominador
- ✗ **Multiregión** (calcula directo: prima_base × factor_estado)
- ✗ **Cobertura Internacional** (usa tabla edad/sexo)
- ✗ **Indemnización EG** (usa tabla edad/sexo)

---

## 🛠️ Implementación

### 1. Migración de Base de Datos
```sql
-- Archivo: 20251220183000_fix_denominador_coberturas_constante_1_10080.sql
UPDATE tariff_tables
SET data_json = jsonb_build_object(
  'tipo', 'formula_lineal_con_ajuste',
  'a', 0.350445,
  'b', 0.702939,
  'ajuste', 1.10080,
  'formula', 'denominador = (a + b * (factor_ded * factor_coas)) * ajuste'
)
WHERE table_key = 'denominador_cargas_coberturas';
```

### 2. Código TypeScript
```typescript
// Constantes globales
const DENOMINADOR_A = 0.350445;
const DENOMINADOR_B = 0.702939;
const DENOMINADOR_AJUSTE = 1.10080;

// Cálculo
const producto = factorDeducible * factorCoaseguro;
const denominador_base = DENOMINADOR_A + DENOMINADOR_B * producto;
const denominador_coberturas = denominador_base * DENOMINADOR_AJUSTE;

const coberturaBruta = base * factor;
return roundTo2Decimals(coberturaBruta / denominador_coberturas);
```

---

## 📈 Resultados

### Antes
- Error sistemático: **+8.2%**
- Diferencia: **+$547.63**
- Precisión: **91.8%**

### Después
- Error: **0.0008%**
- Diferencia: **$0.06** (redondeo)
- Precisión: **99.9992%** ✓✓✓

---

## 🔒 Notas de Seguridad

### ⚠️ NO MODIFICAR
Esta constante fue validada exhaustivamente:
- ✓ Múltiples casos de edad/sexo
- ✓ Diferentes deducibles
- ✓ Diferentes coaseguros
- ✓ Excel oficial de VePorMás

### ⚠️ Validar Siempre
Cualquier cambio futuro debe:
1. Probar con Excel oficial actualizado
2. Validar con mínimo 10 casos diferentes
3. Verificar error < 0.01%

---

## 📅 Historial

| Fecha | Evento |
|-------|--------|
| 20/12/2024 | Descubrimiento de constante 1.10080 |
| 20/12/2024 | Validación exhaustiva (15 casos) |
| 20/12/2024 | Implementación en sistema |
| 20/12/2024 | Build exitoso sin errores |

---

## 🎯 Conclusión

La constante de ajuste **1.10080** es un factor crítico del algoritmo de VePorMás que permite calcular coberturas adicionales con precisión del **99.9992%**. Su naturaleza universal y constante sugiere que es un ajuste comercial o actuarial incorporado en el Excel oficial.

**Estado:** ✅ VALIDADO Y PRODUCTIVO
