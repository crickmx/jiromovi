import type {
  BnpQuoteInput, BnpCalculationResult, BnpPersonResult, BnpPaymentBreakdown,
  QuotePerson, FormaPago, GenderType,
} from './types';
import { PAYMENT_FACTORS, IVA_RATE } from './types';

export interface BnpRateRecord {
  plan_name: string;
  region: string;
  age: number;
  rate: number;
  rate_type: string;
}

export interface BnpPackageConfig {
  id: string;
  derecho_poliza: number;
  asistencia_extranjero: number;
  costo_catastrofica_extranjero: number;
}

export interface BnpAvailableOptions {
  sumasAseguradas: number[];  // MDP values e.g. [5, 10, 20, 50]
  deducibles: number[];       // K values e.g. [17, 35, 55, 75, 115]
  coaseguros: number[];       // percent values e.g. [0, 10, 20]
}

interface BnpFactorTables {
  baseRates: Map<number, number>;   // age → base annual rate
  saFactors: Map<number, number>;   // sa_pesos → FD_SA multiplier
  dedFactors: Map<number, number>;  // ded_pesos → FD_Ded multiplier
  coasFactors: Map<number, number>; // coas_decimal → FD_Coas multiplier
  fdZona2: number;                  // zone 2 factor (typically 0.8)
  factorDescuento: number;          // plan discount (0.89 for new business)
  factorMujer: number;              // annual additive surcharge for females
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

function groupByPlan(rates: BnpRateRecord[]): Map<string, Array<{ age: number; rate: number }>> {
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

function extractFactorTables(rates: BnpRateRecord[]): BnpFactorTables {
  const byPlan = groupByPlan(rates);

  // Base rates from "40000" column — actual annual rates indexed by insured age
  const baseRates = new Map<number, number>();
  for (const { age, rate } of (byPlan.get('40000') || [])) {
    baseRates.set(age, rate);
  }

  // SA factor table: pair "Sumas aseguradas" values with "FD Suma asegurada" values by row index
  const saValues = byPlan.get('Sumas aseguradas') || [];
  const saFDs = byPlan.get('FD Suma asegurada') || [];
  const saFactors = new Map<number, number>();
  for (let i = 0; i < Math.min(saValues.length, saFDs.length); i++) {
    saFactors.set(saValues[i].rate, saFDs[i].rate);
  }

  // Deductible factor table: pair "Deducibles" values with "FD Deducible" by row index
  const dedValues = byPlan.get('Deducibles') || [];
  const dedFDs = byPlan.get('FD Deducible') || [];
  const dedFactors = new Map<number, number>();
  for (let i = 0; i < Math.min(dedValues.length, dedFDs.length); i++) {
    dedFactors.set(dedValues[i].rate, dedFDs[i].rate);
  }

  // Coaseguro factor table:
  // "FD Coasegurado"[0] = FD for coaseguro=0% (implicit, no entry in "Coasegurado")
  // "FD Coasegurado"[i+1] = FD for "Coasegurado"[i] value
  const coasValues = byPlan.get('Coasegurado') || [];
  const coasFDs = byPlan.get('FD Coasegurado') || [];
  const coasFactors = new Map<number, number>();
  if (coasFDs.length > 0) coasFactors.set(0, coasFDs[0].rate);
  else coasFactors.set(0, 1.0);
  for (let i = 0; i < coasValues.length && i + 1 < coasFDs.length; i++) {
    coasFactors.set(coasValues[i].rate, coasFDs[i + 1].rate);
  }

  // Zone 2 factor = first FD_Zona entry with value < 1.0
  const fdZonaEntries = byPlan.get('FD Zona') || [];
  const fdZona2 = fdZonaEntries.find(e => e.rate < 1.0)?.rate ?? 0.8;

  // Factor descuento: first entry = new business rate (typically 0.89)
  const factorDescuentoEntries = byPlan.get('Factor descuento') || [];
  const factorDescuento = factorDescuentoEntries[0]?.rate ?? 0.89;

  // Female annual surcharge (additive, not multiplicative)
  const factorMujerEntries = byPlan.get('Factor es mujer') || [];
  const factorMujer = factorMujerEntries[0]?.rate ?? 2600;

  return { baseRates, saFactors, dedFactors, coasFactors, fdZona2, factorDescuento, factorMujer };
}

export function getBnpAvailableOptions(rates: BnpRateRecord[]): BnpAvailableOptions {
  const byPlan = groupByPlan(rates);

  const saValues = (byPlan.get('Sumas aseguradas') || []).map(e => e.rate / 1_000_000);
  const dedFDs = byPlan.get('FD Deducible') || [];
  const dedValues = (byPlan.get('Deducibles') || [])
    .slice(0, dedFDs.length)
    .map(e => e.rate / 1_000);
  const rawCoas = byPlan.get('Coasegurado') || [];
  const coasValues = [0, ...rawCoas.filter(e => e.rate <= 1).map(e => Math.round(e.rate * 100))];

  return {
    sumasAseguradas: saValues.length > 0 ? saValues : [5, 10, 20, 50],
    deducibles: dedValues.length > 0 ? dedValues : [17, 35, 55, 75, 115],
    coaseguros: coasValues.length > 0 ? [...new Set(coasValues)].sort((a, b) => a - b) : [0, 10, 20],
  };
}

export function calculateBnp(
  input: BnpQuoteInput,
  people: QuotePerson[],
  rates: BnpRateRecord[],
  packageConfig: BnpPackageConfig
): BnpCalculationResult {
  try {
    if (!rates || rates.length === 0) {
      return {
        product: 'BNP', people_results: [], prima_anual_total: 0, totals: {} as any,
        tariff_package_id: packageConfig.id,
        error: 'No hay tarifas cargadas para BNP. Sube un archivo de cotizador en Tarifas.',
      };
    }

    const tables = extractFactorTables(rates);

    if (tables.baseRates.size === 0) {
      return {
        product: 'BNP', people_results: [], prima_anual_total: 0, totals: {} as any,
        tariff_package_id: packageConfig.id,
        error: 'El archivo de tarifas BNP no contiene una tabla de tasas base valida.',
      };
    }

    // Convert UI inputs to raw units
    const saPesos = input.suma_asegurada * 1_000_000;
    const dedPesos = input.deducible * 1_000;
    const coasDecimal = input.coaseguro / 100;

    // Zone multiplier
    const fdZona = input.region_zone === 'Zona 2' ? tables.fdZona2 : 1.0;

    // Factor lookups — use nearest available key when exact match not found
    const fdSA = tables.saFactors.size > 0
      ? (tables.saFactors.get(nearestKey(tables.saFactors, saPesos)) ?? 1.0) : 1.0;
    const fdDed = tables.dedFactors.size > 0
      ? (tables.dedFactors.get(nearestKey(tables.dedFactors, dedPesos)) ?? 1.0) : 1.0;
    const fdCoas = tables.coasFactors.size > 0
      ? (tables.coasFactors.get(nearestKey(tables.coasFactors, coasDecimal)) ?? 1.0) : 1.0;

    const allAges = [...tables.baseRates.keys()].sort((a, b) => a - b);

    const peopleResults: BnpPersonResult[] = people.map(p => {
      const nearestAge = allAges.reduce((prev, curr) =>
        Math.abs(curr - p.age) < Math.abs(prev - p.age) ? curr : prev, allAges[0]);
      const baseRate = tables.baseRates.get(nearestAge) ?? 0;
      const isFemale = (p.gender as GenderType) === 'Femenino';

      // Formula: base × FD_SA × FD_Ded × FD_Coas × FD_Zona × Factor_descuento + (female surcharge)
      const annualPremium =
        baseRate * fdSA * fdDed * fdCoas * fdZona * tables.factorDescuento
        + (isFemale ? tables.factorMujer : 0);

      return {
        person_id: p.id,
        person_name: p.name,
        relation: p.relation,
        age: p.age,
        gender: p.gender as GenderType,
        lookup_key: `${input.region_zone}|SA${input.suma_asegurada}M|D${input.deducible}K|C${input.coaseguro}%`,
        annual_premium: annualPremium,
      };
    });

    const primaAnualTotal = peopleResults.reduce((sum, p) => sum + p.annual_premium, 0);

    const totals: Record<FormaPago, BnpPaymentBreakdown> = {} as any;
    const formasPago: FormaPago[] = ['Anual', 'Semestral', 'Trimestral', 'Mensual'];

    for (const fp of formasPago) {
      const { factor, num_recibos } = PAYMENT_FACTORS[fp];
      const primaNeta = primaAnualTotal * factor;
      const asistencia = input.asistencia_extranjero ? packageConfig.asistencia_extranjero : 0;
      const catastrofica = input.cobertura_catastrofica_extranjero ? packageConfig.costo_catastrofica_extranjero : 0;
      const subtotal = primaNeta + asistencia + catastrofica + packageConfig.derecho_poliza;
      const iva = subtotal * IVA_RATE;
      const total = subtotal + iva;
      const primerPago = total / num_recibos;

      totals[fp] = {
        forma_pago: fp,
        prima_neta: primaNeta,
        asistencia_extranjero: asistencia,
        catastrofica_extranjero: catastrofica,
        derecho_poliza: packageConfig.derecho_poliza,
        subtotal, iva, total,
        primer_pago: primerPago,
        pagos_subsecuentes: num_recibos > 1 ? primerPago : 0,
        num_recibos,
      };
    }

    return {
      product: 'BNP',
      people_results: peopleResults,
      prima_anual_total: primaAnualTotal,
      totals,
      tariff_package_id: packageConfig.id,
    };
  } catch (err: any) {
    return {
      product: 'BNP', people_results: [], prima_anual_total: 0, totals: {} as any,
      tariff_package_id: packageConfig.id,
      error: err.message || 'Error al calcular BNP',
    };
  }
}
