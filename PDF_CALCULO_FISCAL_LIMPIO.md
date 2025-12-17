# PDF de Cálculo Fiscal - Sistema Limpio y Simplificado

**Fecha**: 17 Diciembre 2024
**Módulo**: Comisiones - Generación de PDF
**Objetivo**: Mostrar solo campos esenciales, sin variables intermedias

---

## Problema Original

El PDF de "Cálculo Fiscal" mostraba demasiados campos técnicos e intermedios:

### Campos que se mostraban ANTES (no deseados):
```
❌ Comisión Base Total
❌ Vida
❌ Comisión Sin Vida
❌ Retención Contable (16% Vida)
❌ Costo Dispersión (10% Sin Vida)
❌ ISR Vida (10%)
❌ ISR Daños (10%)
❌ ISR Total
❌ IVA (16% Sin Vida)
❌ Retención ISR (10% Total)
❌ Retención IVA (10.667% Sin Vida)
❌ Total a Pagar
```

**Problemas**:
1. Confundían al usuario con cálculos intermedios
2. Mostraban desgloses por "Vida" y "Daños" que son internos
3. Incluían porcentajes técnicos que no son relevantes para el usuario final
4. Demasiada información técnica en un documento ejecutivo

---

## Solución Implementada

### Campos que se muestran AHORA (solo permitidos):

```
✅ Ret. Contable      (cuando aplica)
✅ Costo Dispersión   (cuando aplica)
✅ IVA                (cuando aplica)
✅ Ret. ISR           (cuando aplica)
✅ Ret. IVA           (cuando aplica)
✅ Total              (siempre)
```

### Características:
- **Título claro**: "Cálculo Fiscal (Resumen)"
- **Solo campos necesarios**: Sin detalles técnicos
- **Orden lógico**: Según el régimen fiscal
- **Total destacado**: Fila verde con negrita

---

## Reglas por Régimen Fiscal

### 1. HONORARIOS

**Campos mostrados** (en orden):
1. IVA (si > 0)
2. Ret. ISR (si > 0)
3. Ret. IVA (si > 0)
4. **Total** (siempre)

**Ejemplo visual**:
```
┌──────────────────┬─────────────┐
│ Concepto         │ Importe     │
├──────────────────┼─────────────┤
│ IVA              │ + $1,200.00 │
│ Ret. ISR         │ - $500.00   │
│ Ret. IVA         │ - $320.00   │
│ Total            │ $8,380.00   │ ← Verde/Negrita
└──────────────────┴─────────────┘
```

### 2. ASIMILADOS

**Campos mostrados** (en orden):
1. Ret. Contable (si > 0)
2. Costo Dispersión (si > 0)
3. Ret. ISR (si > 0) ← Nota: Es la suma del ISR Total interno
4. IVA (si > 0, raro pero posible)
5. Ret. IVA (si > 0, raro pero posible)
6. **Total** (siempre)

**Ejemplo visual**:
```
┌──────────────────┬─────────────┐
│ Concepto         │ Importe     │
├──────────────────┼─────────────┤
│ Ret. Contable    │ - $800.00   │
│ Costo Dispersión │ - $300.00   │
│ Ret. ISR         │ - $690.00   │
│ Total            │ $6,210.00   │ ← Verde/Negrita
└──────────────────┴─────────────┘
```

**Nota importante**: Para ASIMILADOS, el campo "Ret. ISR" muestra el valor de `isrTotal` (que es ISR Vida + ISR Daños), pero NUNCA se muestra el desglose interno.

### 3. RESICO

**Campos mostrados** (en orden):
1. IVA (si > 0)
2. Ret. ISR (si > 0)
3. Ret. IVA (si > 0)
4. Ret. Contable (si > 0, raro pero si existe)
5. Costo Dispersión (si > 0, raro pero si existe)
6. **Total** (siempre)

**Ejemplo visual**:
```
┌──────────────────┬─────────────┐
│ Concepto         │ Importe     │
├──────────────────┼─────────────┤
│ IVA              │ + $480.00   │
│ Ret. ISR         │ - $125.00   │
│ Ret. IVA         │ - $320.00   │
│ Total            │ $10,035.00  │ ← Verde/Negrita
└──────────────────┴─────────────┘
```

---

## Arquitectura Técnica

### 1. Función Central: `getPdfFiscalRows()`

```typescript
function getPdfFiscalRows(
  regimen: RegimenFiscal,
  desgloseFiscal: DesgloseFiscal
): PdfFiscalRow[]
```

**Ubicación**: `src/lib/pdfUtils.ts`

**Responsabilidad**:
- Actúa como **allowlist** estricta de campos
- Filtra campos según régimen fiscal
- Solo incluye campos con valores > 0 (excepto Total)
- Devuelve array de objetos con `label`, `value`, `isBold`, `isTotal`

**Principio de diseño**:
```typescript
// ❌ PROHIBIDO: Mostrar cálculos intermedios
// ✅ PERMITIDO: Solo campos de la allowlist

const ALLOWED_FIELDS = [
  'Ret. Contable',
  'Costo Dispersión',
  'IVA',
  'Ret. ISR',
  'Ret. IVA',
  'Total'
];
```

### 2. Integración con `generateOrdenDePagoPDF()`

**Antes**:
```typescript
// ❌ Hardcoded por régimen con todos los campos
if (regimenFiscal === 'ASIMILADOS') {
  desgloseFiscalRows.push(
    ['Retención Contable (16% Vida)', ...],
    ['ISR Vida (10%)', ...],
    ['ISR Daños (10%)', ...],
    // ... muchos más campos
  );
}
```

**Ahora**:
```typescript
// ✅ Función centralizada con allowlist
const fiscalRows = getPdfFiscalRows(regimenFiscal, desgloseFiscal);

// Convertir a formato de tabla
const desgloseFiscalRows = fiscalRows.map(row => {
  if (row.isTotal) {
    return [
      { content: row.label, styles: { fillColor: [0, 102, 51], ... } },
      { content: row.value, styles: { fillColor: [0, 102, 51], ... } }
    ];
  }
  return [row.label, row.value];
});
```

### 3. Sistema de Validación

**Archivo**: `src/lib/pdfFiscalValidation.test.ts`

**Funciones principales**:

1. **`validatePdfLabel(label: string)`**
   - Verifica que un label NO contenga palabras prohibidas
   - Palabras prohibidas: "prima", "vida", "sin vida", "daños", "isr vida", "isr daños", etc.

2. **`validateTotalConsistency(pdfTotal, calculatedTotal)`**
   - Verifica que el Total del PDF coincida con el cálculo backend
   - Tolerancia: $0.01

3. **`runValidationTests()`**
   - Suite completa de tests
   - Valida los 3 regímenes fiscales
   - Verifica presencia de Total
   - Valida consistencia de valores

**Ejecutar validaciones**:
```bash
# Las validaciones se ejecutan automáticamente en build
npm run build
```

---

## Flujo de Datos

```
┌─────────────────────────────────────────────┐
│  1. Backend: Calcular Desglose Fiscal      │
│     calcularDesgloseFiscal()                │
│     → Devuelve DesgloseFiscal con TODOS    │
│       los campos (vida, sinVida, etc.)     │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│  2. PDF: Filtrar Solo Campos Permitidos    │
│     getPdfFiscalRows(regimen, desglose)     │
│     → Aplica ALLOWLIST estricta            │
│     → Solo devuelve campos permitidos       │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│  3. PDF: Generar Tabla Limpia              │
│     autoTable(doc, { body: fiscalRows })    │
│     → Título: "Cálculo Fiscal (Resumen)"   │
│     → Solo muestra allowlist                │
│     → Total destacado en verde              │
└─────────────────────────────────────────────┘
```

**Principio clave**:
- Los cálculos internos NO cambian
- Solo cambia la **presentación** en el PDF
- Separación clara entre cálculo y render

---

## Validaciones Implementadas

### 1. Validación de Palabras Prohibidas

```typescript
const FORBIDDEN_KEYWORDS = [
  'base total',
  'prima',
  'vida',
  'sin vida',
  'daños',
  'gravada',
  'isr vida',
  'isr daños',
  'comision vida',
  'comision daños',
  // ... más
];
```

### 2. Validación de Labels Permitidos

```typescript
const ALLOWED_LABELS = [
  'ret. contable',
  'costo dispersión',
  'iva',
  'ret. isr',
  'ret. iva',
  'total',
];
```

### 3. Test Automático

```typescript
// Test: Ningún régimen debe mostrar campos prohibidos
for (const regime of ['HONORARIOS', 'ASIMILADOS', 'RESICO']) {
  const rows = simulatePdfRowGeneration(regime, mockData);

  for (const row of rows) {
    assert(!containsForbiddenKeywords(row.label));
  }
}
```

---

## Criterios de Aceptación (QA)

### ✅ Checklist de Validación

1. **Campos permitidos únicamente**
   - [ ] HONORARIOS solo muestra: IVA, Ret. ISR, Ret. IVA, Total
   - [ ] ASIMILADOS solo muestra: Ret. Contable, Costo Dispersión, Ret. ISR, Total
   - [ ] RESICO solo muestra: IVA, Ret. ISR, Ret. IVA, Total

2. **Sin campos prohibidos**
   - [ ] No aparece "Prima"
   - [ ] No aparece "Vida"
   - [ ] No aparece "Sin Vida"
   - [ ] No aparece "ISR Vida"
   - [ ] No aparece "ISR Daños"
   - [ ] No aparece "Comisión Base Total"
   - [ ] No aparecen porcentajes como "16%", "10%", "1.25%"

3. **Total consistente**
   - [ ] El Total del PDF coincide con el cálculo final del backend
   - [ ] El Total aparece destacado en verde con negrita

4. **Campos condicionales**
   - [ ] Si un campo es 0 o no aplica, no se muestra
   - [ ] Total siempre se muestra aunque sea 0

5. **Formato visual**
   - [ ] Título: "Cálculo Fiscal (Resumen)"
   - [ ] Tabla limpia con solo 2 columnas: Concepto | Importe
   - [ ] Signos "+" y "-" correctos
   - [ ] Formato de moneda correcto ($X,XXX.XX)

---

## Beneficios del Cambio

### Para el Usuario Final (Agente)
1. **Claridad**: Solo ve lo que necesita saber
2. **Profesional**: Documento ejecutivo limpio
3. **Sin confusión**: No hay cálculos técnicos intermedios
4. **Fácil de leer**: Orden lógico y formato claro

### Para el Equipo de Desarrollo
1. **Mantenible**: Función centralizada con allowlist
2. **Testeable**: Sistema de validación automático
3. **Escalable**: Fácil agregar/quitar campos permitidos
4. **Documentado**: Reglas claras por régimen

### Para Contabilidad/Finanzas
1. **Consistencia**: Total siempre coincide con backend
2. **Trazabilidad**: Cálculos internos intactos
3. **Auditable**: Validaciones automáticas

---

## Ejemplos de Uso

### Generar PDF para un lote de comisiones

```typescript
import { generateOrdenDePagoPDF } from './lib/pdfUtils';

// El PDF automáticamente usa el nuevo sistema limpio
const pdfBlob = await generateOrdenDePagoPDF(
  agentDetails,
  batch
);

// El desglose fiscal solo mostrará campos permitidos
downloadPDF(pdfBlob, 'orden-pago.pdf');
```

### Validar campos del PDF

```typescript
import { validatePdfLabel, runValidationTests } from './lib/pdfFiscalValidation.test';

// Validar un label individual
const result = validatePdfLabel('IVA');
// { valid: true }

const badResult = validatePdfLabel('ISR Vida (10%)');
// { valid: false, error: 'Label contiene palabra prohibida: "isr vida"' }

// Ejecutar suite completa de tests
const testResults = runValidationTests();
// { passed: 5, failed: 0, tests: [...] }
```

---

## Cambios en Archivos

### `src/lib/pdfUtils.ts`

**Añadido**:
- Interface `PdfFiscalRow`
- Función `getPdfFiscalRows()` (allowlist estricta)
- Importación de `RegimenFiscal` type

**Modificado**:
- Función `generateOrdenDePagoPDF()`
  - Reemplazada lógica de `desgloseFiscalRows`
  - Ahora usa `getPdfFiscalRows()`
  - Título cambiado a "Cálculo Fiscal (Resumen)"
  - Removido sufijo de régimen en texto inferior

### `src/lib/pdfFiscalValidation.test.ts`

**Añadido** (nuevo archivo):
- Constantes de validación
- Funciones de validación
- Suite de tests automáticos
- Mock data para testing
- Documentación de campos prohibidos

---

## Mantenimiento Futuro

### Para agregar un nuevo campo permitido:

1. Actualizar `ALLOWED_LABELS` en `pdfFiscalValidation.test.ts`
2. Modificar `getPdfFiscalRows()` en `pdfUtils.ts`
3. Ejecutar tests: `npm run build`
4. Documentar en esta guía

### Para modificar un régimen fiscal:

1. Editar el case correspondiente en `getPdfFiscalRows()`
2. Actualizar la documentación en sección "Reglas por Régimen Fiscal"
3. Ejecutar validaciones

### Para cambiar el formato visual:

1. Modificar estilos en `generateOrdenDePagoPDF()`
2. Mantener estructura de `fiscalRows.map()`
3. NO cambiar la allowlist de `getPdfFiscalRows()`

---

## Preguntas Frecuentes

### ¿Por qué no se muestran "Vida" y "Sin Vida"?

Son cálculos intermedios usados internamente para aplicar tasas diferentes. El usuario final solo necesita saber las retenciones totales, no el desglose técnico.

### ¿Por qué ASIMILADOS muestra "Ret. ISR" en lugar de "ISR Total"?

Para mantener consistencia de nomenclatura con los otros regímenes. Internamente usa `isrTotal`, pero se presenta como "Ret. ISR" para claridad.

### ¿Qué pasa si un campo no tiene valor (es 0)?

No se muestra en el PDF, excepto el Total que siempre aparece.

### ¿Los cálculos internos cambiaron?

NO. Los cálculos en `commissionFiscalCalculations.ts` siguen exactamente igual. Solo cambió la presentación en el PDF.

### ¿Cómo sé que el Total es correcto?

El sistema tiene validación automática que verifica que el Total del PDF coincida con el cálculo final del backend (`totalAPagar`).

---

## Estado de Implementación

| Componente | Estado | Notas |
|-----------|--------|-------|
| `getPdfFiscalRows()` | ✅ Implementado | Allowlist estricta |
| PDF HONORARIOS | ✅ Implementado | Solo campos permitidos |
| PDF ASIMILADOS | ✅ Implementado | Solo campos permitidos |
| PDF RESICO | ✅ Implementado | Solo campos permitidos |
| Sistema de validación | ✅ Implementado | Tests automáticos |
| Documentación | ✅ Completado | Este archivo |
| Tests QA | ⏳ Pendiente | Validación manual |

---

## Conclusión

El PDF de Cálculo Fiscal ahora es:
- **Limpio**: Solo campos esenciales
- **Claro**: Sin cálculos técnicos
- **Consistente**: Total siempre correcto
- **Profesional**: Formato ejecutivo
- **Mantenible**: Código centralizado con allowlist

Los cálculos internos permanecen intactos y completos. Solo la presentación cambió para mejorar la experiencia del usuario.

---

**Última actualización**: 17 Diciembre 2024
**Build Status**: ✅ Compilado exitosamente
**Tests Status**: ⏳ Pendiente validación manual
