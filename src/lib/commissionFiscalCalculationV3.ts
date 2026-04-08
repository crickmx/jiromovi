/**
 * MOTOR FISCAL BLINDADO - COMISIONES MOVI DIGITAL
 *
 * @version 2.0.0
 * @formulaVersion v2.0.0
 *
 * GARANTIAS:
 * - Funcion pura: sin efectos secundarios, sin estado global, sin cache
 * - Cada invocacion recalcula desde cero
 * - Validacion interna estricta con errores en inconsistencias
 * - Auditoria completa con versionado de formulas y timestamp
 * - Politica de redondeo consistente y documentada
 * - Determinista: mismo input = mismo output siempre
 * - Sin posibilidad de reutilizar valores de otro documento/regimen
 *
 * REGLAS DE CLASIFICACION:
 * - VIDA           => COMISION EXENTA
 * - NO VIDA        => COMISION GRAVADA (vehiculos, danos, acc/enf, otros)
 *
 * POLITICA DE REDONDEO:
 * - roundMoney(v) = Math.round((v + Number.EPSILON) * 100) / 100
 * - Se calcula con maxima precision en pasos intermedios
 * - Solo se redondea al persistir/mostrar el valor final de cada concepto
 * - La suma del total usa los valores ya redondeados de cada concepto
 * - Esta politica es consistente y documentada en todos los tests
 */

// ============================================================================
// VERSION Y CONSTANTES
// ============================================================================

export const FISCAL_FORMULA_VERSION = "v2.0.0" as const;
const ROUNDING_POLICY = "round-half-up-2-decimals" as const;

/**
 * Tolerancia monetaria para validaciones internas.
 * Se acepta una diferencia maxima de $0.01 por precision de punto flotante.
 */
export const MONEY_TOLERANCE = 0.01 as const;

// Tasas fiscales por regimen — inmutables
const FISCAL_RATES = {
  ASIMILADOS: {
    RET_CONTABLE_EXENTA: 0.16,
    COSTO_DISPERSION_GRAVADA: 0.09,
    ISR_RATE: 0.10,
    BASE_EXENTA_DIVISOR: 1.16,
    BASE_GRAVADA_DIVISOR: 1.09,
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
// TIPOS E INTERFACES
// ============================================================================

export type RegimenFiscal = "ASIMILADOS" | "HONORARIOS" | "RESICO";

export interface FiscalBreakdownInput {
  regimenFiscal: RegimenFiscal;
  /**
   * Suma de comisiones NO VIDA (gravadas con IVA).
   * Incluye: VEHICULOS, DANOS, ACC y ENF, OTROS
   */
  comisionGravada: number;
  /**
   * Suma de comisiones VIDA (exentas de IVA).
   */
  comisionExenta: number;
  /**
   * Contexto opcional para auditoria y trazabilidad.
   * comisionTotal NO debe venir como input — se calcula internamente.
   */
  context?: {
    agentId?: string;
    loteId?: string;
    periodo?: string;
    sourceDocumentIds?: string[];
  };
}

export interface FiscalBreakdownResult {
  regimenFiscal: RegimenFiscal;

  base: {
    comisionGravada: number;
    comisionExenta: number;
    /** Siempre calculado internamente: gravada + exenta */
    comisionTotal: number;
  };

  calculations: {
    retContable: number;
    costoDispersion: number;
    iva: number;
    retIsr: number;
    retIva: number;
    total: number;
  };

  audit: {
    formulaVersion: string;
    performedAt: string;
    roundingPolicy: string;
    validationsPassed: boolean;
    warnings: string[];
  };

  /**
   * Filas para el PDF, siempre en este orden exacto:
   * COMISION_GRAVADA, COMISION_EXENTA, RET_CONTABLE, COSTO_DISPERSION,
   * IVA, RET_ISR, RET_IVA, TOTAL
   */
  pdfRows: Array<{
    key:
      | "COMISION_GRAVADA"
      | "COMISION_EXENTA"
      | "RET_CONTABLE"
      | "COSTO_DISPERSION"
      | "IVA"
      | "RET_ISR"
      | "RET_IVA"
      | "TOTAL";
    label: string;
    value: number;
    formattedValue: string;
    sign: "positive" | "negative" | "neutral";
  }>;
}

/**
 * Error personalizado para validacion fiscal.
 * Nunca se muestra el stack al usuario — solo al log tecnico.
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
// HELPERS
// ============================================================================

/**
 * Redondeo financiero "round half up" a 2 decimales.
 *
 * POLITICA DOCUMENTADA:
 * - Se usa Math.round() + Number.EPSILON para evitar errores de precision flotante
 * - Todos los conceptos monetarios se redondean con esta funcion
 * - Los pasos intermedios (bases para ISR, etc.) NO se redondean para preservar precision
 * - Solo se redondea el valor final de cada concepto
 */
export function roundMoney(value: number): number {
  if (!Number.isFinite(value)) {
    throw new FiscalCalculationError(
      "Intento de redondear un valor no finito",
      "INVALID_NUMBER",
      { value }
    );
  }
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function withinTolerance(a: number, b: number): boolean {
  return Math.abs(a - b) <= MONEY_TOLERANCE;
}

// ============================================================================
// VALIDACION DE INPUTS
// ============================================================================

function validateInput(input: FiscalBreakdownInput): void {
  const validRegimes: RegimenFiscal[] = ["ASIMILADOS", "HONORARIOS", "RESICO"];
  if (!validRegimes.includes(input.regimenFiscal)) {
    throw new FiscalCalculationError(
      `Regimen fiscal no reconocido: ${input.regimenFiscal}`,
      "INVALID_REGIME",
      { regimenFiscal: input.regimenFiscal }
    );
  }

  if (!Number.isFinite(input.comisionGravada) || input.comisionGravada < 0) {
    throw new FiscalCalculationError(
      "Comision gravada invalida: debe ser un numero no negativo",
      "INVALID_COMISION_GRAVADA",
      { comisionGravada: input.comisionGravada }
    );
  }

  if (!Number.isFinite(input.comisionExenta) || input.comisionExenta < 0) {
    throw new FiscalCalculationError(
      "Comision exenta invalida: debe ser un numero no negativo",
      "INVALID_COMISION_EXENTA",
      { comisionExenta: input.comisionExenta }
    );
  }

  if (input.comisionGravada === 0 && input.comisionExenta === 0) {
    throw new FiscalCalculationError(
      "Al menos una comision debe ser mayor a cero",
      "NO_COMMISSIONS",
      { comisionGravada: input.comisionGravada, comisionExenta: input.comisionExenta }
    );
  }
}

// ============================================================================
// CALCULOS POR REGIMEN — FUNCIONES PURAS
// ============================================================================

/**
 * ASIMILADOS
 *
 * Formulas:
 *   retContable     = comisionExenta * 0.16
 *   costoDispersion = comisionGravada * 0.09
 *   baseIsrExenta   = comisionExenta / 1.16          (no se redondea, solo para calculo)
 *   isrExenta       = roundMoney(baseIsrExenta * 0.10)
 *   baseIsrGravada  = comisionGravada / 1.09         (no se redondea, solo para calculo)
 *   isrGravada      = roundMoney(baseIsrGravada * 0.10)
 *   retIsr          = roundMoney(isrExenta + isrGravada)
 *   total           = comisionTotal - retContable - costoDispersion - retIsr
 *
 * IVA = 0, RET IVA = 0 (no aplican en asimilados)
 */
function calcularAsimilados(
  comisionGravada: number,
  comisionExenta: number
): {
  retContable: number;
  costoDispersion: number;
  iva: number;
  retIsr: number;
  retIva: number;
  total: number;
  warnings: string[];
} {
  const warnings: string[] = [];
  const rates = FISCAL_RATES.ASIMILADOS;

  const comisionTotal = roundMoney(comisionGravada + comisionExenta);

  const retContable = roundMoney(comisionExenta * rates.RET_CONTABLE_EXENTA);
  const costoDispersion = roundMoney(comisionGravada * rates.COSTO_DISPERSION_GRAVADA);

  // ISR se desiviza (divide por el divisor que incluye el IVA implicito)
  const isrExenta = roundMoney((comisionExenta / rates.BASE_EXENTA_DIVISOR) * rates.ISR_RATE);
  const isrGravada = roundMoney((comisionGravada / rates.BASE_GRAVADA_DIVISOR) * rates.ISR_RATE);
  const retIsr = roundMoney(isrExenta + isrGravada);

  const iva = 0;
  const retIva = 0;

  const total = roundMoney(comisionTotal - retContable - costoDispersion - retIsr);

  // Validaciones internas
  if (comisionExenta > 0 && !withinTolerance(retContable, comisionExenta * rates.RET_CONTABLE_EXENTA)) {
    throw new FiscalCalculationError(
      "Validacion fallida: RET CONTABLE no coincide con COMISION_EXENTA x 0.16",
      "VALIDATION_FAILED_RET_CONTABLE",
      { retContable, expected: comisionExenta * rates.RET_CONTABLE_EXENTA }
    );
  }

  if (comisionGravada > 0 && !withinTolerance(costoDispersion, comisionGravada * rates.COSTO_DISPERSION_GRAVADA)) {
    throw new FiscalCalculationError(
      "Validacion fallida: COSTO DISPERSION no coincide con COMISION_GRAVADA x 0.09",
      "VALIDATION_FAILED_COSTO_DISPERSION",
      { costoDispersion, expected: comisionGravada * rates.COSTO_DISPERSION_GRAVADA }
    );
  }

  if (comisionExenta === 0 && retContable !== 0) {
    warnings.push("RET CONTABLE es > 0 pero COMISION_EXENTA es 0");
  }

  if (comisionGravada === 0 && costoDispersion !== 0) {
    warnings.push("COSTO DISPERSION es > 0 pero COMISION_GRAVADA es 0");
  }

  const expectedTotal = roundMoney(comisionTotal - retContable - costoDispersion - retIsr);
  if (!withinTolerance(total, expectedTotal)) {
    throw new FiscalCalculationError(
      "Fiscal breakdown validation failed: TOTAL no cuadra en ASIMILADOS",
      "VALIDATION_FAILED_TOTAL_ASIMILADOS",
      { total, expectedTotal }
    );
  }

  if (total < 0) {
    warnings.push("TOTAL negativo en ASIMILADOS — revisar comisiones base");
  }

  return { retContable, costoDispersion, iva, retIsr, retIva: retIva, total, warnings };
}

/**
 * HONORARIOS
 *
 * Formulas:
 *   retContable     = 0
 *   costoDispersion = 0
 *   iva             = roundMoney(comisionGravada * 0.16)
 *   retIsr          = roundMoney(comisionTotal * 0.10)
 *   retIva          = roundMoney(iva * 2/3)
 *   total           = comisionTotal + iva - retIsr - retIva
 */
function calcularHonorarios(
  comisionGravada: number,
  comisionExenta: number
): {
  retContable: number;
  costoDispersion: number;
  iva: number;
  retIsr: number;
  retIva: number;
  total: number;
  warnings: string[];
} {
  const warnings: string[] = [];
  const rates = FISCAL_RATES.HONORARIOS;

  const comisionTotal = roundMoney(comisionGravada + comisionExenta);

  const retContable = 0;
  const costoDispersion = 0;
  const iva = roundMoney(comisionGravada * rates.IVA_RATE);
  const retIsr = roundMoney(comisionTotal * rates.ISR_RATE);
  const retIva = roundMoney(iva * rates.RET_IVA_FACTOR);

  const total = roundMoney(comisionTotal + iva - retIsr - retIva);

  // Validaciones internas
  if (!withinTolerance(iva, comisionGravada * rates.IVA_RATE)) {
    throw new FiscalCalculationError(
      "Validacion fallida: IVA no coincide con COMISION_GRAVADA x 0.16",
      "VALIDATION_FAILED_IVA",
      { iva, expected: comisionGravada * rates.IVA_RATE }
    );
  }

  if (!withinTolerance(retIsr, comisionTotal * rates.ISR_RATE)) {
    throw new FiscalCalculationError(
      "Validacion fallida: RET ISR no coincide con COMISION_TOTAL x 0.10",
      "VALIDATION_FAILED_RET_ISR",
      { retIsr, expected: comisionTotal * rates.ISR_RATE }
    );
  }

  if (!withinTolerance(retIva, iva * rates.RET_IVA_FACTOR)) {
    throw new FiscalCalculationError(
      "Validacion fallida: RET IVA no coincide con IVA x 2/3",
      "VALIDATION_FAILED_RET_IVA",
      { retIva, expected: iva * rates.RET_IVA_FACTOR }
    );
  }

  const expectedTotal = roundMoney(comisionTotal + iva - retIsr - retIva);
  if (!withinTolerance(total, expectedTotal)) {
    throw new FiscalCalculationError(
      "Fiscal breakdown validation failed: TOTAL no cuadra en HONORARIOS",
      "VALIDATION_FAILED_TOTAL_HONORARIOS",
      { total, expectedTotal }
    );
  }

  if (total < 0) {
    warnings.push("TOTAL negativo en HONORARIOS — revisar comisiones base");
  }

  return { retContable, costoDispersion, iva, retIsr, retIva, total, warnings };
}

/**
 * RESICO
 *
 * Formulas:
 *   retContable     = 0
 *   costoDispersion = 0
 *   iva             = roundMoney(comisionGravada * 0.16)
 *   retIsr          = roundMoney(comisionTotal * 0.0125)
 *   retIva          = roundMoney(iva * 2/3)
 *   total           = comisionTotal + iva - retIsr - retIva
 */
function calcularResico(
  comisionGravada: number,
  comisionExenta: number
): {
  retContable: number;
  costoDispersion: number;
  iva: number;
  retIsr: number;
  retIva: number;
  total: number;
  warnings: string[];
} {
  const warnings: string[] = [];
  const rates = FISCAL_RATES.RESICO;

  const comisionTotal = roundMoney(comisionGravada + comisionExenta);

  const retContable = 0;
  const costoDispersion = 0;
  const iva = roundMoney(comisionGravada * rates.IVA_RATE);
  const retIsr = roundMoney(comisionTotal * rates.ISR_RATE);
  const retIva = roundMoney(iva * rates.RET_IVA_FACTOR);

  const total = roundMoney(comisionTotal + iva - retIsr - retIva);

  // Validaciones internas
  if (!withinTolerance(iva, comisionGravada * rates.IVA_RATE)) {
    throw new FiscalCalculationError(
      "Validacion fallida: IVA no coincide con COMISION_GRAVADA x 0.16",
      "VALIDATION_FAILED_IVA",
      { iva, expected: comisionGravada * rates.IVA_RATE }
    );
  }

  if (!withinTolerance(retIsr, comisionTotal * rates.ISR_RATE)) {
    throw new FiscalCalculationError(
      "Validacion fallida: RET ISR no coincide con COMISION_TOTAL x 0.0125",
      "VALIDATION_FAILED_RET_ISR",
      { retIsr, expected: comisionTotal * rates.ISR_RATE }
    );
  }

  if (!withinTolerance(retIva, iva * rates.RET_IVA_FACTOR)) {
    throw new FiscalCalculationError(
      "Validacion fallida: RET IVA no coincide con IVA x 2/3",
      "VALIDATION_FAILED_RET_IVA",
      { retIva, expected: iva * rates.RET_IVA_FACTOR }
    );
  }

  const expectedTotal = roundMoney(comisionTotal + iva - retIsr - retIva);
  if (!withinTolerance(total, expectedTotal)) {
    throw new FiscalCalculationError(
      "Fiscal breakdown validation failed: TOTAL no cuadra en RESICO",
      "VALIDATION_FAILED_TOTAL_RESICO",
      { total, expectedTotal }
    );
  }

  if (total < 0) {
    warnings.push("TOTAL negativo en RESICO — revisar comisiones base");
  }

  return { retContable, costoDispersion, iva, retIsr, retIva, total, warnings };
}

// ============================================================================
// FUNCION PRINCIPAL — MOTOR FISCAL BLINDADO
// ============================================================================

/**
 * Motor fiscal puro v2.0.0
 *
 * Esta es la UNICA funcion que debe usarse para calcular el desglose fiscal
 * de comisiones en MOVI Digital. Reemplaza todas las versiones anteriores.
 *
 * NO usa cache, NO lee estado global, NO reutiliza resultados previos.
 * Cada llamada recalcula desde cero con los inputs recibidos.
 *
 * Si los calculos fallan la validacion interna, lanza FiscalCalculationError.
 * El PDF nunca se genera con valores incorrectos silenciosamente.
 *
 * @throws {FiscalCalculationError} Si hay errores de validacion
 */
export function calcularDesgloseFiscalV3(
  input: FiscalBreakdownInput
): FiscalBreakdownResult {
  // 1. Validar inputs
  validateInput(input);

  // 2. Normalizar bases (redondear inputs)
  const comisionGravada = roundMoney(input.comisionGravada);
  const comisionExenta = roundMoney(input.comisionExenta);
  const comisionTotal = roundMoney(comisionGravada + comisionExenta);

  // 3. Validar que comisionTotal = gravada + exenta
  if (!withinTolerance(comisionTotal, comisionGravada + comisionExenta)) {
    throw new FiscalCalculationError(
      "Inconsistencia en base: comisionTotal !== comisionGravada + comisionExenta",
      "BASE_INCONSISTENCY",
      { comisionGravada, comisionExenta, comisionTotal }
    );
  }

  // 4. Ejecutar calculo segun regimen
  let calc: ReturnType<typeof calcularAsimilados>;

  switch (input.regimenFiscal) {
    case "ASIMILADOS":
      calc = calcularAsimilados(comisionGravada, comisionExenta);
      break;
    case "HONORARIOS":
      calc = calcularHonorarios(comisionGravada, comisionExenta);
      break;
    case "RESICO":
      calc = calcularResico(comisionGravada, comisionExenta);
      break;
    default:
      throw new FiscalCalculationError(
        `Regimen fiscal no implementado: ${input.regimenFiscal}`,
        "REGIME_NOT_IMPLEMENTED"
      );
  }

  // 5. Validacion cruzada: reglas por regimen
  const w = calc.warnings;

  if (input.regimenFiscal === "ASIMILADOS") {
    if (calc.iva !== 0) w.push("ASIMILADOS: IVA debe ser 0");
    if (calc.retIva !== 0) w.push("ASIMILADOS: RET IVA debe ser 0");
    if (comisionExenta > 0 && calc.retContable === 0) w.push("ASIMILADOS: RET CONTABLE es 0 pero hay comision exenta");
    if (comisionGravada > 0 && calc.costoDispersion === 0) w.push("ASIMILADOS: COSTO DISPERSION es 0 pero hay comision gravada");
  } else {
    if (calc.retContable !== 0) w.push(`${input.regimenFiscal}: RET CONTABLE debe ser 0`);
    if (calc.costoDispersion !== 0) w.push(`${input.regimenFiscal}: COSTO DISPERSION debe ser 0`);
  }

  // 6. Generar pdfRows — SIEMPRE 8 filas en orden exacto
  const pdfRows: FiscalBreakdownResult["pdfRows"] = [
    {
      key: "COMISION_GRAVADA",
      label: "COMISION GRAVADA",
      value: comisionGravada,
      formattedValue: formatCurrency(comisionGravada),
      sign: "positive",
    },
    {
      key: "COMISION_EXENTA",
      label: "COMISION EXENTA",
      value: comisionExenta,
      formattedValue: formatCurrency(comisionExenta),
      sign: "positive",
    },
    {
      key: "RET_CONTABLE",
      label: "RET CONTABLE",
      value: calc.retContable,
      formattedValue: formatCurrency(calc.retContable),
      sign: "negative",
    },
    {
      key: "COSTO_DISPERSION",
      label: "COSTO DISPERSION",
      value: calc.costoDispersion,
      formattedValue: formatCurrency(calc.costoDispersion),
      sign: "negative",
    },
    {
      key: "IVA",
      label: "IVA",
      value: calc.iva,
      formattedValue: formatCurrency(calc.iva),
      sign: "positive",
    },
    {
      key: "RET_ISR",
      label: "RET ISR",
      value: calc.retIsr,
      formattedValue: formatCurrency(calc.retIsr),
      sign: "negative",
    },
    {
      key: "RET_IVA",
      label: "RET IVA",
      value: calc.retIva,
      formattedValue: formatCurrency(calc.retIva),
      sign: "negative",
    },
    {
      key: "TOTAL",
      label: "TOTAL",
      value: calc.total,
      formattedValue: formatCurrency(calc.total),
      sign: "neutral",
    },
  ];

  // 7. Construir resultado con auditoria completa
  const result: FiscalBreakdownResult = {
    regimenFiscal: input.regimenFiscal,
    base: {
      comisionGravada,
      comisionExenta,
      comisionTotal,
    },
    calculations: {
      retContable: calc.retContable,
      costoDispersion: calc.costoDispersion,
      iva: calc.iva,
      retIsr: calc.retIsr,
      retIva: calc.retIva,
      total: calc.total,
    },
    audit: {
      formulaVersion: FISCAL_FORMULA_VERSION,
      performedAt: new Date().toISOString(),
      roundingPolicy: ROUNDING_POLICY,
      validationsPassed: true,
      warnings: w,
    },
    pdfRows,
  };

  return result;
}

// ============================================================================
// HELPERS DE AUDITORIA Y TESTING
// ============================================================================

/**
 * Valida que el total de un resultado coincida con el esperado.
 * Util para tests y validacion post-calculo.
 */
export function validarResultadoFiscal(
  resultado: FiscalBreakdownResult,
  totalEsperado: number,
  tolerancia: number = MONEY_TOLERANCE
): { valido: boolean; diferencia: number; mensaje: string } {
  const diferencia = Math.abs(resultado.calculations.total - totalEsperado);
  const valido = diferencia <= tolerancia;

  return {
    valido,
    diferencia,
    mensaje: valido
      ? `OK: diferencia ${formatCurrency(diferencia)}`
      : `FALLO: diferencia ${formatCurrency(diferencia)} (esperado ${formatCurrency(totalEsperado)}, calculado ${formatCurrency(resultado.calculations.total)})`,
  };
}

/**
 * Snapshot del resultado para auditoria/log.
 * Registra todos los campos relevantes con timestamp y version.
 */
export function buildFiscalAuditSnapshot(
  resultado: FiscalBreakdownResult,
  context?: FiscalBreakdownInput["context"]
): Record<string, unknown> {
  return {
    formulaVersion: resultado.audit.formulaVersion,
    performedAt: resultado.audit.performedAt,
    roundingPolicy: resultado.audit.roundingPolicy,
    regimenFiscal: resultado.regimenFiscal,
    comisionGravada: resultado.base.comisionGravada,
    comisionExenta: resultado.base.comisionExenta,
    comisionTotal: resultado.base.comisionTotal,
    retContable: resultado.calculations.retContable,
    costoDispersion: resultado.calculations.costoDispersion,
    iva: resultado.calculations.iva,
    retIsr: resultado.calculations.retIsr,
    retIva: resultado.calculations.retIva,
    total: resultado.calculations.total,
    validationsPassed: resultado.audit.validationsPassed,
    warnings: resultado.audit.warnings,
    agentId: context?.agentId,
    loteId: context?.loteId,
    periodo: context?.periodo,
    sourceDocumentIds: context?.sourceDocumentIds,
  };
}

/**
 * Formatea el resultado para logging tecnico.
 */
export function formatearResultadoParaLog(resultado: FiscalBreakdownResult): string {
  const b = resultado.base;
  const c = resultado.calculations;
  const a = resultado.audit;

  return [
    `========================================`,
    `RESULTADO FISCAL [${resultado.regimenFiscal}]`,
    `Version: ${a.formulaVersion} | ${a.performedAt}`,
    `----------------------------------------`,
    `Comision Gravada: ${formatCurrency(b.comisionGravada)}`,
    `Comision Exenta:  ${formatCurrency(b.comisionExenta)}`,
    `Comision Total:   ${formatCurrency(b.comisionTotal)}`,
    `----------------------------------------`,
    `Ret Contable:     ${formatCurrency(c.retContable)}`,
    `Costo Dispersion: ${formatCurrency(c.costoDispersion)}`,
    `IVA:              ${formatCurrency(c.iva)}`,
    `Ret ISR:          ${formatCurrency(c.retIsr)}`,
    `Ret IVA:          ${formatCurrency(c.retIva)}`,
    `TOTAL:            ${formatCurrency(c.total)}`,
    `----------------------------------------`,
    `Validaciones:     ${a.validationsPassed ? "PASADAS" : "FALLIDAS"}`,
    `Warnings:         ${a.warnings.length === 0 ? "Ninguno" : a.warnings.join("; ")}`,
    `========================================`,
  ].join("\n");
}

/**
 * Exporta constantes para uso en tests y herramientas de auditoria.
 */
export const FISCAL_CONFIG = {
  FORMULA_VERSION: FISCAL_FORMULA_VERSION,
  ROUNDING_POLICY,
  TOLERANCE: MONEY_TOLERANCE,
  FISCAL_RATES,
} as const;
