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
  sumasAseguradas: number[];
  deducibles: number[];
  coaseguros: number[];
}

interface ParsedPlan {
  suma: number;
  deducible: number;
  coaseguro: number;
}

const PLAN_REGEX = /^NVFS(\d+)D(\d+)C(\d+)/;

function parsePlanName(planName: string): ParsedPlan | null {
  const m = planName.match(PLAN_REGEX);
  if (!m) return null;
  return { suma: Number(m[1]), deducible: Number(m[2]), coaseguro: Number(m[3]) };
}

function matchesRegion(region: string, zone: string): boolean {
  if (zone === 'Zona 1') return region.toLowerCase().includes('region 1');
  return region.toLowerCase().includes('region 2');
}

export function getBnvAvailableOptions(rates: BnvRateRecord[]): BnvAvailableOptions {
  const sumas = new Set<number>();
  const deds = new Set<number>();
  const coass = new Set<number>();

  for (const r of rates) {
    const parsed = parsePlanName(r.plan_name);
    if (!parsed) continue;
    sumas.add(parsed.suma);
    deds.add(parsed.deducible);
    coass.add(parsed.coaseguro);
  }

  return {
    sumasAseguradas: [...sumas].sort((a, b) => a - b),
    deducibles: [...deds].sort((a, b) => a - b),
    coaseguros: [...coass].sort((a, b) => a - b),
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

    // Build a lookup: filter rates matching the requested S/D/C/region, index by age
    const targetSuma = input.suma_asegurada;
    const targetDed = input.deducible;
    const targetCoas = input.coaseguro;

    const ratesByAge = new Map<number, number>();

    for (const r of rates) {
      const parsed = parsePlanName(r.plan_name);
      if (!parsed) continue;
      if (parsed.suma !== targetSuma) continue;
      if (parsed.deducible !== targetDed) continue;
      if (parsed.coaseguro !== targetCoas) continue;
      if (!matchesRegion(r.region, input.region_zone)) continue;
      const rate = Number(r.rate);
      if (isNaN(rate) || rate <= 0) continue;
      ratesByAge.set(r.age, rate);
    }

    if (ratesByAge.size === 0) {
      return {
        product: 'BNV', people_results: [], prima_anual_total: 0, totals: {} as any,
        tariff_package_id: packageConfig.id,
        error: `No se encontraron tarifas BNV para SA ${targetSuma} MDP, Deducible ${targetDed}K, Coaseguro ${targetCoas}%, ${input.region_zone}.`,
      };
    }

    const allAges = [...ratesByAge.keys()].sort((a, b) => a - b);

    const peopleResults: BnvPersonResult[] = people.map(p => {
      const nearestAge = allAges.reduce((prev, curr) =>
        Math.abs(curr - p.age) < Math.abs(prev - p.age) ? curr : prev, allAges[0]);
      const annualRate = ratesByAge.get(nearestAge) ?? 0;

      return {
        person_id: p.id,
        person_name: p.name,
        relation: p.relation,
        age: p.age,
        lookup_key: `${input.region_zone}|SA${input.suma_asegurada}M|D${input.deducible}K|C${input.coaseguro}%`,
        base_rate: annualRate,
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

    return {
      product: 'BNV',
      people_results: peopleResults,
      prima_anual_total: primaAnualTotal,
      totals,
      tariff_package_id: packageConfig.id,
    };
  } catch (err: any) {
    return {
      product: 'BNV', people_results: [], prima_anual_total: 0, totals: {} as any,
      tariff_package_id: packageConfig.id,
      error: err.message || 'Error al calcular BNV',
    };
  }
}
