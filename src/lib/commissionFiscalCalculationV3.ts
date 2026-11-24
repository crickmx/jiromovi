/**
 * MOTOR FISCAL BLINDADO - COMISIONES MOVI DIGITAL
 *
 * @version fiscal_v3_audit
 *
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │ INSTRUCCION CRITICA — NO MODIFICAR                                     │
 * │                                                                         │
 * │ Este modulo corresponde al calculo fiscal oficial de comisiones en      │
 * │ MOVI Digital. NO se debe modificar, reinterpretar, optimizar,           │
 * │ simplificar ni ajustar esta logica bajo ninguna circunstancia.          │
 * │                                                                         │
 * │ Cualquier cambio debe venir de validacion fiscal explícita.             │
 * │ Cualquier cambio sin validacion fiscal formal es RIESGO LEGAL.         │
 * └─────────────────────────────────────────────────────────────────────────┘
 *
 * BASES:
 *   comision_gravada = comisiones ramos NO VIDA (vehiculos, danos, acc/enf, otros)
 *   comision_exenta  = comisiones VIDA
 *   total_comisiones = gravada + exenta
 *
 * SEPARACION OBLIGATORIA:
 *   BLOQUE FISCAL    → IVA, RET ISR, RET IVA → total_fiscal
 *   BLOQUE OPERATIVO → ret_contable, costo_dispersion (solo ASIMILADOS)
 *   TOTAL FINAL      → total_fiscal - ret_contable - costo_dispersion
 *
 * GARANTIAS:
 *   - Funcion pura: sin efectos secundarios, sin estado global, sin cache
 *   - Cada invocacion recalcula desde cero
 *   - Errores bloqueantes en condiciones fiscalmente invalidas
 *   - Auditoria completa con version "fiscal_v3_audit" y timestamp
 *   - Determinista: mismo input = mismo output siempre
 */

// ============================================================================
// VERSION Y CONSTANTES
// ============================================================================

export const FISCAL_FORMULA_VERSION = "fiscal_v3_audit" as const;
const ROUNDING_POLICY = "round-half-up-2-decimals" as const;

/**
 * Tolerancia monetaria para validaciones internas ($0.01).
 */
export const MONEY_TOLERANCE = 0.01 as const;

// Tasas fiscales por regimen — inmutables
// PROHIBICION: NO cambiar estos valores sin validacion fiscal formal
const FISCAL_RATES = {
  HONORARIOS: {
    IVA_RATE: 0.16,           // IVA 16% sobre comision_gravada
    ISR_RATE: 0.14,           // Retencion ISR 14% sobre comision_gravada
    RET_IVA_FACTOR: 2 / 3,   // Retencion IVA = 2/3 del IVA
  },
  RESICO: {
    IVA_RATE: 0.16,           // IVA 16% sobre comision_gravada
    ISR_RATE_DEFAULT: 0.0125, // Tasa ISR por defecto 1.25%
    ISR_RATE_MIN: 0.01,       // Minimo fiscal permitido 1%
    ISR_RATE_MAX: 0.025,      // Maximo fiscal permitido 2.5%
    RET_IVA_FACTOR: 2 / 3,   // Retencion IVA = 2/3 del IVA
  },
  ASIMILADOS: {
    RET_CONTABLE_RATE: 0.16,     // Retencion contable 16% sobre exenta (OPERATIVO)
    COSTO_DISPERSION_RATE: 0.09, // Costo dispersion 9% sobre gravada (OPERATIVO)
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
   * Para ASIMILADOS: tasa ISR configurable (temporal hasta integrar tabla ISR).
   * Si no se provee, lanza error bloqueante.
   */
  asimiladosIsrRate?: number;
  /**
   * Para RESICO: tasa ISR configurable entre 1% y 2.5%.
   * Por defecto 1.25%. Fuera de rango → error bloqueante.
   */
  resicoIsrRate?: number;
  /**
   * Contexto opcional para auditoria y trazabilidad.
   * comisionTotal NO debe venir como input — se calcula internamente.
   */
  context?: {
    agentId?: string;
    loteId?: string;
    batchId?: string;
    periodo?: string;
    sourceDocumentIds?: string[];
  };
}

/**
 * Resultado del motor fiscal con separacion FISCAL / OPERATIVO.
 */
export interface FiscalBreakdownResult {
  regimenFiscal: RegimenFiscal;

  base: {
    comisionGravada: number;
    comisionExenta: number;
    /** Siempre calculado internamente: gravada + exenta */
    comisionTotal: number;
  };

  /**
   * BLOQUE FISCAL (SAT)
   * Contiene solo los conceptos de retencion y liquidacion fiscal.
   */
  fiscal: {
    iva: number;
    retIsr: number;
    retIva: number;
    totalFiscal: number;
  };

  /**
   * BLOQUE OPERATIVO (JIRO)
   * Solo aplica en ASIMILADOS. En HONORARIOS y RESICO son 0.
   */
  operativo: {
    retContable: number;
    costoDispersion: number;
  };

  /**
   * TOTAL FINAL = totalFiscal - retContable - costoDispersion
   */
  totalFinal: number;

  /**
   * @deprecated Alias de compatibilidad. Usar fiscal y operativo directamente.
   */
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
    baseCalculo: string;
    formulasUsadas: Record<string, string>;
    performedAt: string;
    roundingPolicy: string;
    validationsPassed: boolean;
    warnings: string[];
  };

  /**
   * SECCION 3 — DESGLOSE FISCAL (PDF)
   * Contiene las filas del bloque fiscal.
   * Siempre en este orden: COMISION_GRAVADA, COMISION_EXENTA, IVA, RET_ISR, RET_IVA, TOTAL_FISCAL
   */
  pdfFiscalRows: Array<{
    key:
      | "COMISION_GRAVADA"
      | "COMISION_EXENTA"
      | "IVA"
      | "RET_ISR"
      | "RET_IVA"
      | "TOTAL_FISCAL";
    label: string;
    value: number;
    formattedValue: string;
    sign: "positive" | "negative" | "neutral";
  }>;

  /**
   * SECCION 4 — AJUSTES OPERATIVOS (PDF)
   * Solo presente en ASIMILADOS (2 filas). Vacio en otros regimenes.
   */
  pdfOperativoRows: Array<{
    key: "RET_CONTABLE" | "COSTO_DISPERSION";
    label: string;
    value: number;
    formattedValue: string;
    sign: "negative";
  }>;

  /**
   * @deprecated Alias de compatibilidad para PDF. Contiene las 8 filas combinadas.
   * Para nuevas implementaciones usar pdfFiscalRows + pdfOperativoRows.
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
 * Error bloqueante para condiciones fiscalmente invalidas.
 * El PDF NUNCA se genera si este error es lanzado.
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
 * POLITICA: Math.round() + Number.EPSILON para evitar errores flotantes.
 * Pasos intermedios (bases para ISR) NO se redondean para preservar precision.
 * Solo se redondea el valor final de cada concepto.
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

  // ASIMILADOS: requiere tasa ISR explicita
  if (input.regimenFiscal === "ASIMILADOS") {
    if (input.asimiladosIsrRate === undefined || input.asimiladosIsrRate === null) {
      throw new FiscalCalculationError(
        "ASIMILADOS requiere asimiladosIsrRate — parametro obligatorio",
        "MISSING_ASIMILADOS_ISR_RATE"
      );
    }
    if (!Number.isFinite(input.asimiladosIsrRate) || input.asimiladosIsrRate <= 0) {
      throw new FiscalCalculationError(
        "asimiladosIsrRate invalido: debe ser un numero positivo",
        "INVALID_ASIMILADOS_ISR_RATE",
        { asimiladosIsrRate: input.asimiladosIsrRate }
      );
    }
  }

  // RESICO: tasa ISR debe estar entre 1% y 2.5%
  if (input.regimenFiscal === "RESICO") {
    const rate = input.resicoIsrRate ?? FISCAL_RATES.RESICO.ISR_RATE_DEFAULT;
    if (rate < FISCAL_RATES.RESICO.ISR_RATE_MIN || rate > FISCAL_RATES.RESICO.ISR_RATE_MAX) {
      throw new FiscalCalculationError(
        `ISR RESICO fuera de rango: ${(rate * 100).toFixed(4)}%. Debe estar entre 1% y 2.5%`,
        "RESICO_ISR_OUT_OF_RANGE",
        { rate, min: FISCAL_RATES.RESICO.ISR_RATE_MIN, max: FISCAL_RATES.RESICO.ISR_RATE_MAX }
      );
    }
  }
}

// ============================================================================
// CALCULOS POR REGIMEN — FUNCIONES PURAS
// ============================================================================

/**
 * HONORARIOS (Persona Fisica)
 *
 * BLOQUE FISCAL:
 *   iva      = comisionGravada * 0.16
 *   ret_iva  = iva * (2/3)
 *   ret_isr  = comisionGravada * 0.14
 *
 * TOTAL FISCAL:
 *   total_fiscal = total_comisiones + iva - ret_isr - ret_iva
 *
 * REGLAS:
 *   - comision_exenta NO genera IVA
 *   - comision_exenta NO entra en retenciones
 *   - NO hay bloque operativo
 */
function calcularHonorarios(
  comisionGravada: number,
  comisionExenta: number
): {
  iva: number;
  retIsr: number;
  retIva: number;
  totalFiscal: number;
  retContable: number;
  costoDispersion: number;
  warnings: string[];
  formulasUsadas: Record<string, string>;
} {
  const warnings: string[] = [];
  const rates = FISCAL_RATES.HONORARIOS;
  const comisionTotal = roundMoney(comisionGravada + comisionExenta);

  const iva = roundMoney(comisionGravada * rates.IVA_RATE);
  const retIsr = roundMoney(comisionGravada * rates.ISR_RATE);
  const retIva = roundMoney(iva * rates.RET_IVA_FACTOR);
  const totalFiscal = roundMoney(comisionTotal + iva - retIsr - retIva);

  // Validaciones bloqueantes
  if (!withinTolerance(iva, comisionGravada * rates.IVA_RATE)) {
    throw new FiscalCalculationError(
      "Validacion fallida: IVA no coincide con comision_gravada * 0.16",
      "VALIDATION_FAILED_IVA",
      { iva, expected: comisionGravada * rates.IVA_RATE }
    );
  }

  if (!withinTolerance(retIsr, comisionGravada * rates.ISR_RATE)) {
    throw new FiscalCalculationError(
      "Validacion fallida: RET ISR no coincide con comision_gravada * 0.14",
      "VALIDATION_FAILED_RET_ISR",
      { retIsr, expected: comisionGravada * rates.ISR_RATE }
    );
  }

  if (!withinTolerance(retIva, iva * rates.RET_IVA_FACTOR)) {
    throw new FiscalCalculationError(
      "Validacion fallida: RET IVA no coincide con IVA * 2/3",
      "VALIDATION_FAILED_RET_IVA",
      { retIva, expected: iva * rates.RET_IVA_FACTOR }
    );
  }

  // Verificar que ret_iva sea aproximadamente 2/3 del iva (10.6667%)
  if (iva > 0 && !withinTolerance(retIva / iva, rates.RET_IVA_FACTOR)) {
    throw new FiscalCalculationError(
      "Validacion fallida: proporcion RET_IVA / IVA no es 2/3",
      "VALIDATION_FAILED_RET_IVA_PROPORCION",
      { retIva, iva, proporcion: retIva / iva, esperado: rates.RET_IVA_FACTOR }
    );
  }

  const expectedTotal = roundMoney(comisionTotal + iva - retIsr - retIva);
  if (!withinTolerance(totalFiscal, expectedTotal)) {
    throw new FiscalCalculationError(
      "Validacion fallida: TOTAL FISCAL no cuadra en HONORARIOS",
      "VALIDATION_FAILED_TOTAL_FISCAL_HONORARIOS",
      { totalFiscal, expectedTotal }
    );
  }

  if (totalFiscal < 0) {
    warnings.push("TOTAL FISCAL negativo en HONORARIOS — revisar comisiones base");
  }

  const formulasUsadas: Record<string, string> = {
    iva: `comisionGravada(${comisionGravada}) * 0.16`,
    retIsr: `comisionGravada(${comisionGravada}) * 0.14`,
    retIva: `iva(${iva}) * 2/3`,
    totalFiscal: `comisionTotal(${comisionTotal}) + iva(${iva}) - retIsr(${retIsr}) - retIva(${retIva})`,
  };

  return { iva, retIsr, retIva, totalFiscal, retContable: 0, costoDispersion: 0, warnings, formulasUsadas };
}

/**
 * RESICO
 *
 * BLOQUE FISCAL:
 *   iva      = comisionGravada * 0.16
 *   ret_iva  = iva * (2/3)
 *   ret_isr  = comisionGravada * resico_isr_rate   (base: GRAVADA, no total)
 *
 * TOTAL FISCAL:
 *   total_fiscal = total_comisiones + iva - ret_isr - ret_iva
 *
 * REGLAS CRITICAS:
 *   resico_isr_rate en [1%, 2.5%] — fuera de rango = ERROR BLOQUEANTE
 */
function calcularResico(
  comisionGravada: number,
  comisionExenta: number,
  resicoIsrRate: number
): {
  iva: number;
  retIsr: number;
  retIva: number;
  totalFiscal: number;
  retContable: number;
  costoDispersion: number;
  warnings: string[];
  formulasUsadas: Record<string, string>;
} {
  const warnings: string[] = [];
  const rates = FISCAL_RATES.RESICO;
  const comisionTotal = roundMoney(comisionGravada + comisionExenta);

  const iva = roundMoney(comisionGravada * rates.IVA_RATE);
  const retIsr = roundMoney(comisionGravada * resicoIsrRate);
  const retIva = roundMoney(iva * rates.RET_IVA_FACTOR);
  const totalFiscal = roundMoney(comisionTotal + iva - retIsr - retIva);

  // Validaciones bloqueantes
  if (!withinTolerance(iva, comisionGravada * rates.IVA_RATE)) {
    throw new FiscalCalculationError(
      "Validacion fallida: IVA no coincide con comision_gravada * 0.16",
      "VALIDATION_FAILED_IVA",
      { iva, expected: comisionGravada * rates.IVA_RATE }
    );
  }

  if (!withinTolerance(retIsr, comisionGravada * resicoIsrRate)) {
    throw new FiscalCalculationError(
      `Validacion fallida: RET ISR no coincide con comision_gravada * ${resicoIsrRate}`,
      "VALIDATION_FAILED_RET_ISR",
      { retIsr, expected: comisionGravada * resicoIsrRate }
    );
  }

  if (!withinTolerance(retIva, iva * rates.RET_IVA_FACTOR)) {
    throw new FiscalCalculationError(
      "Validacion fallida: RET IVA no coincide con IVA * 2/3",
      "VALIDATION_FAILED_RET_IVA",
      { retIva, expected: iva * rates.RET_IVA_FACTOR }
    );
  }

  if (iva > 0 && !withinTolerance(retIva / iva, rates.RET_IVA_FACTOR)) {
    throw new FiscalCalculationError(
      "Validacion fallida: proporcion RET_IVA / IVA no es 2/3",
      "VALIDATION_FAILED_RET_IVA_PROPORCION",
      { retIva, iva, proporcion: retIva / iva, esperado: rates.RET_IVA_FACTOR }
    );
  }

  // Verificar que IVA no se calculo sobre exentos (prohibicion critica)
  if (comisionExenta > 0) {
    const ivaMaxPermitido = roundMoney(comisionGravada * rates.IVA_RATE);
    if (iva > ivaMaxPermitido + MONEY_TOLERANCE) {
      throw new FiscalCalculationError(
        "IVA calculado sobre comisiones exentas — prohibicion critica",
        "IVA_SOBRE_EXENTOS",
        { iva, ivaMaxPermitido, comisionExenta }
      );
    }
  }

  const expectedTotal = roundMoney(comisionTotal + iva - retIsr - retIva);
  if (!withinTolerance(totalFiscal, expectedTotal)) {
    throw new FiscalCalculationError(
      "Validacion fallida: TOTAL FISCAL no cuadra en RESICO",
      "VALIDATION_FAILED_TOTAL_FISCAL_RESICO",
      { totalFiscal, expectedTotal }
    );
  }

  if (totalFiscal < 0) {
    warnings.push("TOTAL FISCAL negativo en RESICO — revisar comisiones base");
  }

  const formulasUsadas: Record<string, string> = {
    iva: `comisionGravada(${comisionGravada}) * 0.16`,
    retIsr: `comisionGravada(${comisionGravada}) * ${resicoIsrRate} (GRAVADA, no total)`,
    retIva: `iva(${iva}) * 2/3`,
    totalFiscal: `comisionTotal(${comisionTotal}) + iva(${iva}) - retIsr(${retIsr}) - retIva(${retIva})`,
  };

  return { iva, retIsr, retIva, totalFiscal, retContable: 0, costoDispersion: 0, warnings, formulasUsadas };
}

/**
 * ASIMILADOS
 *
 * BLOQUE FISCAL (SAT):
 *   ret_isr      = comisionGravada * asimilados_isr_rate
 *   total_fiscal = total_comisiones - ret_isr
 *
 * BLOQUE OPERATIVO (JIRO):
 *   ret_contable     = comisionExenta * 0.16
 *   costo_dispersion = comisionGravada * 0.09
 *
 * TOTAL FINAL:
 *   total_final = total_fiscal - ret_contable - costo_dispersion
 *
 * REGLAS:
 *   - NO hay IVA
 *   - NO hay retencion de IVA
 *   - ISR se calcula SOLO sobre comision_gravada
 */
function calcularAsimilados(
  comisionGravada: number,
  comisionExenta: number,
  asimiladosIsrRate: number
): {
  iva: number;
  retIsr: number;
  retIva: number;
  totalFiscal: number;
  retContable: number;
  costoDispersion: number;
  warnings: string[];
  formulasUsadas: Record<string, string>;
} {
  const warnings: string[] = [];
  const rates = FISCAL_RATES.ASIMILADOS;
  const comisionTotal = roundMoney(comisionGravada + comisionExenta);

  // BLOQUE FISCAL
  const iva = 0;
  const retIva = 0;
  const retIsr = roundMoney(comisionGravada * asimiladosIsrRate);
  const totalFiscal = roundMoney(comisionTotal - retIsr);

  // BLOQUE OPERATIVO
  const retContable = roundMoney(comisionExenta * rates.RET_CONTABLE_RATE);
  const costoDispersion = roundMoney(comisionGravada * rates.COSTO_DISPERSION_RATE);

  // Validaciones bloqueantes
  if (!withinTolerance(retIsr, comisionGravada * asimiladosIsrRate)) {
    throw new FiscalCalculationError(
      `Validacion fallida: RET ISR no coincide con comision_gravada * ${asimiladosIsrRate}`,
      "VALIDATION_FAILED_RET_ISR",
      { retIsr, expected: comisionGravada * asimiladosIsrRate }
    );
  }

  // ISR no puede aplicarse sobre exentos (validacion critica)
  const isrMaxPermitido = roundMoney(comisionGravada * asimiladosIsrRate);
  if (retIsr > isrMaxPermitido + MONEY_TOLERANCE) {
    throw new FiscalCalculationError(
      "ISR aplicado sobre comisiones exentas — prohibicion critica",
      "ISR_SOBRE_EXENTOS",
      { retIsr, isrMaxPermitido, comisionExenta }
    );
  }

  if (!withinTolerance(retContable, comisionExenta * rates.RET_CONTABLE_RATE)) {
    throw new FiscalCalculationError(
      "Validacion fallida: RET CONTABLE no coincide con comision_exenta * 0.16",
      "VALIDATION_FAILED_RET_CONTABLE",
      { retContable, expected: comisionExenta * rates.RET_CONTABLE_RATE }
    );
  }

  if (!withinTolerance(costoDispersion, comisionGravada * rates.COSTO_DISPERSION_RATE)) {
    throw new FiscalCalculationError(
      "Validacion fallida: COSTO DISPERSION no coincide con comision_gravada * 0.09",
      "VALIDATION_FAILED_COSTO_DISPERSION",
      { costoDispersion, expected: comisionGravada * rates.COSTO_DISPERSION_RATE }
    );
  }

  const expectedTotalFiscal = roundMoney(comisionTotal - retIsr);
  if (!withinTolerance(totalFiscal, expectedTotalFiscal)) {
    throw new FiscalCalculationError(
      "Validacion fallida: TOTAL FISCAL no cuadra en ASIMILADOS",
      "VALIDATION_FAILED_TOTAL_FISCAL_ASIMILADOS",
      { totalFiscal, expectedTotalFiscal }
    );
  }

  if (totalFiscal < 0) {
    warnings.push("TOTAL FISCAL negativo en ASIMILADOS — revisar comisiones base");
  }

  const formulasUsadas: Record<string, string> = {
    retIsr: `comisionGravada(${comisionGravada}) * ${asimiladosIsrRate} (GRAVADA, no total)`,
    totalFiscal: `comisionTotal(${comisionTotal}) - retIsr(${retIsr})`,
    retContable: `comisionExenta(${comisionExenta}) * 0.16 [OPERATIVO]`,
    costoDispersion: `comisionGravada(${comisionGravada}) * 0.09 [OPERATIVO]`,
    totalFinal: `totalFiscal(${totalFiscal}) - retContable(${retContable}) - costoDispersion(${costoDispersion})`,
  };

  return { iva, retIsr, retIva, totalFiscal, retContable, costoDispersion, warnings, formulasUsadas };
}

// ============================================================================
// FUNCION PRINCIPAL — MOTOR FISCAL BLINDADO
// ============================================================================

/**
 * Motor fiscal blindado — version fiscal_v3_audit
 *
 * UNICA funcion autorizada para calcular el desglose fiscal de comisiones.
 * NO usa cache, NO lee estado global, NO reutiliza resultados previos.
 * Cada llamada recalcula desde cero con los inputs recibidos.
 *
 * Si los calculos fallan la validacion, lanza FiscalCalculationError.
 * El PDF NUNCA se genera con valores incorrectos silenciosamente.
 *
 * @throws {FiscalCalculationError} Si hay errores de validacion fiscal
 */
export function calcularDesgloseFiscalV3(
  input: FiscalBreakdownInput
): FiscalBreakdownResult {
  // 1. Validar inputs — puede lanzar FiscalCalculationError
  validateInput(input);

  // 2. Normalizar bases
  const comisionGravada = roundMoney(input.comisionGravada);
  const comisionExenta = roundMoney(input.comisionExenta);
  const comisionTotal = roundMoney(comisionGravada + comisionExenta);

  if (!withinTolerance(comisionTotal, comisionGravada + comisionExenta)) {
    throw new FiscalCalculationError(
      "Inconsistencia en base: comisionTotal !== comisionGravada + comisionExenta",
      "BASE_INCONSISTENCY",
      { comisionGravada, comisionExenta, comisionTotal }
    );
  }

  // 3. Calcular segun regimen
  type CalcResult = ReturnType<typeof calcularHonorarios>;
  let calc: CalcResult;

  switch (input.regimenFiscal) {
    case "HONORARIOS":
      calc = calcularHonorarios(comisionGravada, comisionExenta);
      break;
    case "RESICO": {
      const resicoRate = input.resicoIsrRate ?? FISCAL_RATES.RESICO.ISR_RATE_DEFAULT;
      calc = calcularResico(comisionGravada, comisionExenta, resicoRate);
      break;
    }
    case "ASIMILADOS":
      calc = calcularAsimilados(comisionGravada, comisionExenta, input.asimiladosIsrRate!);
      break;
    default:
      throw new FiscalCalculationError(
        `Regimen fiscal no implementado: ${input.regimenFiscal}`,
        "REGIME_NOT_IMPLEMENTED"
      );
  }

  // 4. Calcular total final
  const totalFinal = roundMoney(calc.totalFiscal - calc.retContable - calc.costoDispersion);

  // 5. Validaciones cruzadas de separacion fiscal/operativo
  const w = calc.warnings;
  if (input.regimenFiscal !== "ASIMILADOS") {
    if (calc.retContable !== 0) w.push(`${input.regimenFiscal}: RET CONTABLE debe ser 0 (solo ASIMILADOS)`);
    if (calc.costoDispersion !== 0) w.push(`${input.regimenFiscal}: COSTO DISPERSION debe ser 0 (solo ASIMILADOS)`);
  }
  if (input.regimenFiscal === "ASIMILADOS") {
    if (calc.iva !== 0) w.push("ASIMILADOS: IVA debe ser 0 (sin IVA en asimilados)");
    if (calc.retIva !== 0) w.push("ASIMILADOS: RET IVA debe ser 0 (sin IVA en asimilados)");
  }

  // 6. Construir pdfFiscalRows — Seccion 3: DESGLOSE FISCAL
  const pdfFiscalRows: FiscalBreakdownResult["pdfFiscalRows"] = [
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
      key: "TOTAL_FISCAL",
      label: "TOTAL FISCAL",
      value: calc.totalFiscal,
      formattedValue: formatCurrency(calc.totalFiscal),
      sign: "neutral",
    },
  ];

  // 7. Construir pdfOperativoRows — Seccion 4: AJUSTES OPERATIVOS (solo ASIMILADOS)
  const pdfOperativoRows: FiscalBreakdownResult["pdfOperativoRows"] =
    input.regimenFiscal === "ASIMILADOS"
      ? [
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
        ]
      : [];

  // 8. Construir pdfRows — alias de compatibilidad (8 filas combinadas)
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
      value: totalFinal,
      formattedValue: formatCurrency(totalFinal),
      sign: "neutral",
    },
  ];

  // 9. Construir resultado completo con auditoria
  const baseCalculo = [
    `comision_gravada=${comisionGravada}`,
    `comision_exenta=${comisionExenta}`,
    `total_comisiones=${comisionTotal}`,
  ].join(", ");

  const result: FiscalBreakdownResult = {
    regimenFiscal: input.regimenFiscal,
    base: {
      comisionGravada,
      comisionExenta,
      comisionTotal,
    },
    fiscal: {
      iva: calc.iva,
      retIsr: calc.retIsr,
      retIva: calc.retIva,
      totalFiscal: calc.totalFiscal,
    },
    operativo: {
      retContable: calc.retContable,
      costoDispersion: calc.costoDispersion,
    },
    totalFinal,
    calculations: {
      retContable: calc.retContable,
      costoDispersion: calc.costoDispersion,
      iva: calc.iva,
      retIsr: calc.retIsr,
      retIva: calc.retIva,
      total: totalFinal,
    },
    audit: {
      formulaVersion: FISCAL_FORMULA_VERSION,
      baseCalculo,
      formulasUsadas: calc.formulasUsadas,
      performedAt: new Date().toISOString(),
      roundingPolicy: ROUNDING_POLICY,
      validationsPassed: true,
      warnings: w,
    },
    pdfFiscalRows,
    pdfOperativoRows,
    pdfRows,
  };

  return result;
}

// ============================================================================
// HELPERS DE AUDITORIA Y TESTING
// ============================================================================

/**
 * Valida que el total final de un resultado coincida con el esperado.
 */
export function validarResultadoFiscal(
  resultado: FiscalBreakdownResult,
  totalEsperado: number,
  tolerancia: number = MONEY_TOLERANCE
): { valido: boolean; diferencia: number; mensaje: string } {
  const diferencia = Math.abs(resultado.totalFinal - totalEsperado);
  const valido = diferencia <= tolerancia;

  return {
    valido,
    diferencia,
    mensaje: valido
      ? `OK: diferencia ${formatCurrency(diferencia)}`
      : `FALLO: diferencia ${formatCurrency(diferencia)} (esperado ${formatCurrency(totalEsperado)}, calculado ${formatCurrency(resultado.totalFinal)})`,
  };
}

/**
 * Snapshot de auditoria completo para log/persistencia.
 * Incluye base_calculo, formulas_usadas y version_calculo = "fiscal_v3_audit".
 */
export function buildFiscalAuditSnapshot(
  resultado: FiscalBreakdownResult,
  context?: FiscalBreakdownInput["context"]
): Record<string, unknown> {
  return {
    version_calculo: resultado.audit.formulaVersion,
    base_calculo: resultado.audit.baseCalculo,
    formulas_usadas: resultado.audit.formulasUsadas,
    performedAt: resultado.audit.performedAt,
    roundingPolicy: resultado.audit.roundingPolicy,
    regimenFiscal: resultado.regimenFiscal,
    // Base
    comisionGravada: resultado.base.comisionGravada,
    comisionExenta: resultado.base.comisionExenta,
    comisionTotal: resultado.base.comisionTotal,
    // Bloque fiscal
    iva: resultado.fiscal.iva,
    retIsr: resultado.fiscal.retIsr,
    retIva: resultado.fiscal.retIva,
    totalFiscal: resultado.fiscal.totalFiscal,
    // Bloque operativo
    retContable: resultado.operativo.retContable,
    costoDispersion: resultado.operativo.costoDispersion,
    // Total final
    totalFinal: resultado.totalFinal,
    // Auditoria
    validationsPassed: resultado.audit.validationsPassed,
    warnings: resultado.audit.warnings,
    // Contexto
    agentId: context?.agentId,
    loteId: context?.loteId ?? context?.batchId,
    periodo: context?.periodo,
    sourceDocumentIds: context?.sourceDocumentIds,
  };
}

/**
 * Formatea el resultado para logging tecnico.
 */
export function formatearResultadoParaLog(resultado: FiscalBreakdownResult): string {
  const b = resultado.base;
  const f = resultado.fiscal;
  const o = resultado.operativo;
  const a = resultado.audit;

  return [
    `========================================`,
    `RESULTADO FISCAL [${resultado.regimenFiscal}]`,
    `Version: ${a.formulaVersion} | ${a.performedAt}`,
    `Base: ${a.baseCalculo}`,
    `----------------------------------------`,
    `Comision Gravada: ${formatCurrency(b.comisionGravada)}`,
    `Comision Exenta:  ${formatCurrency(b.comisionExenta)}`,
    `Comision Total:   ${formatCurrency(b.comisionTotal)}`,
    `--- BLOQUE FISCAL (SAT) ---`,
    `IVA:              ${formatCurrency(f.iva)}`,
    `Ret ISR:          ${formatCurrency(f.retIsr)}`,
    `Ret IVA:          ${formatCurrency(f.retIva)}`,
    `TOTAL FISCAL:     ${formatCurrency(f.totalFiscal)}`,
    `--- BLOQUE OPERATIVO (JIRO) ---`,
    `Ret Contable:     ${formatCurrency(o.retContable)}`,
    `Costo Dispersion: ${formatCurrency(o.costoDispersion)}`,
    `--- TOTAL FINAL ---`,
    `TOTAL FINAL:      ${formatCurrency(resultado.totalFinal)}`,
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
