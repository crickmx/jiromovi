/**
 * MÓDULO DE CÁLCULO FISCAL PARA PDF DE COMISIONES
 *
 * Este módulo contiene la lógica PURA de cálculo fiscal para la generación de PDFs.
 * CRÍTICO: Esta función NO debe reutilizar valores cacheados ni estados globales.
 * Cada llamada recalcula desde cero basándose únicamente en los inputs recibidos.
 */

type RegimenFiscal = "ASIMILADOS" | "HONORARIOS" | "RESICO";

type PdfFieldKey =
  | "ret_contable"
  | "costo_dispersion"
  | "iva"
  | "ret_isr"
  | "ret_iva"
  | "total";

type PdfFieldLabel =
  | "Ret. Contable"
  | "Costo Dispersión"
  | "IVA"
  | "Ret. ISR"
  | "Ret. IVA"
  | "Total";

export interface PdfVisibleField {
  key: PdfFieldKey;
  label: PdfFieldLabel;
  value: number;
  displayValue: string;
  isAddition?: boolean;
  isSubtraction?: boolean;
}

export interface PdfFiscalInput {
  regimenFiscal: RegimenFiscal;
  comisionBruta: number;
  retIsrAsimilados?: number;
}

export interface PdfFiscalResult {
  regimenFiscal: RegimenFiscal;
  baseInterna: number;
  calculos: {
    iva: number;
    retIsr: number;
    retIva: number;
    total: number;
  };
  visibleFields: PdfVisibleField[];
}

/**
 * Redondea un número a 2 decimales
 */
const round2 = (value: number): number =>
  Math.round((value + Number.EPSILON) * 100) / 100;

/**
 * Formatea un valor como moneda
 */
const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
};

/**
 * FUNCIÓN PRINCIPAL: Calcula el desglose fiscal para un PDF de comisiones
 *
 * GARANTÍAS:
 * - Función pura: mismo input = mismo output
 * - No depende de estado global ni cache
 * - No lee valores de otros PDFs o lotes
 * - Cada invocación recalcula desde cero
 *
 * @param input - Datos de entrada (régimen, comisión bruta, ISR asimilados si aplica)
 * @returns Resultado con campos visibles y cálculos
 */
export function calcularPdfFiscalComisiones(
  input: PdfFiscalInput
): PdfFiscalResult {
  const base = round2(input.comisionBruta);

  console.log('[PDF Fiscal] Calculando desglose fiscal:');
  console.log(`  - Régimen: ${input.regimenFiscal}`);
  console.log(`  - Comisión Bruta: ${formatCurrency(base)}`);

  // ============================================================================
  // ASIMILADOS
  // ============================================================================
  if (input.regimenFiscal === "ASIMILADOS") {
    const retIsr = round2(input.retIsrAsimilados ?? 0);
    const total = round2(base - retIsr);

    console.log(`  - Ret. ISR: ${formatCurrency(retIsr)}`);
    console.log(`  - Total: ${formatCurrency(total)}`);

    return {
      regimenFiscal: "ASIMILADOS",
      baseInterna: base,
      calculos: {
        iva: 0,
        retIsr,
        retIva: 0,
        total,
      },
      visibleFields: [
        {
          key: "ret_isr",
          label: "Ret. ISR",
          value: retIsr,
          displayValue: formatCurrency(retIsr),
          isSubtraction: true
        },
        {
          key: "total",
          label: "Total",
          value: total,
          displayValue: formatCurrency(total),
        },
      ],
    };
  }

  // ============================================================================
  // HONORARIOS
  // ============================================================================
  if (input.regimenFiscal === "HONORARIOS") {
    const iva = round2(base * 0.16);
    const retIsr = round2(base * 0.10);
    const retIva = round2(iva * (2 / 3));
    const total = round2(base + iva - retIsr - retIva);

    console.log(`  - IVA (16%): ${formatCurrency(iva)}`);
    console.log(`  - Ret. ISR (10%): ${formatCurrency(retIsr)}`);
    console.log(`  - Ret. IVA (2/3): ${formatCurrency(retIva)}`);
    console.log(`  - Total: ${formatCurrency(total)}`);

    return {
      regimenFiscal: "HONORARIOS",
      baseInterna: base,
      calculos: {
        iva,
        retIsr,
        retIva,
        total,
      },
      visibleFields: [
        {
          key: "iva",
          label: "IVA",
          value: iva,
          displayValue: formatCurrency(iva),
          isAddition: true
        },
        {
          key: "ret_isr",
          label: "Ret. ISR",
          value: retIsr,
          displayValue: formatCurrency(retIsr),
          isSubtraction: true
        },
        {
          key: "ret_iva",
          label: "Ret. IVA",
          value: retIva,
          displayValue: formatCurrency(retIva),
          isSubtraction: true
        },
        {
          key: "total",
          label: "Total",
          value: total,
          displayValue: formatCurrency(total),
        },
      ],
    };
  }

  // ============================================================================
  // RESICO
  // ============================================================================
  const iva = round2(base * 0.16);
  const retIsr = round2(base * 0.0125);
  const retIva = round2(iva * (2 / 3));
  const total = round2(base + iva - retIsr - retIva);

  console.log(`  - IVA (16%): ${formatCurrency(iva)}`);
  console.log(`  - Ret. ISR (1.25%): ${formatCurrency(retIsr)}`);
  console.log(`  - Ret. IVA (2/3): ${formatCurrency(retIva)}`);
  console.log(`  - Total: ${formatCurrency(total)}`);

  return {
    regimenFiscal: "RESICO",
    baseInterna: base,
    calculos: {
      iva,
      retIsr,
      retIva,
      total,
    },
    visibleFields: [
      {
        key: "iva",
        label: "IVA",
        value: iva,
        displayValue: formatCurrency(iva),
        isAddition: true
      },
      {
        key: "ret_isr",
        label: "Ret. ISR",
        value: retIsr,
        displayValue: formatCurrency(retIsr),
        isSubtraction: true
      },
      {
        key: "ret_iva",
        label: "Ret. IVA",
        value: retIva,
        displayValue: formatCurrency(retIva),
        isSubtraction: true
      },
      {
        key: "total",
        label: "Total",
        value: total,
        displayValue: formatCurrency(total),
      },
    ],
  };
}

/**
 * Valida que el resultado fiscal sea correcto para propósitos de testing
 */
export function validarResultadoFiscal(
  resultado: PdfFiscalResult,
  comisionEsperada: number,
  tolerancia: number = 0.01
): boolean {
  const diff = Math.abs(resultado.baseInterna - comisionEsperada);
  return diff <= tolerancia;
}
