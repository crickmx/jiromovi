# ASIMILADOS - ISR Total Implementado

## Resumen Ejecutivo

El sistema ahora calcula el ISR para ASIMILADOS conforme a las reglas de la IMAGEN 1, pero en el PDF solo muestra "ISR Total" sin desglosar ISR Vida ni ISR Daños.

## 1. Reglas de Cálculo (IMAGEN 1)

### Comisión Base
- Comisión base = campo `Importe` del Excel
- `PrimaNeta` es solo informativa
- Comisión por póliza: `Comisión = Importe × (PorPart / 100)`

### Clasificación de Ramos
- **Vida** → Ramo = "Vida"
- **Sin Vida (Daños)** → TODOS los demás ramos

### Agrupaciones
```
Comisión Vida = suma(comisiones donde Ramo = Vida)
Comisión Sin Vida = suma(comisiones donde Ramo ≠ Vida)
Comisión Total = Comisión Vida + Comisión Sin Vida
```

### Retención Contable (solo Vida)
- Tasa fija: **16%**
```
Retención Contable = Comisión Vida × 0.16
```

### Costo de Dispersión (solo Sin Vida)
- Tasa fija: **9%**
```
Costo Dispersión = Comisión Sin Vida × 0.09
```

### IVA
- **NO aplica**
```
IVA = 0.00
```

### ISR (Cálculo Interno)

**IMPORTANTE:** Este cálculo es interno, no se muestra en el PDF.

#### ISR Vida
```
Base ISR Vida = Comisión Vida − Retención Contable
ISR Vida = Base ISR Vida × 0.10
```

#### ISR Daños
```
Base ISR Daños = Comisión Sin Vida − Costo Dispersión
ISR Daños = Base ISR Daños × 0.10
```

#### ISR Total
```
ISR Total = ISR Vida + ISR Daños
```

**PROHIBIDO:**
- Calcular ISR directo sobre Comisión Total
- Calcular ISR sobre el neto global
- Omitir la separación Vida / Sin Vida en el cálculo

### Total a Pagar
```
Total a Pagar = Comisión Total − Retención Contable − Costo Dispersión − ISR Total
```

## 2. Visualización en el PDF

### Campos Mostrados (Orden Exacto)

```
Desglose Fiscal
- Ret. Contable
- Costo Dispersión
- IVA
- ISR Total
```

### Campos NO Mostrados
- ISR Vida
- ISR Daños
- Bases intermedias
- Comisión Vida
- Comisión Sin Vida

**REGLA:** El PDF solo imprime valores finales, no el detalle del cálculo.

## 3. Persistencia de Datos

En base de datos se guardan:
- `isr_vida` (calculado internamente)
- `isr_danos` (calculado internamente)
- `isr_total` (mostrado en PDF)

Pero el PDF solo lee `isr_total`.

## 4. Validación QA

Para un lote con:
- Comisión Total: **$14,808.07**
- Vida: **$544.20**
- Sin Vida: **$14,263.87**

El sistema DEBE calcular internamente:

```
Ret. Contable:    $87.07
Costo Dispersión: $1,283.75
ISR Vida:         $46.91
ISR Daños:        $1,308.61
ISR Total:        $1,355.53
Total a Pagar:    $12,081.72
```

El PDF debe mostrar SOLO:
```
ISR Total: $1,355.53
```

Si el resultado es distinto → ERROR DE IMPLEMENTACIÓN

## 5. Implementación Técnica

### Archivos Modificados

1. **`src/lib/commissionFiscalCalculations.ts`**
   - Función `calcularAsimilados()` implementa las reglas de IMAGEN 1
   - Calcula ISR Vida e ISR Daños por separado
   - Devuelve ISR Total como suma de ambos

2. **`src/lib/pdfUtils.ts`**
   - Función `getPdfFiscalRows()` para régimen ASIMILADOS
   - Muestra "ISR Total" en lugar de "Ret. ISR"
   - No muestra ISR Vida ni ISR Daños

3. **`src/components/commission/PdfFiscalPreview.tsx`**
   - Vista previa del PDF
   - Muestra "ISR Total" para ASIMILADOS
   - Valida que no se muestren campos prohibidos

### Código Clave

```typescript
// calcularAsimilados() en commissionFiscalCalculations.ts
function calcularAsimilados(params: {
  comisionBaseTotal: number;
  vida: number;
  sinVida: number;
}): DesgloseFiscal {
  const { comisionBaseTotal, vida, sinVida } = params;

  const retContable = roundTo2Decimals(vida * 0.16);
  const costoDispersion = roundTo2Decimals(sinVida * 0.09);

  const isrVida = roundTo2Decimals((vida - retContable) * 0.10);
  const isrDanios = roundTo2Decimals((sinVida - costoDispersion) * 0.10);
  const isrTotal = roundTo2Decimals(isrVida + isrDanios);

  const totalAPagar = roundTo2Decimals(
    comisionBaseTotal - retContable - costoDispersion - isrTotal
  );

  return {
    vida,
    sinVida,
    retContable,
    costoDispersion,
    iva: 0,
    retIsr: 0,
    retIva: 0,
    isrVida,
    isrDanios,
    isrTotal,
    totalAPagar,
  };
}
```

```typescript
// getPdfFiscalRows() en pdfUtils.ts
case 'ASIMILADOS':
  if (desgloseFiscal.retContable > 0) {
    rows.push({
      label: 'Ret. Contable',
      value: `- ${formatCurrency(desgloseFiscal.retContable)}`
    });
  }
  if (desgloseFiscal.costoDispersion > 0) {
    rows.push({
      label: 'Costo Dispersión',
      value: `- ${formatCurrency(desgloseFiscal.costoDispersion)}`
    });
  }
  if (desgloseFiscal.iva > 0) {
    rows.push({
      label: 'IVA',
      value: `+ ${formatCurrency(desgloseFiscal.iva)}`
    });
  }
  if (desgloseFiscal.isrTotal > 0) {
    rows.push({
      label: 'ISR Total',
      value: `- ${formatCurrency(desgloseFiscal.isrTotal)}`
    });
  }
  break;
```

## 6. Regla de Oro

**CÁLCULO:** El ISR se calcula conforme a IMAGEN 1 (separado por Vida y Daños).

**VISUALIZACIÓN:** El PDF muestra solo "ISR Total" (suma de ambos).

## 7. Siguiente Paso

El backend (Edge Function `recalculate-commission-batch`) debe usar `calcularDesgloseFiscal()` de `commissionFiscalCalculations.ts` para garantizar que los cálculos en DB sean consistentes con el PDF.

---

**Fecha de Implementación:** 2025-12-19
**Estado:** COMPLETADO
