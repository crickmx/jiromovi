/**
 * Módulo de Cálculo Fiscal para Comisiones
 *
 * IMPORTANTE:
 * Los porcentajes usados (1.25% RESICO, 10% Honorarios, IVA 16%, 2/3 de IVA retenido, 9% dispersión Asimilados)
 * se basan en reglas fiscales vigentes en México para retenciones de ISR e IVA a personas físicas
 * (RESICO y servicios profesionales).
 *
 * Estos valores deben considerarse parámetros configurables en una futura pantalla de
 * configuración fiscal, y siempre validarse con el área contable/fiscal de la empresa
 * antes de usarse en producción.
 */

export type RegimenFiscal = "RESICO" | "HONORARIOS" | "ASIMILADOS";

export interface RamoResumen {
  ramo: string;
  comisionNeta: number; // Para HONORARIOS: usar importe_base (Prima Total)
  primaTotal?: number; // Opcional: Prima Total explícita para claridad
}

export interface DesgloseFiscal {
  vida: number;
  sinVida: number;
  retContable: number;
  costoDispersion: number;
  iva: number;
  retIsr: number;
  retIva: number;
  isrVida: number;
  isrDanios: number;
  isrTotal: number;
  totalAPagar: number;
}

export interface CalculoFiscalParams {
  regimenFiscal: RegimenFiscal;
  resumenPorRamo: RamoResumen[];
  totalComisionNeta: number; // Para HONORARIOS, debe ser suma de importe_base (Prima Total)
  ivaRate?: number;
  resicoIsrRate?: number;
  honorariosIsrRate?: number;
  retIvaFactor?: number;
  usePrimaTotal?: boolean; // Si true, totalComisionNeta se interpreta como Prima Total
}

const VIDA_KEY = "vida";

/**
 * Redondea un número a 2 decimales
 */
function roundTo2Decimals(num: number): number {
  return Math.round(num * 100) / 100;
}

/**
 * REGLA DE ORO: El cálculo fiscal depende del régimen del agente.
 * Nunca asumir reglas genéricas.
 * Backend y PDF usan la misma fuente de verdad.
 *
 * Función principal para calcular el desglose fiscal según el régimen del agente.
 * Esta función es la ÚNICA fuente de verdad para cálculos fiscales.
 *
 * IMPORTANTE PARA HONORARIOS:
 * - La base del cálculo es Prima Total (suma de importe_base), NO comisión neta
 * - totalComisionNeta debe ser la suma de importe_base para HONORARIOS
 * - resumenPorRamo debe agrupar por importe_base (usar usePrimaTotal=true)
 */
export function calcularDesgloseFiscal(params: CalculoFiscalParams): DesgloseFiscal {
  const {
    regimenFiscal,
    resumenPorRamo,
    totalComisionNeta,
    ivaRate = 0.16,
    resicoIsrRate = 0.0125,
    honorariosIsrRate = 0.10,
    retIvaFactor = 10.667 / 100,
    usePrimaTotal = false,
  } = params;

  // Para HONORARIOS, comisionNeta contiene Prima Total (importe_base)
  // Para otros regímenes, comisionNeta contiene la comisión calculada
  const comisionVida = resumenPorRamo
    .filter(r => r.ramo.toLowerCase() === VIDA_KEY)
    .reduce((sum, r) => sum + r.comisionNeta, 0);

  const comisionSinVida = totalComisionNeta - comisionVida;

  switch (regimenFiscal) {
    case "ASIMILADOS":
      return calcularAsimilados({
        comisionBaseTotal: totalComisionNeta,
        vida: comisionVida,
        sinVida: comisionSinVida,
      });

    case "RESICO":
      return calcularResico({
        comisionBaseTotal: totalComisionNeta,
        vida: comisionVida,
        sinVida: comisionSinVida,
        ivaRate,
        retIvaRate: retIvaFactor,
        resicoIsrRate,
      });

    case "HONORARIOS":
      return calcularHonorarios({
        comisionBaseTotal: totalComisionNeta,
        vida: comisionVida,
        sinVida: comisionSinVida,
        ivaRate,
        retIvaRate: retIvaFactor,
        honorariosIsrRate,
      });

    default:
      return {
        vida: comisionVida,
        sinVida: comisionSinVida,
        retContable: 0,
        costoDispersion: 0,
        iva: 0,
        retIsr: 0,
        retIva: 0,
        isrVida: 0,
        isrDanios: 0,
        isrTotal: 0,
        totalAPagar: totalComisionNeta,
      };
  }
}

/**
 * Cálculo fiscal para ASIMILADOS
 *
 * FÓRMULAS OFICIALES:
 * - Retención Contable = Vida × 0.16
 * - Costo de Dispersión = Sin Vida × 0.09
 * - IVA = 0 (No aplica)
 * - ISR Vida = (Vida – Retención Contable) × 0.10
 * - ISR Daños = (Sin Vida – Dispersión) × 0.10
 * - ISR Total = ISR Vida + ISR Daños
 * - Total a Pagar = Comisión Base Total – Retención Contable – Dispersión – ISR Total
 */
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

/**
 * Cálculo fiscal para RESICO (Régimen Simplificado de Confianza)
 *
 * FÓRMULAS OFICIALES:
 * - IVA = Sin Vida × 0.16
 * - Retención ISR = Comisión Base Total × 0.0125
 * - Retención IVA = Sin Vida × 0.10667
 * - Total a Pagar = Comisión Base Total + IVA – Retención ISR – Retención IVA
 */
function calcularResico(params: {
  comisionBaseTotal: number;
  vida: number;
  sinVida: number;
  ivaRate: number;
  retIvaRate: number;
  resicoIsrRate: number;
}): DesgloseFiscal {
  const { comisionBaseTotal, vida, sinVida, ivaRate, retIvaRate, resicoIsrRate } = params;

  const iva = roundTo2Decimals(sinVida * ivaRate);
  const retIsr = roundTo2Decimals(comisionBaseTotal * resicoIsrRate);
  const retIva = roundTo2Decimals(sinVida * retIvaRate);

  const totalAPagar = roundTo2Decimals(
    comisionBaseTotal + iva - retIsr - retIva
  );

  return {
    vida,
    sinVida,
    retContable: 0,
    costoDispersion: 0,
    iva,
    retIsr,
    retIva,
    isrVida: 0,
    isrDanios: 0,
    isrTotal: 0,
    totalAPagar,
  };
}

/**
 * Cálculo fiscal para HONORARIOS (Servicios Profesionales)
 *
 * FÓRMULAS OFICIALES (según formulas_imp):
 * BASE: Prima Total (importe_base), NO comisión neta
 *
 * - Retención Contable = Prima Vida × 0.16 (SOLO Vida)
 * - Costo Dispersión = Prima Sin Vida × 0.09 (SOLO Sin Vida)
 * - ISR Vida = (Prima Vida / 1.16) × 0.10 (NO resta retención)
 * - ISR Daños = (Prima Sin Vida / 1.09) × 0.10
 * - ISR Total = ISR Vida + ISR Daños
 * - Total Final = Prima Total - Retención Contable - Costo Dispersión - ISR Total
 *
 * IMPORTANTE:
 * - La base es Prima Total (sum de importe_base), NO comisión neta
 * - ISR Vida NO resta la retención contable
 * - Costo dispersión es 9%, no 10%
 */
function calcularHonorarios(params: {
  comisionBaseTotal: number;
  vida: number;
  sinVida: number;
  ivaRate: number;
  retIvaRate: number;
  honorariosIsrRate: number;
}): DesgloseFiscal {
  const { comisionBaseTotal, vida, sinVida } = params;

  // Prima Total es la base del cálculo (comisionBaseTotal = suma de importe_base)
  const primaTotal = comisionBaseTotal;
  const primaVida = vida;
  const primaSinVida = sinVida;

  // Retención contable: SOLO en Vida
  const retContable = roundTo2Decimals(primaVida * 0.16);

  // Costo de dispersión: SOLO en Sin Vida (9%, no 10%)
  const costoDispersion = roundTo2Decimals(primaSinVida * 0.09);

  // ISR Vida: (Prima Vida / 1.16) × 10% - NO resta retención
  const isrVida = roundTo2Decimals((primaVida / 1.16) * 0.10);

  // ISR Daños: (Prima Sin Vida / 1.09) × 10%
  const isrDanios = roundTo2Decimals((primaSinVida / 1.09) * 0.10);

  // ISR Total
  const isrTotal = roundTo2Decimals(isrVida + isrDanios);

  // Total Final = Prima Total - Retención - Dispersión - ISR Total
  const totalAPagar = roundTo2Decimals(
    primaTotal - retContable - costoDispersion - isrTotal
  );

  return {
    vida: primaVida,
    sinVida: primaSinVida,
    retContable,
    costoDispersion,
    iva: 0, // HONORARIOS no usa IVA en este esquema
    retIsr: isrTotal, // Para compatibilidad con reportes
    retIva: 0,
    isrVida,
    isrDanios,
    isrTotal,
    totalAPagar,
  };
}

/**
 * Función auxiliar para agrupar comisiones por ramo
 *
 * @param detalles - Array de detalles de comisiones
 * @param usePrimaTotal - Si true, agrupa por importe_base (Prima Total) en lugar de commission_neta
 */
export function agruparComisionesPorRamo(
  detalles: Array<{
    ramo: string;
    commission_neta?: number;
    importe_base?: number;
  }>,
  usePrimaTotal: boolean = false
): RamoResumen[] {
  const ramoMap = new Map<string, { comisionNeta: number; primaTotal: number }>();

  detalles.forEach(detalle => {
    const ramo = detalle.ramo || 'Sin Ramo';
    const current = ramoMap.get(ramo) || { comisionNeta: 0, primaTotal: 0 };

    // Para HONORARIOS, usar importe_base (Prima Total)
    const valorAgregar = usePrimaTotal
      ? (detalle.importe_base || 0)
      : (detalle.commission_neta || 0);

    ramoMap.set(ramo, {
      comisionNeta: current.comisionNeta + valorAgregar,
      primaTotal: current.primaTotal + (detalle.importe_base || 0)
    });
  });

  const resumen: RamoResumen[] = [];
  ramoMap.forEach((valores, ramo) => {
    resumen.push({
      ramo,
      comisionNeta: valores.comisionNeta,
      primaTotal: valores.primaTotal
    });
  });

  return resumen;
}

/**
 * Función para normalizar el nombre del régimen fiscal desde la BD
 */
export function normalizarRegimenFiscal(regimeName: string | null | undefined): RegimenFiscal {
  if (!regimeName) return "HONORARIOS";

  const normalized = regimeName.toUpperCase().trim();

  if (normalized.includes("RESICO") || normalized.includes("SIMPLIFICADO")) {
    return "RESICO";
  }

  if (normalized.includes("ASIMILAD")) {
    return "ASIMILADOS";
  }

  if (normalized.includes("HONORARIO")) {
    return "HONORARIOS";
  }

  return "HONORARIOS";
}
