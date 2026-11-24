# Corrección de Lógica de Generación de PDF Fiscal

## Fecha
2025-03-19

## Problema
El PDF de "Orden de Pago" del módulo de comisiones mostraba campos fiscales incorrectos para los regímenes Asimilados, Honorarios y RESICO, incluyendo conceptos no autorizados como Ret. Contable, Costo Dispersión, y otros valores intermedios.

## Solución Implementada

### Archivo Modificado
- `src/lib/pdfUtils.ts` - Función `getPdfFiscalRows()`

### Regla General
1. La base de cálculo es siempre la **Comisión Bruta** (commission_neta)
2. La Comisión Bruta se usa para calcular, pero **NO se muestra** en el PDF
3. El PDF solo muestra los **campos fiscales autorizados** por régimen
4. Para estos 3 regímenes, **Ret. Contable** y **Costo Dispersión** NO aplican y NO se muestran

### Campos Mostrados por Régimen

#### 1. ASIMILADOS
**Campos mostrados en el PDF:**
- Ret. ISR
- Total

**Fórmulas:**
- Ret. ISR = ISR calculado sobre Comisión Bruta
- Total = Comisión Bruta - Ret. ISR

**NO se muestran:**
- IVA
- Ret. IVA
- Ret. Contable
- Costo Dispersión

#### 2. HONORARIOS
**Campos mostrados en el PDF:**
- IVA
- Ret. ISR
- Ret. IVA
- Total

**Fórmulas:**
- IVA = Comisión Bruta × 16%
- Ret. ISR = Comisión Bruta × 10%
- Ret. IVA = IVA × 2/3
- Total = Comisión Bruta + IVA - Ret. ISR - Ret. IVA

**NO se muestran:**
- Ret. Contable
- Costo Dispersión

#### 3. RESICO
**Campos mostrados en el PDF:**
- IVA
- Ret. ISR
- Ret. IVA
- Total

**Fórmulas:**
- IVA = Comisión Bruta × 16%
- Ret. ISR = Comisión Bruta × 1.25%
- Ret. IVA = IVA × 2/3
- Total = Comisión Bruta + IVA - Ret. ISR - Ret. IVA

**NO se muestran:**
- Ret. Contable
- Costo Dispersión

### Formato del PDF
- Todos los importes se redondean a 2 decimales
- Orden visual:
  - **Asimilados:** Ret. ISR, Total
  - **Honorarios y RESICO:** IVA, Ret. ISR, Ret. IVA, Total
- El PDF NO muestra campos internos como:
  - Comisión Bruta
  - Base
  - Subtotal
  - Vida/Sin Vida
  - ISR Vida/ISR Daños
  - Otros conceptos no autorizados

## Código Actualizado

La función `getPdfFiscalRows()` ahora implementa correctamente la lógica de allowlist por régimen fiscal, mostrando únicamente los campos autorizados según las especificaciones.

```typescript
function getPdfFiscalRows(regimen: RegimenFiscal, desgloseFiscal: DesgloseFiscal): PdfFiscalRow[] {
  const rows: PdfFiscalRow[] = [];

  switch (regimen) {
    case 'ASIMILADOS':
      // Solo mostrar: Ret. ISR, Total
      rows.push({
        label: 'Ret. ISR',
        value: `- ${formatCurrency(desgloseFiscal.isrTotal)}`
      });
      break;

    case 'HONORARIOS':
      // Solo mostrar: IVA, Ret. ISR, Ret. IVA, Total
      rows.push({
        label: 'IVA',
        value: `+ ${formatCurrency(desgloseFiscal.iva)}`
      });
      rows.push({
        label: 'Ret. ISR',
        value: `- ${formatCurrency(desgloseFiscal.retIsr)}`
      });
      rows.push({
        label: 'Ret. IVA',
        value: `- ${formatCurrency(desgloseFiscal.retIva)}`
      });
      break;

    case 'RESICO':
      // Solo mostrar: IVA, Ret. ISR, Ret. IVA, Total
      rows.push({
        label: 'IVA',
        value: `+ ${formatCurrency(desgloseFiscal.iva)}`
      });
      rows.push({
        label: 'Ret. ISR',
        value: `- ${formatCurrency(desgloseFiscal.retIsr)}`
      });
      rows.push({
        label: 'Ret. IVA',
        value: `- ${formatCurrency(desgloseFiscal.retIva)}`
      });
      break;
  }

  // Total siempre al final
  rows.push({
    label: 'Total',
    value: formatCurrency(desgloseFiscal.totalAPagar),
    isBold: true,
    isTotal: true
  });

  return rows;
}
```

## Pruebas Recomendadas

1. Generar PDF de Orden de Pago para un agente con régimen **ASIMILADOS**
   - Verificar que solo aparezcan: Ret. ISR, Total

2. Generar PDF de Orden de Pago para un agente con régimen **HONORARIOS**
   - Verificar que solo aparezcan: IVA, Ret. ISR, Ret. IVA, Total

3. Generar PDF de Orden de Pago para un agente con régimen **RESICO**
   - Verificar que solo aparezcan: IVA, Ret. ISR, Ret. IVA, Total

4. Verificar que en ningún caso aparezcan:
   - Ret. Contable
   - Costo Dispersión
   - Comisión Bruta
   - Base
   - Vida/Sin Vida
   - ISR Vida/ISR Daños

## Estado
✅ Implementado y compilado exitosamente
