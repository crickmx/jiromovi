/**
 * Módulo de Cálculo Fiscal para Comisiones
 *
 * IMPORTANTE:
 * Los porcentajes usados (1.25% RESICO, 10% Honorarios, IVA 16%, 2/3 de IVA retenido, 9% dispersión Asimilados)
 * se basan en reglas fiscales vigentes en México para retenciones de ISR e IVA a personas físicas
 * (RESICO y servicios profesionales).
 *
 * VERSIÓN V7: Corrección Ret IVA = IVA × (2/3)
 * - HONORARIOS: ISR sobre (Total + IVA), Ret IVA = IVA × 2/3
 * - RESICO: ISR sobre (Total + IVA), Ret IVA = IVA × 2/3
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
    retIvaFactor = 2.0 / 3.0, // CORREGIDO V7: 2/3 del IVA (66.67%)
    usePrimaTotal = false,
  } = params;

  // ===============================================================================
  // 🚫 GUARD CLAUSE OBLIGATORIO: ASIMILADOS ES INTOCABLE
  // ===============================================================================
  if (regimenFiscal === "ASIMILADOS") {
    throw new Error(
      "ASIMILADOS es intocable. No usar esta función para ASIMILADOS. " +
      "Los cálculos de ASIMILADOS ya están implementados y no deben modificarse."
    );
  }

  // ===============================================================================
  // SOLO CONTINUAR SI ES HONORARIOS O RESICO
  // ===============================================================================
  if (regimenFiscal !== "HONORARIOS" && regimenFiscal !== "RESICO") {
    throw new Error(
      `Régimen fiscal "${regimenFiscal}" no reconocido. ` +
      "Solo se permiten HONORARIOS o RESICO."
    );
  }

  // Calcular vida y sin vida
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
 * FÓRMULAS OFICIALES (IMAGEN 1):
 * - Retención Contable = Vida × 0.16 (SOLO Vida)
 * - Costo de Dispersión = Sin Vida × 0.09 (SOLO Sin Vida)
 * - IVA = 0 (No aplica)
 * - Base ISR Vida = (Vida - Retención Contable) / 1.09
 * - ISR Vida = Base ISR Vida × 0.10
 * - Base ISR Daños = (Sin Vida - Costo Dispersión) / 1.09
 * - ISR Daños = Base ISR Daños × 0.10
 * - ISR Total = ISR Vida + ISR Daños
 * - Total a Pagar = Comisión Base Total - Retención Contable - Costo Dispersión - ISR Total
 *
 * CRÍTICO: SÍ se restan las retenciones ANTES de dividir por 1.09.
 *
 * IMPORTANTE: La función de base de datos es la fuente de verdad principal.
 * Esta función local solo se usa como respaldo o en casos donde no se pueda consultar la BD.
 */
function calcularAsimilados(params: {
  comisionBaseTotal: number;
  vida: number;
  sinVida: number;
}): DesgloseFiscal {
  const { comisionBaseTotal, vida, sinVida } = params;

  // Retenciones
  const retContable = roundTo2Decimals(vida * 0.16);
  const costoDispersion = roundTo2Decimals(sinVida * 0.09);

  // ISR Vida: Base = (Vida - Ret. Contable) / 1.09, ISR = Base × 0.10
  const baseIsrVida = (vida - retContable) / 1.09;
  const isrVida = roundTo2Decimals(baseIsrVida * 0.10);

  // ISR Daños: Base = (Sin Vida - Costo Dispersión) / 1.09, ISR = Base × 0.10
  const baseIsrDanios = (sinVida - costoDispersion) / 1.09;
  const isrDanios = roundTo2Decimals(baseIsrDanios * 0.10);

  // ISR Total
  const isrTotal = roundTo2Decimals(isrVida + isrDanios);

  // Total a Pagar
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
 * FÓRMULAS OFICIALES V7:
 * - Ret. Contable = 0
 * - Costo Dispersión = 0
 * - IVA = Sin Vida × 16%
 * - Subtotal con IVA = Total + IVA
 * - Ret ISR = (Total + IVA) × 1.25%
 * - Ret IVA = IVA × (2/3)
 * - Total a Pagar = Subtotal con IVA – Ret ISR – Ret IVA
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

  // RESICO: Ret. Contable y Costo Dispersión = 0
  const retContable = 0;
  const costoDispersion = 0;

  // IVA aplica sobre sin Vida
  const iva = sinVida * ivaRate;

  // Subtotal con IVA
  const subtotalConIva = comisionBaseTotal + iva;

  // Ret ISR = (Total + IVA) × 1.25%
  const retIsr = subtotalConIva * resicoIsrRate;

  // Ret IVA = IVA × (2/3) - retIvaRate debe ser 2/3
  const retIva = iva * retIvaRate;

  // Total neto
  const totalAPagar = subtotalConIva - retIsr - retIva;

  return {
    vida,
    sinVida,
    retContable,
    costoDispersion,
    iva: roundTo2Decimals(iva),
    retIsr: roundTo2Decimals(retIsr),
    retIva: roundTo2Decimals(retIva),
    isrVida: 0,
    isrDanios: 0,
    isrTotal: 0,
    totalAPagar: roundTo2Decimals(totalAPagar),
  };
}

/**
 * Cálculo fiscal para HONORARIOS (Servicios Profesionales)
 *
 * FÓRMULAS OFICIALES V7:
 * - Ret. Contable = 0
 * - Costo Dispersión = 0
 * - IVA = Sin Vida × 16%
 * - Subtotal con IVA = Total + IVA
 * - Ret ISR = (Total + IVA) × 10%
 * - Ret IVA = IVA × (2/3)
 * - Total a Pagar = Subtotal con IVA – Ret ISR – Ret IVA
 */
function calcularHonorarios(params: {
  comisionBaseTotal: number;
  vida: number;
  sinVida: number;
  ivaRate: number;
  retIvaRate: number;
  honorariosIsrRate: number;
}): DesgloseFiscal {
  const { comisionBaseTotal, vida, sinVida, ivaRate, retIvaRate } = params;

  // HONORARIOS: Ret. Contable y Costo Dispersión = 0
  const retContable = 0;
  const costoDispersion = 0;

  // IVA aplica sobre sin Vida
  const iva = sinVida * ivaRate;

  // Subtotal con IVA
  const subtotalConIva = comisionBaseTotal + iva;

  // Ret ISR = (Total + IVA) × 10%
  const retIsr = subtotalConIva * 0.10;

  // Ret IVA = IVA × (2/3) - retIvaRate debe ser 2/3
  const retIva = iva * retIvaRate;

  // Total neto
  const totalAPagar = subtotalConIva - retIsr - retIva;

  return {
    vida,
    sinVida,
    retContable,
    costoDispersion,
    iva: roundTo2Decimals(iva),
    retIsr: roundTo2Decimals(retIsr),
    retIva: roundTo2Decimals(retIva),
    isrVida: 0,
    isrDanios: 0,
    isrTotal: 0,
    totalAPagar: roundTo2Decimals(totalAPagar),
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
