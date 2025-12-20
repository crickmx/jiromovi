# 🧪 CASO DE PRUEBA: RICARDO CASTRO GOMEZ

**Fuente:** PDF "bx+_ricardo_castro_gomez.pdf"
**Fecha:** 17 dic 2025
**Propósito:** Validar que GMM BX+ calcule idéntico al Excel

---

## 📋 DATOS DEL PLAN

| Campo | Valor |
|-------|-------|
| **Estado** | QUERETARO |
| **Nivel Hospitalario** | PLUS |
| **Tabulador** | ORO-110,000 |
| **Suma Asegurada** | $50,000,000 |
| **Deducible** | $35,000 |
| **Coaseguro** | 15% |
| **Tope de Coaseguro** | $60,000 |
| **Forma de Pago** | ANUAL |

---

## 👥 ASEGURADOS

### 1. RICARDO CASTRO GOMEZ
- **Edad:** 40 años
- **Sexo:** Hombre
- **Prima Neta Básica:** $11,509.57
- **Prima Neta Adicionales:** $7,094.43
- **Prima Neta Total:** $18,604.00

### 2. JULIANA CEBALLOS GONZALEZ
- **Edad:** 39 años
- **Sexo:** Mujer
- **Prima Neta Básica:** $14,595.59
- **Prima Neta Adicionales:** $8,996.64
- **Prima Neta Total:** $23,592.23

### 3. EMMA CASTRO CEBALLOS
- **Edad:** 1 año
- **Sexo:** Mujer
- **Prima Neta Básica:** $6,043.98
- **Prima Neta Adicionales:** $3,725.47
- **Prima Neta Total:** $9,769.45

---

## 🛡️ COBERTURAS CONTRATADAS

### Cobertura Básica
✅ Incluida (base del plan)

### Servicios de Asistencia (Incluidos sin costo)
- ✅ Servicio Dental Básico
- ✅ Servicios de Asistencia Bx+
- ✅ Asistencia al viajero

### Coberturas Adicionales con Costo
1. ✅ **Medicamentos Fuera del Hospital**
2. ✅ **Eliminación de Deducible por Accidente**
3. ✅ **Multiregion**
4. ✅ **Beneficio Hospitalario VIP**
5. ✅ **Emergencia Médica en el extranjero**
6. ✅ **Reconocimiento de Antigüedad**

### Coberturas NO Contratadas
- ❌ Padecimientos Preexistentes
- ❌ Complicaciones No Amparadas
- ❌ Enfermedades Graves Extranjero
- ❌ Cobertura Internacional
- ❌ Ampliación de Servicios
- ❌ Ayuda Diaria
- ❌ Indemnización EG
- ❌ Maternidad
- ❌ Xtensuz

---

## 💰 TOTALES ESPERADOS (DEL EXCEL/PDF)

| Concepto | Importe |
|----------|---------|
| **Prima Neta Total** | $51,965.69 |
| Descuentos | $0.00 |
| Recargo por Pago Fraccionado | $0.00 |
| **Derecho de Póliza** | $900.00 |
| **Subtotal** | $52,865.69 |
| **IVA (16%)** | $8,458.51 |
| **PRIMA TOTAL** | $61,324.20 |

### Forma de Pago ANUAL
- **Número de Recibos:** 1
- **Primer Recibo:** $61,324.20
- **Recibos Subsecuentes:** $0.00

---

## 🔍 ANÁLISIS DE CÁLCULO

### Gastos de Expedición
```
Número de asegurados: 3
Costo por asegurado: $300.00
Total: 3 × $300 = $900.00
```

**⚠️ NOTA IMPORTANTE:**
El PDF muestra "Derecho de Póliza" de $900.00, lo que sugiere:
- **$300 por asegurado** (no $150 como tenemos configurado)
- O es un concepto diferente a "Gastos de Expedición"

**VERIFICAR:**
- ¿Gastos de Expedición = $150 o $300 por asegurado?
- ¿O hay un concepto adicional "Derecho de Póliza"?

### Cálculo de IVA
```
Subtotal: $52,865.69
IVA (16%): $52,865.69 × 0.16 = $8,458.51 ✓
```

### Suma de Primas Netas
```
Ricardo:  $18,604.00
Juliana:  $23,592.23
Emma:     $ 9,769.45
-------------------
TOTAL:    $51,965.68 (debería ser $51,965.69)
```

**⚠️ Diferencia de $0.01**
Posible error de redondeo acumulado o en el PDF

---

## 📊 DESGLOSE POR ASEGURADO

### RICARDO (40 años, Hombre)

**Prima Base:** $11,509.57

**Proceso de cálculo estimado:**
```
1. Base edad/sexo (40, H)     = ?
2. × Factor Estado (Querétaro) = ?
3. × Factor Nivel (PLUS)       = ?
4. × Factor Tabulador (ORO)    = ?
5. × Factor SA ($50M)          = ?
6. × Factor Deducible ($35k)   = ?
7. × Factor Coaseguro (15%)    = ?
--------------------------------
Prima Base Final              = $11,509.57
```

**Coberturas Adicionales:** $7,094.43
```
Medicamentos Fuera         = ?
Elim. Ded. Accidente       = ?
Multiregion                = ?
VIP                        = ?
Emergencia Extranjero      = ?
Reconocimiento Antigüedad  = ?
---------------------------
TOTAL                      = $7,094.43
```

**¿Porcentaje de adicionales?**
```
$7,094.43 / $11,509.57 = 61.63%
```

### JULIANA (39 años, Mujer)

**Prima Base:** $14,595.59
**Adicionales:** $8,996.64

**Proporción:**
```
$8,996.64 / $14,595.59 = 61.63% (igual que Ricardo)
```

### EMMA (1 año, Mujer)

**Prima Base:** $6,043.98
**Adicionales:** $3,725.47

**Proporción:**
```
$3,725.47 / $6,043.98 = 61.63% (igual que los demás)
```

**✅ OBSERVACIÓN:**
Las coberturas adicionales representan exactamente el **61.63%** de la prima base para los 3 asegurados.
Esto confirma que las coberturas se calculan con los mismos porcentajes para todos.

---

## 🎯 PRUEBA A EJECUTAR EN GMM BX+

### Paso 1: Ir a "GMM BX+ Cotizador"

### Paso 2: Ingresar Características del Plan
```
Estado:             QUERETARO
Nivel Hospitalario: PLUS
Tabulador:          ORO-110,000
Suma Asegurada:     50,000,000 (o $50,000,000)
Deducible:          35,000 (o $35,000)
Coaseguro:          15% (o 0.15)
Tope Coaseguro:     60,000
```

### Paso 3: Agregar Asegurados
```
Asegurado 1:
  Nombre: RICARDO CASTRO GOMEZ
  Edad:   40
  Sexo:   Hombre

Asegurado 2:
  Nombre: JULIANA CEBALLOS GONZALEZ
  Edad:   39
  Sexo:   Mujer

Asegurado 3:
  Nombre: EMMA CASTRO CEBALLOS
  Edad:   1
  Sexo:   Mujer
```

### Paso 4: Seleccionar Coberturas
Marcar SOLAMENTE estas coberturas:
- [x] Medicamentos Fuera del Hospital
- [x] Eliminación de Deducible por Accidente
- [x] Multiregion
- [x] Beneficio Hospitalario VIP
- [x] Emergencia Médica en el extranjero
- [x] Reconocimiento de Antigüedad

**Dejar DESMARCADAS todas las demás**

### Paso 5: Forma de Pago
```
Seleccionar: ANUAL
```

### Paso 6: Calcular

---

## ✅ CRITERIOS DE ÉXITO

### Nivel 1: Coincidencia Perfecta (Ideal)
Todas las diferencias = **$0.00**

| Concepto | Excel | Sistema | Diferencia |
|----------|-------|---------|------------|
| Ricardo - Base | $11,509.57 | ? | $0.00 |
| Ricardo - Adicionales | $7,094.43 | ? | $0.00 |
| Ricardo - Total | $18,604.00 | ? | $0.00 |
| Juliana - Base | $14,595.59 | ? | $0.00 |
| Juliana - Adicionales | $8,996.64 | ? | $0.00 |
| Juliana - Total | $23,592.23 | ? | $0.00 |
| Emma - Base | $6,043.98 | ? | $0.00 |
| Emma - Adicionales | $3,725.47 | ? | $0.00 |
| Emma - Total | $9,769.45 | ? | $0.00 |
| **Prima Neta Total** | **$51,965.69** | ? | **$0.00** |
| Gastos Expedición | $900.00 | ? | $0.00 |
| Subtotal | $52,865.69 | ? | $0.00 |
| IVA | $8,458.51 | ? | $0.00 |
| **TOTAL** | **$61,324.20** | ? | **$0.00** |

### Nivel 2: Tolerancia Aceptable
Diferencia máxima permitida por redondeo: **±$0.02 por concepto**

### Nivel 3: Problemas en el Motor
Si diferencias > $1.00 → **Investigar motor de cálculo**

---

## 🔧 SI HAY DIFERENCIAS

### 1. Activar Modo Debug
Modificar temporalmente el código para ver el desglose:

```typescript
const result = calculateQuote(input, tables, debug: true);
```

### 2. Revisar Logs en Consola
El modo debug muestra:
```javascript
{
  capa1_datosBase: { ... },
  capa2_primaBaseFinal: ...,
  capa3_cargas: { ... },
  capa4_coberturas: { ... },
  capa5_totales: { ... }
}
```

### 3. Comparar Capa por Capa

**Si Prima Base es diferente:**
- Revisar factores en CAPA 1 (lookup)
- Verificar que el Excel tenga los mismos factores
- Comprobar que el orden de multiplicación sea correcto

**Si Adicionales son diferentes:**
- Revisar coeficientes en CAPA 4
- Verificar que los coeficientes del Excel coincidan
- Comprobar que se apliquen sobre la base correcta

**Si Totales son diferentes:**
- Verificar Gastos de Expedición ($300 vs $150)
- Comprobar cálculo de IVA (16%)
- Revisar redondeo en cada paso

---

## 📌 PUNTOS CRÍTICOS A VERIFICAR

### 1. Gastos de Expedición
❓ **¿$150 o $300 por asegurado?**
- PDF muestra: $900 / 3 = $300 por asegurado
- Sistema tiene configurado: $150 por asegurado
- **ACCIÓN:** Verificar en Excel celda O67 (hoja Cotizacion)

### 2. Tope de Coaseguro
✓ **Excel muestra $60,000 para 15%**
- Sistema lee de tabla: T13:U17
- Debe coincidir

### 3. Coeficientes de Coberturas
**Verificar que los coeficientes del Excel coincidan con:**
```
medicamentos:            ~20.47%
eliminacion_deducible:   (tabla AU15:AW23)
multiregion:             (tabla AQ42:AS74 - Querétaro)
vip:                     ~3.44%
emergencia_ext:          ~1.25%
antiguedad:              ~7.50%
```

### 4. Factor Estado
**Querétaro en tabla W4:Z38**
- Columna 0: Nombre
- Columna 1: ¿Zona?
- Columna 2: Factor
- **Verificar:** ¿Cuál es el factor para Querétaro?

---

## 📝 SIGUIENTE PASO

1. **Ejecutar esta cotización en GMM BX+**
2. **Capturar resultados del sistema**
3. **Comparar con tabla de arriba**
4. **Reportar diferencias**
5. **Si hay diferencias → Activar modo debug**

---

## 🎓 APRENDIZAJES ESPERADOS

Esta prueba nos dirá:
1. ✅ Si el motor de cálculo replica exactamente el Excel
2. ✅ Si los rangos de celdas están correctos
3. ✅ Si los coeficientes están correctos
4. ✅ Si el redondeo está correcto
5. ✅ Si falta configurar algo (ej: Gastos de Expedición)

---

**Estado:** ⏳ Pendiente de ejecución
**Próximo paso:** Ejecutar en GMM BX+ y reportar resultados
