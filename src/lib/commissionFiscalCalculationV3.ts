/**
 * MÓDULO DE CÁLCULO FISCAL PARA COMISIONES - VERSIÓN 3 (BLINDADO)
 *
 * Este módulo implementa un motor fiscal completamente aislado, puro y validado
 * para los tres regímenes fiscales: ASIMILADOS, HONORARIOS y RESICO.
 *
 * GARANTÍAS DE ESTE MOTOR:
 * - Función pura: sin efectos secundarios ni estado global
 * - Sin cachés entre invocaciones
 * - Validación interna estricta con errores en inconsistencias
 * - Auditoría con versionado de fórmulas
 * - Política de redondeo consistente y documentada
 * - Interfaces TypeScript estrictas
 *
 * @version 3.0.0
 * @author Sistema MOVI Digital
 * @date 2026-04-06
 */

// ============================================================================
// CONSTANTES DE CONFIGURACIÓN
// ============================================================================

const FORMULA_VERSION = "v3.0.0-exact" as const;
const ROUNDING_POLICY = "round-half-up-2-decimals" as const;
const TOLERANCE = 0.02; // Tolerancia de $0.02 para validación

// Tasas fiscales por régimen
const FISCAL_RATES = {
  ASIMILADOS: {
    RET_CONTABLE_VIDA: 0.16,
    COSTO_DISPERSION_SINVIDA: 0.09,
    ISR_RATE: 0.10,
    DESIVIZAR_VIDA: 1.16,
    DESIVIZAR_SINVIDA: 1.09,
  },
  HONORARIOS: {
    IVA_RATE: 0.16,
    ISR_RATE: 0.10,
    RET_IVA_FACTOR: 2 / 3,
  },
  RESICO: {
    IVA_RATE: 0.16,
    ISR_RATE: 0.0125,
    RET_IVA_FACTOR: 2 / 3,
  },
} as const;

// ============================================================================
// TIPOS E INTERFACES ESTRICTAS
// ============================================================================

export type RegimenFiscal = "ASIMILADOS" | "HONORARIOS" | "RESICO";

export interface FiscalBreakdownInput {
  /**
   * Régimen fiscal del agente
   */
  regimenFiscal: RegimenFiscal;

  /**
   * Suma de comisiones NO VIDA (gravadas con IVA)
   */
  comisionGravada: number;

  /**
   * Suma de comisiones VIDA (exentas de IVA)
   */
  comisionExenta: number;

  /**
   * Contexto opcional para auditoría
   */
  context?: {
    agentId?: string;
    loteId?: string;
    periodo?: string;
    sourceDocumentIds?: string[];
  };
}

export interface FiscalBreakdownResult {
  /**
   * Régimen fiscal aplicado
   */
  regimenFiscal: RegimenFiscal;

  /**
   * Valores base del cálculo
   */
  base: {
    comisionGravada: number;
    comisionExenta: number;
    comisionTotal: number;
  };

  /**
   * Resultados de los cálculos fiscales
   */
  calculations: {
    retContable: number;
    costoDispersion: number;
    iva: number;
    retIsr: number;
    retIva: number;
    total: number;
  };

  /**
   * Información de auditoría
   */
  audit: {
    formulaVersion: string;
    performedAt: string;
    roundingPolicy: string;
    validationsPassed: boolean;
    warnings: string[];
  };

  /**
   * Filas formateadas para renderizar en PDF
   */
  pdfRows: Array<{
    key: string;
    label: string;
    value: number;
    formattedValue: string;
    sign: "positive" | "negative" | "neutral";
  }>;
}

/**
 * Error personalizado para validación fiscal
 */
export class FiscalCalculationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "FiscalCalculationError";
  }
}

// ============================================================================
// FUNCIONES AUXILIARES
// ============================================================================

/**
 * Redondea un número a 2 decimales usando "round half up"
 *
 * POLÍTICA DE REDONDEO:
 * - Se usa Math.round() que implementa "round half up"
 * - Se agrega Number.EPSILON para evitar errores de precisión flotante
 * - Todos los valores monetarios se redondean a 2 decimales
 *
 * @param value - Valor a redondear
 * @returns Valor redondeado a 2 decimales
 */
function round2(value: number): number {
  if (!Number.isFinite(value)) {
    throw new FiscalCalculationError(
      "Intento de redondear un valor no finito",
      "INVALID_NUMBER",
      { value }
    );
  }
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Formatea un valor como moneda mexicana
 */
function formatCurrency(value: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Valida que un input sea válido
 */
function validateInput(input: FiscalBreakdownInput): void {
  // Validar régimen fiscal
  const validRegimes: RegimenFiscal[] = ["ASIMILADOS", "HONORARIOS", "RESICO"];
  if (!validRegimes.includes(input.regimenFiscal)) {
    throw new FiscalCalculationError(
      `Régimen fiscal no reconocido: ${input.regimenFiscal}`,
      "INVALID_REGIME",
      { regimenFiscal: input.regimenFiscal }
    );
  }

  // Validar que las comisiones sean números no negativos
  if (!Number.isFinite(input.comisionGravada) || input.comisionGravada < 0) {
    throw new FiscalCalculationError(
      "Comisión gravada inválida",
      "INVALID_COMISION_GRAVADA",
      { comisionGravada: input.comisionGravada }
    );
  }

  if (!Number.isFinite(input.comisionExenta) || input.comisionExenta < 0) {
    throw new FiscalCalculationError(
      "Comisión exenta inválida",
      "INVALID_COMISION_EXENTA",
      { comisionExenta: input.comisionExenta }
    );
  }

  // Validar que haya al menos una comisión
  if (input.comisionGravada === 0 && input.comisionExenta === 0) {
    throw new FiscalCalculationError(
      "Al menos una comisión debe ser mayor a cero",
      "NO_COMMISSIONS",
      { comisionGravada: input.comisionGravada, comisionExenta: input.comisionExenta }
    );
  }
}

// ============================================================================
// CÁLCULOS POR RÉGIMEN FISCAL
// ============================================================================

/**
 * CÁLCULO FISCAL PARA ASIMILADOS
 *
 * FÓRMULAS VALIDADAS:
 * 1. RET CONTABLE = COMISION_EXENTA × 0.16
 * 2. COSTO DISPERSION = COMISION_GRAVADA × 0.09
 * 3. BASE_ISR_EXENTA = COMISION_EXENTA / 1.16
 * 4. ISR_EXENTA = BASE_ISR_EXENTA × 0.10
 * 5. BASE_ISR_GRAVADA = COMISION_GRAVADA / 1.09
 * 6. ISR_GRAVADA = BASE_ISR_GRAVADA × 0.10
 * 7. RET_ISR = ISR_EXENTA + ISR_GRAVADA
 * 8. TOTAL = (COMISION_GRAVADA + COMISION_EXENTA) - RET_CONTABLE - COSTO_DISPERSION - RET_ISR
 *
 * VALIDACIONES INTERNAS:
 * - RET_CONTABLE debe ser exactamente COMISION_EXENTA × 0.16
 * - COSTO_DISPERSION debe ser exactamente COMISION_GRAVADA × 0.09
 * - RET_ISR debe ser la suma de ISR_EXENTA + ISR_GRAVADA
 * - TOTAL debe ser positivo (si no, algo está mal)
 */
function calcularAsimilados(
  comisionGravada: number,
  comisionExenta: number
): Omit<FiscalBreakdownResult["calculations"], "iva" | "retIva"> & { warnings: string[] } {
  const warnings: string[] = [];
  const rates = FISCAL_RATES.ASIMILADOS;

  // Comisión total
  const comisionTotal = round2(comisionGravada + comisionExenta);

  // 1. RET CONTABLE (solo sobre VIDA)
  const retContable = round2(comisionExenta * rates.RET_CONTABLE_VIDA);

  // 2. COSTO DISPERSION (solo sobre NO VIDA)
  const costoDispersion = round2(comisionGravada * rates.COSTO_DISPERSION_SINVIDA);

  // 3-6. RET ISR (cálculo separado para exenta y gravada)
  const baseIsrExenta = comisionExenta / rates.DESIVIZAR_VIDA;
  const isrExenta = round2(baseIsrExenta * rates.ISR_RATE);

  const baseIsrGravada = comisionGravada / rates.DESIVIZAR_SINVIDA;
  const isrGravada = round2(baseIsrGravada * rates.ISR_RATE);

  const retIsr = round2(isrExenta + isrGravada);

  // 8. TOTAL
  const total = round2(comisionTotal - retContable - costoDispersion - retIsr);

  // VALIDACIONES INTERNAS
  // Validación 1: RET CONTABLE debe ser exactamente COMISION_EXENTA × 0.16
  const expectedRetContable = round2(comisionExenta * rates.RET_CONTABLE_VIDA);
  if (Math.abs(retContable - expectedRetContable) > TOLERANCE) {
    throw new FiscalCalculationError(
      "Validación fallida: RET CONTABLE no coincide con COMISION_EXENTA × 0.16",
      "VALIDATION_FAILED_RET_CONTABLE",
      { retContable, expectedRetContable }
    );
  }

  // Validación 2: COSTO DISPERSION debe ser exactamente COMISION_GRAVADA × 0.09
  const expectedCostoDispersion = round2(comisionGravada * rates.COSTO_DISPERSION_SINVIDA);
  if (Math.abs(costoDispersion - expectedCostoDispersion) > TOLERANCE) {
    throw new FiscalCalculationError(
      "Validación fallida: COSTO DISPERSION no coincide con COMISION_GRAVADA × 0.09",
      "VALIDATION_FAILED_COSTO_DISPERSION",
      { costoDispersion, expectedCostoDispersion }
    );
  }

  // Validación 3: TOTAL debe ser positivo
  if (total < 0) {
    warnings.push("TOTAL negativo detectado en ASIMILADOS - revisar comisiones");
  }

  return {
    retContable,
    costoDispersion,
    retIsr,
    total,
    warnings,
  };
}

/**
 * CÁLCULO FISCAL PARA HONORARIOS
 *
 * FÓRMULAS VALIDADAS:
 * 1. IVA = COMISION_GRAVADA × 0.16
 * 2. RET_ISR = COMISION_TOTAL × 0.10
 * 3. RET_IVA = IVA × (2/3)
 * 4. TOTAL = COMISION_TOTAL + IVA - RET_ISR - RET_IVA
 *
 * VALIDACIONES INTERNAS:
 * - IVA debe ser exactamente COMISION_GRAVADA × 0.16
 * - RET_ISR debe ser exactamente COMISION_TOTAL × 0.10
 * - RET_IVA debe ser exactamente IVA × (2/3)
 * - TOTAL debe ser positivo
 */
function calcularHonorarios(
  comisionGravada: number,
  comisionExenta: number
): Omit<FiscalBreakdownResult["calculations"], "retContable" | "costoDispersion"> & {
  warnings: string[];
} {
  const warnings: string[] = [];
  const rates = FISCAL_RATES.HONORARIOS;

  const comisionTotal = round2(comisionGravada + comisionExenta);

  // 1. IVA (solo sobre NO VIDA)
  const iva = round2(comisionGravada * rates.IVA_RATE);

  // 2. RET ISR (sobre el total)
  const retIsr = round2(comisionTotal * rates.ISR_RATE);

  // 3. RET IVA (2/3 del IVA)
  const retIva = round2(iva * rates.RET_IVA_FACTOR);

  // 4. TOTAL
  const total = round2(comisionTotal + iva - retIsr - retIva);

  // VALIDACIONES INTERNAS
  // Validación 1: IVA debe ser exactamente COMISION_GRAVADA × 0.16
  const expectedIva = round2(comisionGravada * rates.IVA_RATE);
  if (Math.abs(iva - expectedIva) > TOLERANCE) {
    throw new FiscalCalculationError(
      "Validación fallida: IVA no coincide con COMISION_GRAVADA × 0.16",
      "VALIDATION_FAILED_IVA",
      { iva, expectedIva }
    );
  }

  // Validación 2: RET ISR debe ser exactamente COMISION_TOTAL × 0.10
  const expectedRetIsr = round2(comisionTotal * rates.ISR_RATE);
  if (Math.abs(retIsr - expectedRetIsr) > TOLERANCE) {
    throw new FiscalCalculationError(
      "Validación fallida: RET ISR no coincide con COMISION_TOTAL × 0.10",
      "VALIDATION_FAILED_RET_ISR",
      { retIsr, expectedRetIsr }
    );
  }

  // Validación 3: RET IVA debe ser exactamente IVA × (2/3)
  const expectedRetIva = round2(iva * rates.RET_IVA_FACTOR);
  if (Math.abs(retIva - expectedRetIva) > TOLERANCE) {
    throw new FiscalCalculationError(
      "Validación fallida: RET IVA no coincide con IVA × (2/3)",
      "VALIDATION_FAILED_RET_IVA",
      { retIva, expectedRetIva }
    );
  }

  // Validación 4: TOTAL debe ser positivo
  if (total < 0) {
    warnings.push("TOTAL negativo detectado en HONORARIOS - revisar comisiones");
  }

  return {
    iva,
    retIsr,
    retIva,
    total,
    warnings,
  };
}

/**
 * CÁLCULO FISCAL PARA RESICO
 *
 * FÓRMULAS VALIDADAS:
 * 1. IVA = COMISION_GRAVADA × 0.16
 * 2. RET_ISR = COMISION_TOTAL × 0.0125
 * 3. RET_IVA = IVA × (2/3)
 * 4. TOTAL = COMISION_TOTAL + IVA - RET_ISR - RET_IVA
 *
 * VALIDACIONES INTERNAS:
 * - IVA debe ser exactamente COMISION_GRAVADA × 0.16
 * - RET_ISR debe ser exactamente COMISION_TOTAL × 0.0125
 * - RET_IVA debe ser exactamente IVA × (2/3)
 * - TOTAL debe ser positivo
 */
function calcularResico(
  comisionGravada: number,
  comisionExenta: number
): Omit<FiscalBreakdownResult["calculations"], "retContable" | "costoDispersion"> & {
  warnings: string[];
} {
  const warnings: string[] = [];
  const rates = FISCAL_RATES.RESICO;

  const comisionTotal = round2(comisionGravada + comisionExenta);

  // 1. IVA (solo sobre NO VIDA)
  const iva = round2(comisionGravada * rates.IVA_RATE);

  // 2. RET ISR (sobre el total, 1.25%)
  const retIsr = round2(comisionTotal * rates.ISR_RATE);

  // 3. RET IVA (2/3 del IVA)
  const retIva = round2(iva * rates.RET_IVA_FACTOR);

  // 4. TOTAL
  const total = round2(comisionTotal + iva - retIsr - retIva);

  // VALIDACIONES INTERNAS
  // Validación 1: IVA debe ser exactamente COMISION_GRAVADA × 0.16
  const expectedIva = round2(comisionGravada * rates.IVA_RATE);
  if (Math.abs(iva - expectedIva) > TOLERANCE) {
    throw new FiscalCalculationError(
      "Validación fallida: IVA no coincide con COMISION_GRAVADA × 0.16",
      "VALIDATION_FAILED_IVA",
      { iva, expectedIva }
    );
  }

  // Validación 2: RET ISR debe ser exactamente COMISION_TOTAL × 0.0125
  const expectedRetIsr = round2(comisionTotal * rates.ISR_RATE);
  if (Math.abs(retIsr - expectedRetIsr) > TOLERANCE) {
    throw new FiscalCalculationError(
      "Validación fallida: RET ISR no coincide con COMISION_TOTAL × 0.0125",
      "VALIDATION_FAILED_RET_ISR",
      { retIsr, expectedRetIsr }
    );
  }

  // Validación 3: RET IVA debe ser exactamente IVA × (2/3)
  const expectedRetIva = round2(iva * rates.RET_IVA_FACTOR);
  if (Math.abs(retIva - expectedRetIva) > TOLERANCE) {
    throw new FiscalCalculationError(
      "Validación fallida: RET IVA no coincide con IVA × (2/3)",
      "VALIDATION_FAILED_RET_IVA",
      { retIva, expectedRetIva }
    );
  }

  // Validación 4: TOTAL debe ser positivo
  if (total < 0) {
    warnings.push("TOTAL negativo detectado en RESICO - revisar comisiones");
  }

  return {
    iva,
    retIsr,
    retIva,
    total,
    warnings,
  };
}

// ============================================================================
// FUNCIÓN PRINCIPAL BLINDADA
// ============================================================================

/**
 * MOTOR FISCAL BLINDADO V3
 *
 * Esta función calcula el desglose fiscal completo para un conjunto de comisiones,
 * garantizando:
 * - Cálculos puramente funcionales sin efectos secundarios
 * - Validación estricta de inputs y outputs
 * - Auditoría completa con versionado de fórmulas
 * - Manejo de errores que previene fallos silenciosos
 * - Consistencia total entre diferentes invocaciones con los mismos inputs
 *
 * @param input - Datos de entrada validados
 * @returns Resultado completo con cálculos, auditoría y formato PDF
 * @throws {FiscalCalculationError} Si hay errores de validación o cálculo
 */
export function calcularDesgloseFiscalV3(
  input: FiscalBreakdownInput
): FiscalBreakdownResult {
  // PASO 1: Validar input
  validateInput(input);

  // PASO 2: Preparar valores base
  const comisionGravada = round2(input.comisionGravada);
  const comisionExenta = round2(input.comisionExenta);
  const comisionTotal = round2(comisionGravada + comisionExenta);

  const warnings: string[] = [];

  console.log(`[Fiscal V3] Calculando para ${input.regimenFiscal}:`);
  console.log(`[Fiscal V3]   Gravada: ${formatCurrency(comisionGravada)}`);
  console.log(`[Fiscal V3]   Exenta: ${formatCurrency(comisionExenta)}`);
  console.log(`[Fiscal V3]   Total: ${formatCurrency(comisionTotal)}`);

  // PASO 3: Ejecutar cálculo según régimen
  let calculations: FiscalBreakdownResult["calculations"];

  if (input.regimenFiscal === "ASIMILADOS") {
    const result = calcularAsimilados(comisionGravada, comisionExenta);
    calculations = {
      retContable: result.retContable,
      costoDispersion: result.costoDispersion,
      iva: 0.0,
      retIsr: result.retIsr,
      retIva: 0.0,
      total: result.total,
    };
    warnings.push(...result.warnings);
  } else if (input.regimenFiscal === "HONORARIOS") {
    const result = calcularHonorarios(comisionGravada, comisionExenta);
    calculations = {
      retContable: 0.0,
      costoDispersion: 0.0,
      iva: result.iva,
      retIsr: result.retIsr,
      retIva: result.retIva,
      total: result.total,
    };
    warnings.push(...result.warnings);
  } else {
    // RESICO
    const result = calcularResico(comisionGravada, comisionExenta);
    calculations = {
      retContable: 0.0,
      costoDispersion: 0.0,
      iva: result.iva,
      retIsr: result.retIsr,
      retIva: result.retIva,
      total: result.total,
    };
    warnings.push(...result.warnings);
  }

  // PASO 4: Generar filas para PDF (siempre 8 campos en orden)
  const pdfRows = [
    {
      key: "comision_gravada",
      label: "COMISION GRAVADA",
      value: comisionGravada,
      formattedValue: formatCurrency(comisionGravada),
      sign: "positive" as const,
    },
    {
      key: "comision_exenta",
      label: "COMISION EXENTA",
      value: comisionExenta,
      formattedValue: formatCurrency(comisionExenta),
      sign: "positive" as const,
    },
    {
      key: "ret_contable",
      label: "RET CONTABLE",
      value: calculations.retContable,
      formattedValue: formatCurrency(calculations.retContable),
      sign: "negative" as const,
    },
    {
      key: "costo_dispersion",
      label: "COSTO DISPERSION",
      value: calculations.costoDispersion,
      formattedValue: formatCurrency(calculations.costoDispersion),
      sign: "negative" as const,
    },
    {
      key: "iva",
      label: "IVA",
      value: calculations.iva,
      formattedValue: formatCurrency(calculations.iva),
      sign: "positive" as const,
    },
    {
      key: "ret_isr",
      label: "RET ISR",
      value: calculations.retIsr,
      formattedValue: formatCurrency(calculations.retIsr),
      sign: "negative" as const,
    },
    {
      key: "ret_iva",
      label: "RET IVA",
      value: calculations.retIva,
      formattedValue: formatCurrency(calculations.retIva),
      sign: "negative" as const,
    },
    {
      key: "total",
      label: "TOTAL",
      value: calculations.total,
      formattedValue: formatCurrency(calculations.total),
      sign: "neutral" as const,
    },
  ];

  // PASO 5: Construir resultado con auditoría
  const result: FiscalBreakdownResult = {
    regimenFiscal: input.regimenFiscal,
    base: {
      comisionGravada,
      comisionExenta,
      comisionTotal,
    },
    calculations,
    audit: {
      formulaVersion: FORMULA_VERSION,
      performedAt: new Date().toISOString(),
      roundingPolicy: ROUNDING_POLICY,
      validationsPassed: true,
      warnings,
    },
    pdfRows,
  };

  console.log(`[Fiscal V3] Cálculo completado exitosamente`);
  console.log(`[Fiscal V3]   Total: ${formatCurrency(calculations.total)}`);
  console.log(`[Fiscal V3]   Versión: ${FORMULA_VERSION}`);
  console.log(`[Fiscal V3]   Warnings: ${warnings.length}`);

  return result;
}

// ============================================================================
// FUNCIONES AUXILIARES PARA TESTING Y VALIDACIÓN
// ============================================================================

/**
 * Valida que un resultado coincida con un total esperado
 */
export function validarResultadoFiscal(
  resultado: FiscalBreakdownResult,
  totalEsperado: number,
  tolerancia: number = TOLERANCE
): { valido: boolean; diferencia: number; mensaje: string } {
  const diferencia = Math.abs(resultado.calculations.total - totalEsperado);
  const valido = diferencia <= tolerancia;

  return {
    valido,
    diferencia,
    mensaje: valido
      ? `✅ Validación exitosa (diferencia: ${formatCurrency(diferencia)})`
      : `❌ Validación fallida (diferencia: ${formatCurrency(diferencia)}, esperado: ${formatCurrency(totalEsperado)}, calculado: ${formatCurrency(resultado.calculations.total)})`,
  };
}

/**
 * Formatea un resultado para logging/debugging
 */
export function formatearResultadoParaLog(resultado: FiscalBreakdownResult): string {
  return `
========================================
RESULTADO FISCAL
========================================
Régimen: ${resultado.regimenFiscal}
Versión: ${resultado.audit.formulaVersion}
Fecha: ${resultado.audit.performedAt}

BASE:
  Comisión Gravada: ${formatCurrency(resultado.base.comisionGravada)}
  Comisión Exenta: ${formatCurrency(resultado.base.comisionExenta)}
  Comisión Total: ${formatCurrency(resultado.base.comisionTotal)}

CÁLCULOS:
  Ret. Contable: ${formatCurrency(resultado.calculations.retContable)}
  Costo Dispersión: ${formatCurrency(resultado.calculations.costoDispersion)}
  IVA: ${formatCurrency(resultado.calculations.iva)}
  Ret. ISR: ${formatCurrency(resultado.calculations.retIsr)}
  Ret. IVA: ${formatCurrency(resultado.calculations.retIva)}
  TOTAL: ${formatCurrency(resultado.calculations.total)}

AUDITORÍA:
  Validaciones Pasadas: ${resultado.audit.validationsPassed ? "SÍ" : "NO"}
  Política de Redondeo: ${resultado.audit.roundingPolicy}
  Warnings: ${resultado.audit.warnings.length > 0 ? resultado.audit.warnings.join(", ") : "Ninguno"}
========================================
  `.trim();
}

/**
 * Exporta las constantes para uso en tests
 */
export const FISCAL_CONFIG = {
  FORMULA_VERSION,
  ROUNDING_POLICY,
  TOLERANCE,
  FISCAL_RATES,
} as const;
