import type {
  BnvQuoteInput, BnvCalculationResult, BnvPersonResult, BnvPaymentBreakdown,
  QuotePerson, FormaPago,
} from './types';
import { PAYMENT_FACTORS, IVA_RATE } from './types';

export interface BnvRateRecord {
  plan_name: string;
  region: string;
  age: number;
  rate: number;
  rate_type: string;
}

export interface BnvPackageConfig {
  id: string;
  derecho_poliza: number;
  asistencia_extranjero: number;
}

export interface BnvAvailableOptions {
  sumasAseguradas: number[];  // MDP values e.g. [1, 2, 3, 4, 5, 10]
  deducibles: number[];       // K values e.g. [15, 20, 30, 50, 100]
  coaseguros: number[];       // percent values e.g. [0, 10, 20]
}

interface BnvFactorTables {
  baseRates: Map<number, number>;
  saFactors: Map<number, number>;
  dedFactors: Map<number, number>;
  coasFactors: Map<number, number>;
  fdZona2: number;
  factorDescuento: number;
  factorMujer: number;
  isIncomplete: boolean;
}

function nearestKey(map: Map<number, number>, value: number): number {
  if (map.has(value)) return value;
  let nearest = NaN;
  let minDist = Infinity;
  for (const k of map.keys()) {
    const d = Math.abs(k - value);
    if (d < minDist) { minDist = d; nearest = k; }
  }
  return nearest;
}

function groupByPlan(rates: BnvRateRecord[]): Map<string, Array<{ age: number; rate: number }>> {
  const map = new Map<string, Array<{ age: number; rate: number }>>();
  for (const r of rates) {
    const rate = Number(r.rate);
    if (isNaN(rate)) continue;
    const age = Number(r.age);
    if (!map.has(r.plan_name)) map.set(r.plan_name, []);
    map.get(r.plan_name)!.push({ age, rate });
  }
  for (const arr of map.values()) arr.sort((a, b) => a.age - b.age);
  return map;
}

function extractFactorTables(rates: BnvRateRecord[]): BnvFactorTables {
  const byPlan = groupByPlan(rates);

  const baseRates = new Map<number, number>();
  for (const { age, rate } of (byPlan.get('40000') || [])) {
    baseRates.set(age, rate);
  }

  const saValues = byPlan.get('Sumas aseguradas') || [];
  const saFDs = byPlan.get('FD Suma asegurada') || [];
  const saFactors = new Map<number, number>();
  for (let i = 0; i < Math.min(saValues.length, saFDs.length); i++) {
    saFactors.set(saValues[i].rate, saFDs[i].rate);
  }

  const dedValues = byPlan.get('Deducibles') || [];
  const dedFDs = byPlan.get('FD Deducible') || [];
  const dedFactors = new Map<number, number>();
  for (let i = 0; i < Math.min(dedValues.length, dedFDs.length); i++) {
    dedFactors.set(dedValues[i].rate, dedFDs[i].rate);
  }

  const coasValues = byPlan.get('Coasegurado') || [];
  const coasFDs = byPlan.get('FD Coasegurado') || [];
  const coasFactors = new Map<number, number>();
  if (coasFDs.length > 0) coasFactors.set(0, coasFDs[0].rate);
  else coasFactors.set(0, 1.0);
  for (let i = 0; i < coasValues.length && i + 1 < coasFDs.length; i++) {
    coasFactors.set(coasValues[i].rate, coasFDs[i + 1].rate);
  }

  const fdZonaEntries = byPlan.get('FD Zona') || [];
  const fdZona2 = fdZonaEntries.find(e => e.rate < 1.0)?.rate ?? 0.8;

  const factorDescuentoEntries = byPlan.get('Factor descuento') || [];
  const factorDescuento = factorDescuentoEntries[0]?.rate ?? 1.0;

  const factorMujerEntries = byPlan.get('Factor es mujer') || [];
  const factorMujer = factorMujerEntries[0]?.rate ?? 2600;

  // Detect incomplete factor tables (fewer entries than expected)
  const isIncomplete = saFDs.length < 2 || dedFDs.length < 2;

  return { baseRates, saFactors, dedFactors, coasFactors, fdZona2, factorDescuento, factorMujer, isIncomplete };
}

export function getBnvAvailableOptions(rates: BnvRateRecord[]): BnvAvailableOptions {
  const byPlan = groupByPlan(rates);

  const saValues = (byPlan.get('Sumas aseguradas') || []).map(e => e.rate / 1_000_000);
  const dedFDs = byPlan.get('FD Deducible') || [];
  // BNV Deducibles start at age=1 in the stored data
  const dedEntries = (byPlan.get('Deducibles') || []).filter(e => e.rate >= 1000);
  const dedValues = dedFDs.length >= dedEntries.length
    ? dedEntries.map(e => e.rate / 1_000)
    : dedEntries.map(e => e.rate / 1_000);
  const rawCoas = byPlan.get('Coasegurado') || [];
  const coasValues = [0, ...rawCoas.filter(e => e.rate <= 1).map(e => Math.round(e.rate * 100))];

  return {
    sumasAseguradas: saValues.length > 0 ? saValues : [1, 2, 3, 4, 5, 10],
    deducibles: dedValues.length > 0 ? dedValues : [15, 20, 30, 50, 100],
    coaseguros: coasValues.length > 0 ? [...new Set(coasValues)].sort((a, b) => a - b) : [0, 10, 20],
  };
}

export function calculateBnv(
  input: BnvQuoteInput,
  people: QuotePerson[],
  rates: BnvRateRecord[],
  packageConfig: BnvPackageConfig
): BnvCalculationResult {
  try {
    if (!rates || rates.length === 0) {
      return {
        product: 'BNV', people_results: [], prima_anual_total: 0, totals: {} as any,
        tariff_package_id: packageConfig.id,
        error: 'No hay tarifas cargadas para BNV. Sube un archivo de cotizador en Tarifas.',
      };
    }

    const tables = extractFactorTables(rates);

    if (tables.baseRates.size === 0) {
      return {
        product: 'BNV', people_results: [], prima_anual_total: 0, totals: {} as any,
        tariff_package_id: packageConfig.id,
        error: 'El archivo de tarifas BNV no contiene una tabla de tasas base valida.',
      };
    }

    const saPesos = input.suma_asegurada * 1_000_000;
    const dedPesos = input.deducible * 1_000;
    const coasDecimal = input.coaseguro / 100;

    const fdZona = input.region_zone === 'Zona 2' ? tables.fdZona2 : 1.0;
    const fdSA = tables.saFactors.size > 0
      ? (tables.saFactors.get(nearestKey(tables.saFactors, saPesos)) ?? 1.0) : 1.0;
    const fdDed = tables.dedFactors.size > 0
      ? (tables.dedFactors.get(nearestKey(tables.dedFactors, dedPesos)) ?? 1.0) : 1.0;
    const fdCoas = tables.coasFactors.size > 0
      ? (tables.coasFactors.get(nearestKey(tables.coasFactors, coasDecimal)) ?? 1.0) : 1.0;

    const allAges = [...tables.baseRates.keys()].sort((a, b) => a - b);

    const peopleResults: BnvPersonResult[] = people.map(p => {
      const nearestAge = allAges.reduce((prev, curr) =>
        Math.abs(curr - p.age) < Math.abs(prev - p.age) ? curr : prev, allAges[0]);
      const baseRate = tables.baseRates.get(nearestAge) ?? 0;
      const isFemale = p.gender === 'Femenino';
      const annualRate =
        baseRate * fdSA * fdDed * fdCoas * fdZona * tables.factorDescuento
        + (isFemale ? tables.factorMujer : 0);

      return {
        person_id: p.id,
        person_name: p.name,
        relation: p.relation,
        age: p.age,
        lookup_key: `${input.region_zone}|SA${input.suma_asegurada}M|D${input.deducible}K|C${input.coaseguro}%`,
        base_rate: baseRate,
        discounted_rate: annualRate,
      };
    });

    const primaAnualTotal = peopleResults.reduce((sum, p) => sum + p.discounted_rate, 0);

    const totals: Record<FormaPago, BnvPaymentBreakdown> = {} as any;
    const formasPago: FormaPago[] = ['Anual', 'Semestral', 'Trimestral', 'Mensual'];

    for (const fp of formasPago) {
      const { factor, num_recibos } = PAYMENT_FACTORS[fp];
      const primaNeta = primaAnualTotal * factor;
      const asistencia = input.asistencia_extranjero ? packageConfig.asistencia_extranjero : 0;
      const subtotal = primaNeta + asistencia + packageConfig.derecho_poliza;
      const iva = subtotal * IVA_RATE;
      const total = subtotal + iva;
      const primerPago = total / num_recibos;

      totals[fp] = {
        forma_pago: fp,
        prima_neta: primaNeta,
        asistencia_extranjero: asistencia,
        derecho_poliza: packageConfig.derecho_poliza,
        subtotal, iva, total,
        primer_pago: primerPago,
        pagos_subsecuentes: num_recibos > 1 ? primerPago : 0,
        num_recibos,
      };
    }

    const result: BnvCalculationResult = {
      product: 'BNV',
      people_results: peopleResults,
      prima_anual_total: primaAnualTotal,
      totals,
      tariff_package_id: packageConfig.id,
    };

    if (tables.isIncomplete) {
      (result as any).warning = 'La tarifa BNV tiene tablas de factores incompletas. Para resultados exactos, sube nuevamente el archivo de cotizador.';
    }

    return result;
  } catch (err: any) {
    return {
      product: 'BNV', people_results: [], prima_anual_total: 0, totals: {} as any,
      tariff_package_id: packageConfig.id,
      error: err.message || 'Error al calcular BNV',
    };
  }
}
