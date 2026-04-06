/**
 * MÓDULO DE CÁLCULO FISCAL PARA COMISIONES - VERSIÓN 2
 *
 * Este módulo implementa las fórmulas EXACTAS de cálculo fiscal para los tres
 * regímenes fiscales: ASIMILADOS, HONORARIOS y RESICO.
 *
 * REGLAS GENERALES DE CLASIFICACIÓN:
 * 1. VIDA = COMISION EXENTA
 * 2. NO VIDA = COMISION GRAVADA (incluye VEHICULOS, DAÑOS, ACC y ENF, OTROS)
 * 3. TOTAL = COMISION GRAVADA + COMISION EXENTA
 */

export type RegimenFiscal = "ASIMILADOS" | "HONORARIOS" | "RESICO";

/**
 * Input para el cálculo fiscal
 */
export interface FiscalCalculationInput {
  regimenFiscal: RegimenFiscal;
  comisionGravada: number; // Suma de comisiones NO VIDA
  comisionExenta: number;  // Suma de comisiones VIDA
}

/**
 * Resultado del cálculo fiscal con todos los campos requeridos
 */
export interface FiscalCalculationResult {
  // Campos base
  comisionGravada: number;
  comisionExenta: number;
  comisionTotal: number;

  // Campos calculados (pueden ser 0 si no aplican)
  retContable: number;
  costoDispersion: number;
  iva: number;
  retIsr: number;
  retIva: number;
  total: number;

  // Metadatos
  regimen: RegimenFiscal;
}

/**
 * Campo del desglose fiscal para mostrar en el PDF
 */
export interface FiscalDisplayField {
  label: string;
  value: number;
  formattedValue: string;
  isNegative: boolean; // Si debe mostrarse con signo negativo
  isTotal: boolean;    // Si es la fila de TOTAL
}

/**
 * Redondea un número a 2 decimales
 */
const round2 = (value: number): number =>
  Math.round((value + Number.EPSILON) * 100) / 100;

/**
 * Formatea un valor como moneda mexicana
 */
export const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
};

/**
 * CÁLCULO FISCAL PARA ASIMILADOS
 *
 * FÓRMULAS EXACTAS:
 * - RET CONTABLE = COMISION_EXENTA * 0.16 (solo aplica a VIDA)
 * - COSTO DISPERSION = COMISION_GRAVADA * 0.09 (solo aplica a NO VIDA)
 * - IVA = 0.00 (no aplica)
 * - BASE_ISR_EXENTA = COMISION_EXENTA / 1.16
 * - ISR_EXENTA = BASE_ISR_EXENTA * 0.10
 * - BASE_ISR_GRAVADA = COMISION_GRAVADA / 1.09
 * - ISR_GRAVADA = BASE_ISR_GRAVADA * 0.10
 * - RET_ISR = ISR_EXENTA + ISR_GRAVADA
 * - RET IVA = 0.00 (no aplica)
 * - TOTAL = (COMISION_GRAVADA + COMISION_EXENTA) - RET_CONTABLE - COSTO_DISPERSION - RET_ISR
 */
function calcularAsimilados(
  comisionGravada: number,
  comisionExenta: number
): FiscalCalculationResult {
  const comisionTotal = round2(comisionGravada + comisionExenta);

  // RET CONTABLE: Solo sobre comisión exenta (VIDA)
  const retContable = round2(comisionExenta * 0.16);

  // COSTO DISPERSION: Solo sobre comisión gravada (NO VIDA)
  const costoDispersion = round2(comisionGravada * 0.09);

  // IVA: No aplica en Asimilados
  const iva = 0.00;

  // RET ISR: Se calcula separado para exenta y gravada
  const baseIsrExenta = comisionExenta / 1.16;
  const isrExenta = round2(baseIsrExenta * 0.10);

  const baseIsrGravada = comisionGravada / 1.09;
  const isrGravada = round2(baseIsrGravada * 0.10);

  const retIsr = round2(isrExenta + isrGravada);

  // RET IVA: No aplica en Asimilados
  const retIva = 0.00;

  // TOTAL
  const total = round2(
    comisionTotal - retContable - costoDispersion - retIsr
  );

  return {
    comisionGravada,
    comisionExenta,
    comisionTotal,
    retContable,
    costoDispersion,
    iva,
    retIsr,
    retIva,
    total,
    regimen: 'ASIMILADOS'
  };
}

/**
 * CÁLCULO FISCAL PARA HONORARIOS
 *
 * FÓRMULAS EXACTAS:
 * - RET CONTABLE = 0.00 (no aplica)
 * - COSTO DISPERSION = 0.00 (no aplica)
 * - IVA = COMISION_GRAVADA * 0.16 (solo sobre NO VIDA)
 * - RET_ISR = COMISION_TOTAL * 0.10 (sobre el total)
 * - RET_IVA = IVA * (2/3)
 * - TOTAL = COMISION_TOTAL + IVA - RET_ISR - RET_IVA
 */
function calcularHonorarios(
  comisionGravada: number,
  comisionExenta: number
): FiscalCalculationResult {
  const comisionTotal = round2(comisionGravada + comisionExenta);

  // RET CONTABLE: No aplica
  const retContable = 0.00;

  // COSTO DISPERSION: No aplica
  const costoDispersion = 0.00;

  // IVA: Solo sobre comisión gravada (NO VIDA)
  const iva = round2(comisionGravada * 0.16);

  // RET ISR: Sobre el total de comisiones
  const retIsr = round2(comisionTotal * 0.10);

  // RET IVA: 2/3 del IVA
  const retIva = round2(iva * (2 / 3));

  // TOTAL
  const total = round2(comisionTotal + iva - retIsr - retIva);

  return {
    comisionGravada,
    comisionExenta,
    comisionTotal,
    retContable,
    costoDispersion,
    iva,
    retIsr,
    retIva,
    total,
    regimen: 'HONORARIOS'
  };
}

/**
 * CÁLCULO FISCAL PARA RESICO
 *
 * FÓRMULAS EXACTAS:
 * - RET CONTABLE = 0.00 (no aplica)
 * - COSTO DISPERSION = 0.00 (no aplica)
 * - IVA = COMISION_GRAVADA * 0.16 (solo sobre NO VIDA)
 * - RET_ISR = COMISION_TOTAL * 0.0125 (sobre el total, 1.25%)
 * - RET_IVA = IVA * (2/3)
 * - TOTAL = COMISION_TOTAL + IVA - RET_ISR - RET_IVA
 */
function calcularResico(
  comisionGravada: number,
  comisionExenta: number
): FiscalCalculationResult {
  const comisionTotal = round2(comisionGravada + comisionExenta);

  // RET CONTABLE: No aplica
  const retContable = 0.00;

  // COSTO DISPERSION: No aplica
  const costoDispersion = 0.00;

  // IVA: Solo sobre comisión gravada (NO VIDA)
  const iva = round2(comisionGravada * 0.16);

  // RET ISR: Sobre el total de comisiones (1.25% para RESICO)
  const retIsr = round2(comisionTotal * 0.0125);

  // RET IVA: 2/3 del IVA
  const retIva = round2(iva * (2 / 3));

  // TOTAL
  const total = round2(comisionTotal + iva - retIsr - retIva);

  return {
    comisionGravada,
    comisionExenta,
    comisionTotal,
    retContable,
    costoDispersion,
    iva,
    retIsr,
    retIva,
    total,
    regimen: 'RESICO'
  };
}

/**
 * FUNCIÓN PRINCIPAL: Calcula el desglose fiscal según el régimen
 *
 * Esta función pura recibe las comisiones clasificadas (gravada/exenta) y
 * devuelve el cálculo fiscal completo para el régimen especificado.
 *
 * @param input - Régimen fiscal y comisiones clasificadas
 * @returns Resultado del cálculo fiscal con todos los campos
 */
export function calcularDesgloseFiscalV2(
  input: FiscalCalculationInput
): FiscalCalculationResult {
  const { regimenFiscal, comisionGravada, comisionExenta } = input;

  console.log(`[Fiscal V2] Calculando para ${regimenFiscal}:`);
  console.log(`[Fiscal V2]   Gravada: ${formatCurrency(comisionGravada)}`);
  console.log(`[Fiscal V2]   Exenta: ${formatCurrency(comisionExenta)}`);

  let resultado: FiscalCalculationResult;

  switch (regimenFiscal) {
    case 'ASIMILADOS':
      resultado = calcularAsimilados(comisionGravada, comisionExenta);
      break;

    case 'HONORARIOS':
      resultado = calcularHonorarios(comisionGravada, comisionExenta);
      break;

    case 'RESICO':
      resultado = calcularResico(comisionGravada, comisionExenta);
      break;

    default:
      throw new Error(`Régimen fiscal no reconocido: ${regimenFiscal}`);
  }

  console.log(`[Fiscal V2] Resultado:`);
  console.log(`[Fiscal V2]   Ret Contable: ${formatCurrency(resultado.retContable)}`);
  console.log(`[Fiscal V2]   Costo Dispersión: ${formatCurrency(resultado.costoDispersion)}`);
  console.log(`[Fiscal V2]   IVA: ${formatCurrency(resultado.iva)}`);
  console.log(`[Fiscal V2]   Ret ISR: ${formatCurrency(resultado.retIsr)}`);
  console.log(`[Fiscal V2]   Ret IVA: ${formatCurrency(resultado.retIva)}`);
  console.log(`[Fiscal V2]   TOTAL: ${formatCurrency(resultado.total)}`);

  return resultado;
}

/**
 * Convierte el resultado del cálculo fiscal en campos para mostrar en el PDF
 *
 * SIEMPRE devuelve los 8 campos en este orden:
 * 1. COMISION GRAVADA
 * 2. COMISION EXENTA
 * 3. RET CONTABLE
 * 4. COSTO DISPERSION
 * 5. IVA
 * 6. RET ISR
 * 7. RET IVA
 * 8. TOTAL
 *
 * Los campos que no aplican se muestran en $0.00
 */
export function convertirADisplayFields(
  resultado: FiscalCalculationResult
): FiscalDisplayField[] {
  return [
    {
      label: 'COMISION GRAVADA',
      value: resultado.comisionGravada,
      formattedValue: formatCurrency(resultado.comisionGravada),
      isNegative: false,
      isTotal: false
    },
    {
      label: 'COMISION EXENTA',
      value: resultado.comisionExenta,
      formattedValue: formatCurrency(resultado.comisionExenta),
      isNegative: false,
      isTotal: false
    },
    {
      label: 'RET CONTABLE',
      value: resultado.retContable,
      formattedValue: formatCurrency(resultado.retContable),
      isNegative: true,
      isTotal: false
    },
    {
      label: 'COSTO DISPERSION',
      value: resultado.costoDispersion,
      formattedValue: formatCurrency(resultado.costoDispersion),
      isNegative: true,
      isTotal: false
    },
    {
      label: 'IVA',
      value: resultado.iva,
      formattedValue: formatCurrency(resultado.iva),
      isNegative: false,
      isTotal: false
    },
    {
      label: 'RET ISR',
      value: resultado.retIsr,
      formattedValue: formatCurrency(resultado.retIsr),
      isNegative: true,
      isTotal: false
    },
    {
      label: 'RET IVA',
      value: resultado.retIva,
      formattedValue: formatCurrency(resultado.retIva),
      isNegative: true,
      isTotal: false
    },
    {
      label: 'TOTAL',
      value: resultado.total,
      formattedValue: formatCurrency(resultado.total),
      isNegative: false,
      isTotal: true
    }
  ];
}

/**
 * Clasifica las comisiones por ramo en gravada (NO VIDA) y exenta (VIDA)
 *
 * @param comisionesPorRamo - Mapa de ramo -> comisión
 * @returns Objeto con comisionGravada y comisionExenta
 */
export function clasificarComisionesPorRamo(
  comisionesPorRamo: Map<string, number>
): { comisionGravada: number; comisionExenta: number } {
  let comisionExenta = 0;
  let comisionGravada = 0;

  comisionesPorRamo.forEach((comision, ramo) => {
    if (ramo.toLowerCase() === 'vida') {
      comisionExenta += comision;
    } else {
      comisionGravada += comision;
    }
  });

  return {
    comisionGravada: round2(comisionGravada),
    comisionExenta: round2(comisionExenta)
  };
}

/**
 * VALIDACIÓN: Verifica que el resultado coincida con un total esperado
 * Útil para testing y validación de casos conocidos
 */
export function validarResultadoFiscal(
  resultado: FiscalCalculationResult,
  totalEsperado: number,
  tolerancia: number = 0.02
): { valido: boolean; diferencia: number } {
  const diferencia = Math.abs(resultado.total - totalEsperado);
  return {
    valido: diferencia <= tolerancia,
    diferencia
  };
}
