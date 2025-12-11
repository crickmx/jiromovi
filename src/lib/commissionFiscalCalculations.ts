/**
 * Módulo de Cálculo Fiscal para Comisiones
 *
 * IMPORTANTE:
 * Los porcentajes usados (1.25% RESICO, 10% Honorarios, IVA 16%, 2/3 de IVA retenido)
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
  comisionNeta: number;
}

export interface DesgloseFiscal {
  retContable: number;
  costoDispersion: number;
  iva: number;
  retIsr: number;
  retIva: number;
  totalAPagar: number;
}

export interface CalculoFiscalParams {
  regimenFiscal: RegimenFiscal;
  resumenPorRamo: RamoResumen[];
  totalComisionNeta: number;
  ivaRate?: number;
  resicoIsrRate?: number;
  honorariosIsrRate?: number;
  retIvaFactor?: number;
}

const VIDA_KEY = "vida";

/**
 * Función principal para calcular el desglose fiscal según el régimen del agente
 */
export function calcularDesgloseFiscal(params: CalculoFiscalParams): DesgloseFiscal {
  const {
    regimenFiscal,
    resumenPorRamo,
    totalComisionNeta,
    ivaRate = 0.16,
    resicoIsrRate = 0.0125,
    honorariosIsrRate = 0.10,
    retIvaFactor = 2 / 3,
  } = params;

  const comisionVida = resumenPorRamo
    .filter(r => r.ramo.toLowerCase() === VIDA_KEY)
    .reduce((sum, r) => sum + r.comisionNeta, 0);

  const comisionNoVida = totalComisionNeta - comisionVida;

  const baseGravada = comisionNoVida;

  const ivaCalculado = baseGravada * ivaRate;
  const retIvaCalculada = ivaCalculado * retIvaFactor;

  switch (regimenFiscal) {
    case "ASIMILADOS":
      return calcularAsimilados({
        comisionVida,
        totalComisionNeta,
      });

    case "RESICO":
      return calcularResico({
        baseFiscal: baseGravada,
        totalComisionNeta,
        ivaCalculado,
        retIvaCalculada,
        resicoIsrRate,
      });

    case "HONORARIOS":
      return calcularHonorarios({
        baseFiscal: baseGravada,
        totalComisionNeta,
        ivaCalculado,
        retIvaCalculada,
        honorariosIsrRate,
      });

    default:
      return {
        retContable: 0,
        costoDispersion: 0,
        iva: 0,
        retIsr: 0,
        retIva: 0,
        totalAPagar: totalComisionNeta,
      };
  }
}

/**
 * Cálculo fiscal para ASIMILADOS
 *
 * Regla ESPECIAL:
 * - Ret. Contable: 16% sobre comisiones de VIDA únicamente
 * - Costo de Dispersión: 10% sobre la retención contable
 * - IVA: NO se agrega IVA en este esquema
 * - Ret ISR: 0 (se maneja fuera del PDF)
 * - Ret IVA: 0
 * - Total a pagar: Comisión neta total - Ret. Contable - Costo dispersión
 */
function calcularAsimilados(params: {
  comisionVida: number;
  totalComisionNeta: number;
}): DesgloseFiscal {
  const { comisionVida, totalComisionNeta } = params;

  const retContable = comisionVida * 0.16;

  const costoDispersion = retContable * 0.10;

  const iva = 0;
  const retIva = 0;
  const retIsr = 0;

  const totalAPagar = totalComisionNeta - retContable - costoDispersion;

  return {
    retContable,
    costoDispersion,
    iva,
    retIsr,
    retIva,
    totalAPagar,
  };
}

/**
 * Cálculo fiscal para RESICO (Régimen Simplificado de Confianza)
 *
 * Reglas México:
 * - Ret ISR: 1.25% sobre base sin IVA (art. 113-J LISR)
 * - IVA: 16% sobre base gravada
 * - Ret IVA: 2/3 del IVA trasladado (10.6667% efectivo sobre base)
 * - Total a pagar: Base + IVA - Ret ISR - Ret IVA
 */
function calcularResico(params: {
  baseFiscal: number;
  totalComisionNeta: number;
  ivaCalculado: number;
  retIvaCalculada: number;
  resicoIsrRate: number;
}): DesgloseFiscal {
  const {
    baseFiscal,
    totalComisionNeta,
    ivaCalculado,
    retIvaCalculada,
    resicoIsrRate,
  } = params;

  const retIsr = baseFiscal * resicoIsrRate;

  const retContable = 0;
  const costoDispersion = 0;

  const totalBaseMasIva = totalComisionNeta + ivaCalculado;
  const totalAPagar = totalBaseMasIva - retIsr - retIvaCalculada;

  return {
    retContable,
    costoDispersion,
    iva: ivaCalculado,
    retIsr,
    retIva: retIvaCalculada,
    totalAPagar,
  };
}

/**
 * Cálculo fiscal para HONORARIOS (Servicios Profesionales)
 *
 * Reglas México:
 * - Ret ISR: 10% sobre base sin IVA (tasa típica para honorarios)
 * - IVA: 16% sobre base gravada
 * - Ret IVA: 2/3 del IVA trasladado (10.6667% efectivo sobre base)
 * - Total a pagar: Base + IVA - Ret ISR - Ret IVA
 */
function calcularHonorarios(params: {
  baseFiscal: number;
  totalComisionNeta: number;
  ivaCalculado: number;
  retIvaCalculada: number;
  honorariosIsrRate: number;
}): DesgloseFiscal {
  const {
    baseFiscal,
    totalComisionNeta,
    ivaCalculado,
    retIvaCalculada,
    honorariosIsrRate,
  } = params;

  const retIsr = baseFiscal * honorariosIsrRate;

  const retContable = 0;
  const costoDispersion = 0;

  const totalBaseMasIva = totalComisionNeta + ivaCalculado;
  const totalAPagar = totalBaseMasIva - retIsr - retIvaCalculada;

  return {
    retContable,
    costoDispersion,
    iva: ivaCalculado,
    retIsr,
    retIva: retIvaCalculada,
    totalAPagar,
  };
}

/**
 * Función auxiliar para agrupar comisiones por ramo
 */
export function agruparComisionesPorRamo(
  detalles: Array<{ ramo: string; commission_neta: number }>
): RamoResumen[] {
  const ramoMap = new Map<string, number>();

  detalles.forEach(detalle => {
    const ramo = detalle.ramo || 'Sin Ramo';
    const current = ramoMap.get(ramo) || 0;
    ramoMap.set(ramo, current + detalle.commission_neta);
  });

  const resumen: RamoResumen[] = [];
  ramoMap.forEach((comisionNeta, ramo) => {
    resumen.push({ ramo, comisionNeta });
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
