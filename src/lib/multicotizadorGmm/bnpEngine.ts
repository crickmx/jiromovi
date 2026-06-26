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

const REGION_MAP: Record<string, string> = {
  'Zona 1': 'Mexico Region 1',
  'Zona 2': 'Mexico Region 2',
};

function findBestRate(
  rates: BnpRateRecord[],
  age: number,
  region: string,
  gender: GenderType,
  input: BnpQuoteInput
): number {
  const sa = input.suma_asegurada;
  const ded = input.deducible;
  const coas = input.coaseguro;

  // Map gender to rate_type
  const genderType = gender === 'Femenino' ? 'Female' : 'Male';

  // Filter rates for this age and region
  let ageRates = rates.filter(r => r.age === age && r.region === region);
  if (ageRates.length === 0) {
    ageRates = rates.filter(r => r.age === age);
  }
  if (ageRates.length === 0) {
    // Find nearest age
    const allAges = [...new Set(rates.map(r => r.age))].sort((a, b) => a - b);
    if (allAges.length === 0) return 0;
    const nearestAge = allAges.reduce((prev, curr) =>
      Math.abs(curr - age) < Math.abs(prev - age) ? curr : prev, allAges[0]);
    ageRates = rates.filter(r => r.age === nearestAge);
  }

  // Try gender-specific rates first
  const genderedRates = ageRates.filter(r => r.rate_type === genderType);
  if (genderedRates.length > 0) {
    return findBestPlanMatch(genderedRates, sa, ded, coas);
  }

  // Fall back to Unisex
  const unisexRates = ageRates.filter(r => r.rate_type === 'Unisex');
  if (unisexRates.length > 0) {
    return findBestPlanMatch(unisexRates, sa, ded, coas);
  }

  // Use whatever is available
  return findBestPlanMatch(ageRates, sa, ded, coas);
}

function findBestPlanMatch(ageRates: BnpRateRecord[], sa: number, ded: number, coas: number): number {
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

  // Single plan file
  const uniquePlans = [...new Set(ageRates.map(r => r.plan_name))];
  if (uniquePlans.length === 1) {
    return ageRates[0].rate;
  }

  if (ageRates.length > 0) {
    return ageRates[0].rate;
  }

  return 0;
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
        product: 'BNP',
        people_results: [],
        prima_anual_total: 0,
        totals: {} as any,
        tariff_package_id: packageConfig.id,
        error: 'No hay tarifas cargadas para BNP. Sube un archivo de cotizador en Tarifas.',
      };
    }

    const region = REGION_MAP[input.region_zone] || 'Mexico Region 1';

    const peopleResults: BnpPersonResult[] = people.map(p => {
      const annualRate = findBestRate(rates, p.age, region, p.gender as GenderType, input);
      return {
        person_id: p.id,
        person_name: p.name,
        relation: p.relation,
        age: p.age,
        gender: p.gender as GenderType,
        lookup_key: `${region}|SA${input.suma_asegurada}|D${input.deducible}|C${input.coaseguro}`,
        annual_premium: annualRate,
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
        subtotal,
        iva,
        total,
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
      product: 'BNP',
      people_results: [],
      prima_anual_total: 0,
      totals: {} as any,
      tariff_package_id: packageConfig.id,
      error: err.message || 'Error al calcular BNP',
    };
  }
}
