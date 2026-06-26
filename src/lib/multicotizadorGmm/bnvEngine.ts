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

const REGION_MAP: Record<string, string> = {
  'Zona 1': 'Mexico Region 1',
  'Zona 2': 'Mexico Region 2',
};

function findBestRate(
  rates: BnvRateRecord[],
  age: number,
  region: string,
  input: BnvQuoteInput
): number {
  // Build candidate plan patterns to match against stored plan_name
  // The plan_name in the DB comes from Excel column headers
  // We try to match based on SA, deducible, coaseguro values
  const sa = input.suma_asegurada;
  const ded = input.deducible;
  const coas = input.coaseguro;

  // Filter rates for this age and region
  const ageRates = rates.filter(r => r.age === age && r.region === region);
  if (ageRates.length === 0) {
    // Try without region filter
    const anyRegionRates = rates.filter(r => r.age === age);
    if (anyRegionRates.length === 0) {
      // Find nearest age
      const allAges = [...new Set(rates.map(r => r.age))].sort((a, b) => a - b);
      const nearestAge = allAges.reduce((prev, curr) =>
        Math.abs(curr - age) < Math.abs(prev - age) ? curr : prev, allAges[0]);
      return findBestRate(rates, nearestAge, region, input);
    }
    return findBestPlanMatch(anyRegionRates, sa, ded, coas);
  }

  return findBestPlanMatch(ageRates, sa, ded, coas);
}

function findBestPlanMatch(ageRates: BnvRateRecord[], sa: number, ded: number, coas: number): number {
  // Try exact plan name match patterns
  const patterns = [
    `S${sa}D${ded}C${coas}`,
    `S${sa}D${ded}`,
    `${sa}MDP_${ded}K_${coas}`,
  ];

  for (const pat of patterns) {
    const match = ageRates.find(r => r.plan_name.toUpperCase().includes(pat.toUpperCase()));
    if (match) return match.rate;
  }

  // Try matching with numeric extraction from plan_name
  for (const r of ageRates) {
    const planName = r.plan_name;
    const saMatch = planName.match(/S(\d+)/i) || planName.match(/(\d+)\s*(?:MDP|M)/i);
    const dedMatch = planName.match(/D(\d+)/i) || planName.match(/(?:ded|DED)[\s_-]*(\d+)/i);
    const coasMatch = planName.match(/C(\d+)/i) || planName.match(/(?:coas|COAS)[\s_-]*(\d+)/i);

    const planSa = saMatch ? Number(saMatch[1]) : null;
    const planDed = dedMatch ? Number(dedMatch[1]) : null;
    const planCoas = coasMatch ? Number(coasMatch[1]) : null;

    if (planSa === sa && planDed === ded && (planCoas === null || planCoas === coas)) {
      return r.rate;
    }
  }

  // If only one plan exists, use it (single-plan files)
  const uniquePlans = [...new Set(ageRates.map(r => r.plan_name))];
  if (uniquePlans.length === 1) {
    return ageRates[0].rate;
  }

  // Fallback: use the first matching rate for this age (best effort)
  if (ageRates.length > 0) {
    return ageRates[0].rate;
  }

  return 0;
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
        product: 'BNV',
        people_results: [],
        prima_anual_total: 0,
        totals: {} as any,
        tariff_package_id: packageConfig.id,
        error: 'No hay tarifas cargadas para BNV. Sube un archivo de cotizador en Tarifas.',
      };
    }

    const region = REGION_MAP[input.region_zone] || 'Mexico Region 1';

    const peopleResults: BnvPersonResult[] = people.map(p => {
      const annualRate = findBestRate(rates, p.age, region, input);
      return {
        person_id: p.id,
        person_name: p.name,
        relation: p.relation,
        age: p.age,
        lookup_key: `${region}|SA${input.suma_asegurada}|D${input.deducible}|C${input.coaseguro}`,
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
        subtotal,
        iva,
        total,
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
      product: 'BNV',
      people_results: [],
      prima_anual_total: 0,
      totals: {} as any,
      tariff_package_id: packageConfig.id,
      error: err.message || 'Error al calcular BNV',
    };
  }
}
