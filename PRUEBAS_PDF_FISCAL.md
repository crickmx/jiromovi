# Guía de Pruebas: PDFs Fiscales de Comisiones

## Objetivo
Validar que los PDFs fiscales generan valores correctos e individuales para cada agente según su régimen fiscal.

## Escenarios de Prueba

### PRUEBA 1: ASIMILADOS - Valores Únicos

**Configuración:**
1. Seleccionar un agente con régimen fiscal **ASIMILADOS**
2. Verificar que tenga comisiones en un lote
3. Generar PDF de Orden de Pago

**Validaciones:**
- [ ] El PDF muestra **solo 2 campos**: Ret. ISR y Total
- [ ] NO muestra: IVA, Ret. IVA, Ret. Contable, Costo Dispersión
- [ ] La fórmula es: `Total = Comisión Bruta - Ret. ISR`
- [ ] Los valores coinciden con la comisión del agente (no con el lote completo)
- [ ] El PDF muestra "Base de cálculo" con la comisión bruta correcta

**Ejemplo Esperado:**
```
Cálculo Fiscal
─────────────────────────────────
Concepto              Importe
─────────────────────────────────
Ret. ISR              - $1,317.43
Total                   $17,276.47
─────────────────────────────────

Régimen fiscal: ASIMILADOS
Base de cálculo: $18,593.90
```

---

### PRUEBA 2: HONORARIOS - Cálculo Completo

**Configuración:**
1. Seleccionar un agente con régimen fiscal **HONORARIOS**
2. Verificar que tenga comisiones en un lote
3. Generar PDF de Orden de Pago

**Validaciones:**
- [ ] El PDF muestra **4 campos**: IVA, Ret. ISR, Ret. IVA, Total
- [ ] NO muestra: Ret. Contable, Costo Dispersión
- [ ] El IVA **NO es cero** (debe ser 16% de la comisión bruta)
- [ ] La Ret. IVA **NO es cero** (debe ser 2/3 del IVA)
- [ ] Fórmula: `Total = Comisión Bruta + IVA - Ret. ISR - Ret. IVA`

**Ejemplo Esperado con Comisión Bruta = $15,024.05:**
```
Cálculo Fiscal
─────────────────────────────────
Concepto              Importe
─────────────────────────────────
IVA                   + $2,403.85
Ret. ISR              - $1,502.40
Ret. IVA              - $1,602.57
Total                   $14,322.93
─────────────────────────────────

Régimen fiscal: HONORARIOS
Base de cálculo: $15,024.05
```

**Validación Matemática:**
```
IVA = $15,024.05 × 16% = $2,403.85 ✓
Ret. ISR = $15,024.05 × 10% = $1,502.40 ✓ (puede variar por centavos por redondeo)
Ret. IVA = $2,403.85 × 2/3 = $1,602.57 ✓
Total = $15,024.05 + $2,403.85 - $1,502.40 - $1,602.57 = $14,322.93 ✓
```

---

### PRUEBA 3: RESICO - Tasa Reducida

**Configuración:**
1. Seleccionar un agente con régimen fiscal **RESICO**
2. Verificar que tenga comisiones en un lote
3. Generar PDF de Orden de Pago

**Validaciones:**
- [ ] El PDF muestra **4 campos**: IVA, Ret. ISR, Ret. IVA, Total
- [ ] NO muestra: Ret. Contable, Costo Dispersión
- [ ] El IVA **NO es cero** (debe ser 16% de la comisión bruta)
- [ ] La Ret. ISR es **mucho menor** que en Honorarios (1.25% vs 10%)
- [ ] Fórmula: `Total = Comisión Bruta + IVA - Ret. ISR - Ret. IVA`

**Ejemplo Esperado con Comisión Bruta = $7,846.03:**
```
Cálculo Fiscal
─────────────────────────────────
Concepto              Importe
─────────────────────────────────
IVA                   + $1,255.36
Ret. ISR              - $98.08
Ret. IVA              - $836.91
Total                   $8,166.40
─────────────────────────────────

Régimen fiscal: RESICO
Base de cálculo: $7,846.03
```

**Validación Matemática:**
```
IVA = $7,846.03 × 16% = $1,255.36 ✓
Ret. ISR = $7,846.03 × 1.25% = $98.08 ✓
Ret. IVA = $1,255.36 × 2/3 = $836.91 ✓
Total = $7,846.03 + $1,255.36 - $98.08 - $836.91 = $8,166.40 ✓
```

---

### PRUEBA 4: Múltiples Agentes del Mismo Lote

**Configuración:**
1. Seleccionar un lote con **al menos 3 agentes**
2. Los agentes deben tener **diferentes comisiones brutas**
3. Generar PDF de Orden de Pago para cada agente

**Validaciones Críticas:**
- [ ] Cada PDF muestra valores **diferentes**
- [ ] Los valores corresponden a la comisión **individual** del agente
- [ ] NO se repiten los mismos valores fiscales entre PDFs
- [ ] Cada PDF muestra su propia "Base de cálculo"

**Ejemplo:**
```
PDF Agente 1 (Comisión: $10,000):
  IVA = $1,600
  Ret. ISR = $1,000
  Total = $9,066.67

PDF Agente 2 (Comisión: $20,000):
  IVA = $3,200
  Ret. ISR = $2,000
  Total = $18,133.33

PDF Agente 3 (Comisión: $5,000):
  IVA = $800
  Ret. ISR = $500
  Total = $4,533.33
```

❌ **NO debe ocurrir:** Los 3 PDFs muestran IVA = $1,600, ISR = $1,000

---

### PRUEBA 5: Cambio de Régimen Fiscal

**Configuración:**
1. Generar PDF de un agente con régimen **HONORARIOS**
2. Cambiar el régimen fiscal del agente a **RESICO**
3. Generar nuevamente el PDF

**Validaciones:**
- [ ] El primer PDF muestra: Ret. ISR = 10% de la comisión bruta
- [ ] El segundo PDF muestra: Ret. ISR = 1.25% de la comisión bruta
- [ ] La Ret. ISR del segundo PDF es **mucho menor** (~8 veces menor)
- [ ] El Total del segundo PDF es **mayor** (paga menos impuestos)
- [ ] Ambos PDFs muestran el régimen fiscal correcto

**Ejemplo:**
```
ANTES (HONORARIOS, Comisión = $10,000):
  Ret. ISR = $1,000 (10%)
  Total = $9,066.67

DESPUÉS (RESICO, Comisión = $10,000):
  Ret. ISR = $125 (1.25%)
  Total = $9,941.67
```

---

### PRUEBA 6: Verificación de Consola (Logs)

**Configuración:**
1. Abrir la Consola del Navegador (F12)
2. Generar un PDF de Orden de Pago

**Validaciones:**
- [ ] Aparecen logs con formato: `[PDF] ========================================`
- [ ] Muestra el nombre del agente
- [ ] Muestra el régimen fiscal
- [ ] Muestra la comisión bruta
- [ ] Muestra los cálculos (IVA, Ret. ISR, Ret. IVA, Total)
- [ ] Muestra el número de campos visibles

**Ejemplo de Log Esperado:**
```
[PDF] ========================================
[PDF] Generando PDF Fiscal para: Juan Pérez
[PDF] Régimen Fiscal: HONORARIOS
[PDF] Comisión Bruta: $15,024.05
[PDF Fiscal] Calculando desglose fiscal:
  - Régimen: HONORARIOS
  - Comisión Bruta: $15,024.05
  - IVA (16%): $2,403.85
  - Ret. ISR (10%): $1,502.40
  - Ret. IVA (2/3): $1,602.57
  - Total: $14,322.93
[PDF] Resultado Fiscal Calculado:
[PDF]   - IVA: $2,403.85
[PDF]   - Ret. ISR: $1,502.40
[PDF]   - Ret. IVA: $1,602.57
[PDF]   - Total: $14,322.93
[PDF] Campos visibles: 4
[PDF] ========================================
```

---

## Problemas Resueltos

### ❌ Antes del Fix
1. Todos los PDFs del mismo lote mostraban valores idénticos
2. IVA y Ret. IVA aparecían en $0.00 para Honorarios y RESICO
3. Los valores no correspondían a la comisión del agente individual
4. Cambiar el régimen fiscal no afectaba el PDF

### ✅ Después del Fix
1. Cada PDF muestra sus propios valores calculados
2. IVA y Ret. IVA se calculan correctamente
3. Los valores corresponden a la comisión real del agente
4. El régimen fiscal se respeta correctamente

---

## Checklist Final

- [ ] ASIMILADOS muestra solo Ret. ISR y Total
- [ ] HONORARIOS muestra IVA, Ret. ISR, Ret. IVA, Total
- [ ] RESICO muestra IVA, Ret. ISR, Ret. IVA, Total
- [ ] IVA nunca es $0.00 en Honorarios/RESICO
- [ ] Ret. IVA nunca es $0.00 en Honorarios/RESICO
- [ ] Cada agente tiene valores únicos y correctos
- [ ] La base de cálculo coincide con la comisión del agente
- [ ] Los logs en consola son claros y descriptivos
- [ ] No hay valores hardcodeados repetidos

---

## Contacto para Reportar Problemas

Si después de estas pruebas se detecta algún valor incorrecto:
1. Capturar screenshot del PDF
2. Anotar la comisión bruta del agente
3. Anotar el régimen fiscal
4. Reportar los valores mostrados vs esperados
5. Incluir los logs de consola si es posible
