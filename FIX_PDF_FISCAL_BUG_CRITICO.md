# Corrección de Bug Crítico en PDFs Fiscales de Comisiones

## Fecha
2025-03-19

## Problema Detectado

### Síntomas
1. Los PDFs fiscales de los 3 regímenes (Asimilados, Honorarios y RESICO) mostraban el mismo resultado fiscal, aunque la comisión bruta era diferente
2. Valores hardcodeados/cacheados siendo reutilizados:
   - Ret. ISR = 1,317.43 (valor fijo)
   - Total = 16,006.35 (valor fijo)
3. En Honorarios y RESICO, el IVA y Ret. IVA aparecían en 0
4. El cálculo fiscal no usaba la comisión bruta real del agente actual
5. El cálculo fiscal no respetaba el régimen fiscal del usuario

### Causa Raíz
El PDF estaba usando valores **precalculados y agregados del lote completo** (`commission_batches`) en lugar de recalcular con la comisión bruta real del agente individual. Esto causaba que:
- Todos los PDFs del mismo lote mostraran los mismos valores fiscales
- Los valores no correspondían a la comisión individual del agente
- Los cálculos no se actualizaban cuando cambiaba el régimen fiscal

## Solución Implementada

### 1. Nuevo Módulo de Cálculo Puro
**Archivo:** `src/lib/pdfFiscalCalculation.ts`

Se creó un módulo completamente nuevo con una función pura que:
- **NO reutiliza** valores de estados globales, cache o variables compartidas
- **Recalcula** desde cero cada vez que se invoca
- Es **determinista**: mismo input = mismo output
- Es **aislada**: cada invocación es independiente

```typescript
export function calcularPdfFiscalComisiones(
  input: PdfFiscalInput
): PdfFiscalResult {
  const base = round2(input.comisionBruta);

  // Cálculo fresco basado SOLO en los inputs recibidos
  // NO lee valores de otros PDFs o lotes
  // NO usa cache ni estados mutables

  if (input.regimenFiscal === "ASIMILADOS") {
    const retIsr = round2(input.retIsrAsimilados ?? 0);
    const total = round2(base - retIsr);
    return { /* resultado */ };
  }

  if (input.regimenFiscal === "HONORARIOS") {
    const iva = round2(base * 0.16);
    const retIsr = round2(base * 0.10);
    const retIva = round2(iva * (2 / 3));
    const total = round2(base + iva - retIsr - retIva);
    return { /* resultado */ };
  }

  // RESICO
  const iva = round2(base * 0.16);
  const retIsr = round2(base * 0.0125);
  const retIva = round2(iva * (2 / 3));
  const total = round2(base + iva - retIsr - retIva);
  return { /* resultado */ };
}
```

### 2. Modificación en generateOrdenDePagoPDF
**Archivo:** `src/lib/pdfUtils.ts`

Se reemplazó completamente la lógica de obtención de valores fiscales:

#### ANTES (INCORRECTO):
```typescript
// ❌ Obtenía valores AGREGADOS del lote completo
const { data: batchData } = await supabase
  .from('commission_batches')
  .select('iva, ret_isr, ret_iva, total_neto')
  .eq('id', batch.id)
  .single();

// ❌ Usaba estos valores para TODOS los agentes del lote
const desgloseFiscal = {
  iva: parseFloat(batchData.iva),
  retIsr: parseFloat(batchData.ret_isr),
  // ... mismo valor para todos
};
```

#### DESPUÉS (CORRECTO):
```typescript
// ✅ Calcula la comisión bruta del agente individual
let totalComisionNeta = 0;
agentDetails.forEach(detail => {
  const comision = detail.is_manual_adjusted
    ? (detail.adjusted_commission_neta || 0)
    : detail.commission_neta;
  totalComisionNeta += comision;
});

// ✅ Prepara input único para este agente
const fiscalInput: PdfFiscalInput = {
  regimenFiscal: regimenFiscalNormalizado,
  comisionBruta: totalComisionNeta,
};

// ✅ RECALCULA desde cero (función pura)
const resultadoFiscal = calcularPdfFiscalComisiones(fiscalInput);

// ✅ Usa los valores recién calculados
resultadoFiscal.visibleFields.forEach(field => {
  // Renderizar en PDF
});
```

### 3. Arquitectura de Datos Limpia

**Input:**
```typescript
interface PdfFiscalInput {
  regimenFiscal: 'ASIMILADOS' | 'HONORARIOS' | 'RESICO';
  comisionBruta: number;
  retIsrAsimilados?: number;  // Solo para ASIMILADOS
}
```

**Output:**
```typescript
interface PdfFiscalResult {
  regimenFiscal: string;
  baseInterna: number;
  calculos: {
    iva: number;
    retIsr: number;
    retIva: number;
    total: number;
  };
  visibleFields: PdfVisibleField[];
}
```

**Campos Visibles por Régimen:**
```typescript
interface PdfVisibleField {
  key: string;
  label: string;
  value: number;
  displayValue: string;  // Formateado como moneda
  isAddition?: boolean;
  isSubtraction?: boolean;
}
```

### 4. Renderizado del PDF

El PDF ahora renderiza **exclusivamente** los campos devueltos por `visibleFields`:

```typescript
const desgloseFiscalRows = resultadoFiscal.visibleFields.map(field => {
  let valorDisplay = field.displayValue;
  if (field.isAddition) {
    valorDisplay = `+ ${field.displayValue}`;
  } else if (field.isSubtraction) {
    valorDisplay = `- ${field.displayValue}`;
  }

  const isTotal = field.key === 'total';
  if (isTotal) {
    return [
      { content: field.label, styles: { fontStyle: 'bold', fillColor: [0, 102, 51] } },
      { content: valorDisplay, styles: { fontStyle: 'bold', fillColor: [0, 102, 51] } }
    ];
  }
  return [field.label, valorDisplay];
});
```

## Fórmulas Implementadas

### ASIMILADOS
```
Ret. ISR = Valor calculado por motor fiscal de MOVI
Total = Comisión Bruta - Ret. ISR
```

**Campos visibles:**
- Ret. ISR
- Total

### HONORARIOS
```
IVA = Comisión Bruta × 16%
Ret. ISR = Comisión Bruta × 10%
Ret. IVA = IVA × 2/3
Total = Comisión Bruta + IVA - Ret. ISR - Ret. IVA
```

**Campos visibles:**
- IVA
- Ret. ISR
- Ret. IVA
- Total

### RESICO
```
IVA = Comisión Bruta × 16%
Ret. ISR = Comisión Bruta × 1.25%
Ret. IVA = IVA × 2/3
Total = Comisión Bruta + IVA - Ret. ISR - Ret. IVA
```

**Campos visibles:**
- IVA
- Ret. ISR
- Ret. IVA
- Total

## Pruebas de Validación

Se creó `src/lib/pdfFiscalCalculation.test.ts` con 3 escenarios de prueba:

### PRUEBA A: ASIMILADOS
```
Comisión Bruta = 18,593.90
Ret. ISR = 1,317.43
Total esperado = 17,276.47
✅ VERIFICADO
```

### PRUEBA B: HONORARIOS
```
Comisión Bruta = 15,024.05
IVA esperado = 2,403.85
Ret. ISR esperado = 1,502.40
Ret. IVA esperado = 1,602.57
Total esperado = 14,322.93
✅ VERIFICADO
```

### PRUEBA C: RESICO
```
Comisión Bruta = 7,846.03
IVA esperado = 1,255.36
Ret. ISR esperado = 98.08
Ret. IVA esperado = 836.91
Total esperado = 8,166.40
✅ VERIFICADO
```

### PRUEBA DE AISLAMIENTO
```
Test 1: Base 1000 → IVA = 160
Test 2: Base 2000 → IVA = 320
Relación: 320/160 = 2.0
✅ LOS CÁLCULOS SON INDEPENDIENTES
```

## Garantías de la Solución

### ✅ Cálculo Puro
- Función sin efectos secundarios
- No depende de estados externos
- No modifica variables globales
- Determinista y predecible

### ✅ Aislamiento por Documento
- Cada PDF recalcula sus propios valores
- No hay reutilización entre PDFs
- No hay cache compartido
- Cada invocación es independiente

### ✅ Origen de Datos Correcto
- Usa `totalComisionNeta` calculada sumando las comisiones del agente
- No usa valores agregados del lote completo
- Consulta el régimen fiscal actual del usuario
- Para ASIMILADOS, consulta el ISR desde la BD

### ✅ Sin Hardcodeo
- No hay valores fijos en el código
- No hay constantes compartidas entre PDFs
- Todos los valores se calculan dinámicamente
- No hay variables globales mutables

### ✅ Logging Completo
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
[PDF] Campos visibles: 4
[PDF] ========================================
```

## Criterios de Aceptación Cumplidos

| Criterio | Estado |
|----------|--------|
| Cada PDF usa la Comisión Bruta real del agente/lote actual | ✅ |
| Los 3 regímenes generan resultados distintos | ✅ |
| Honorarios y RESICO ya no muestran IVA o Ret. IVA en cero | ✅ |
| No se repiten valores fiscales entre PDFs distintos | ✅ |
| El PDF muestra solo los campos autorizados | ✅ |
| Se eliminan valores hardcodeados/cacheados | ✅ |
| El cálculo es determinista, puro y aislado por documento | ✅ |

## Archivos Modificados

1. **Nuevos:**
   - `src/lib/pdfFiscalCalculation.ts` - Módulo de cálculo fiscal puro
   - `src/lib/pdfFiscalCalculation.test.ts` - Pruebas de validación

2. **Modificados:**
   - `src/lib/pdfUtils.ts` - Función `generateOrdenDePagoPDF()`

## Impacto

### Antes del Fix
- ❌ PDFs incorrectos con valores reutilizados
- ❌ Mismo resultado fiscal para diferentes agentes
- ❌ IVA y Ret. IVA en 0 para Honorarios/RESICO
- ❌ No respetaba el régimen fiscal del usuario
- ❌ Usuario confundido con montos incorrectos

### Después del Fix
- ✅ PDFs correctos con valores individuales
- ✅ Cada agente tiene su propio cálculo fiscal
- ✅ IVA y Ret. IVA calculados correctamente
- ✅ Respeta el régimen fiscal actual del usuario
- ✅ Resultados precisos y confiables

## Estado
✅ **IMPLEMENTADO Y VERIFICADO**
- Compilación exitosa
- Pruebas unitarias pasadas
- Fórmulas validadas
- Aislamiento confirmado
- Logging implementado
- Documentación completa
