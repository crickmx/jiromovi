import type {
  BnpQuoteInput, BnpCalculationResult, BnpPersonResult, BnpPaymentBreakdown,
  QuotePerson, FormaPago, RegionZone, ClientType, InternalFactor, GenderType,
} from './types';
import { PAYMENT_FACTORS as PF, IVA_RATE as IVA } from './types';

export interface BnpTariffData {
  package_id: string;
  derecho_poliza: number;
  asistencia_extranjero: number;
  costo_catastrofica_extranjero: number;
  client_types: ClientType[];
  internal_factors: InternalFactor[];
  rates: Array<{ lookup_key: string; plan_name: string; region: string; age: number; rate: number; rate_type: string }>;
}

const REGION_MAP: Record<RegionZone, string> = {
  'Zona 1': 'Mexico Region 1',
  'Zona 2': 'Mexico Region 2',
};

function buildPlanName(input: BnpQuoteInput): string {
  const sa = input.suma_asegurada;
  const ded = input.deducible;
  const coas = input.coaseguro;
  return `NPS${sa}D${ded}C${coas}`;
}

function genderToRateType(gender: GenderType): string {
  return gender === 'Masculino' ? 'Male' : 'Female';
}

function findRate(rates: BnpTariffData['rates'], planName: string, region: string, age: number, rateType: string): number | null {
  const match = rates.find(r =>
    r.plan_name === planName && r.region === region && r.age === age && r.rate_type === rateType
  );
  return match ? match.rate : null;
}

function getClientDiscount(clientTypes: ClientType[], selectedType: string): number {
  const ct = clientTypes.find(c => c.client_type === selectedType);
  return ct ? ct.discount_factor : 1.0;
}

export function calculateBnp(
  input: BnpQuoteInput,
  people: QuotePerson[],
  tariffData: BnpTariffData
): BnpCalculationResult {
  const planName = buildPlanName(input);
  const mappedRegion = REGION_MAP[input.region_zone];
  const discount = getClientDiscount(tariffData.client_types, input.client_type);

  const peopleResults: BnpPersonResult[] = [];
  let missingRates = 0;

  for (const person of people) {
    const rateType = genderToRateType(person.gender);
    const rate = findRate(tariffData.rates, planName, mappedRegion, person.age, rateType);

    if (rate === null) {
      missingRates++;
      peopleResults.push({
        person_id: person.id,
        person_name: person.name,
        relation: person.relation,
        age: person.age,
        gender: person.gender,
        lookup_key: `${planName}${mappedRegion}${person.age}${rateType}`,
        annual_premium: 0,
      });
      continue;
    }

    const adjustedRate = Math.round(rate * discount * 100) / 100;
    peopleResults.push({
      person_id: person.id,
      person_name: person.name,
      relation: person.relation,
      age: person.age,
      gender: person.gender,
      lookup_key: `${planName}${mappedRegion}${person.age}${rateType}`,
      annual_premium: adjustedRate,
    });
  }

  if (missingRates === people.length && people.length > 0) {
    return {
      product: 'BNP',
      people_results: peopleResults,
      prima_anual_total: 0,
      totals: {} as any,
      tariff_package_id: tariffData.package_id,
      error: `No se encontraron tarifas para: ${planName} / ${mappedRegion}`,
    };
  }

  const primaAnualTotal = peopleResults.reduce((sum, p) => sum + p.annual_premium, 0);
  const asistenciaBase = input.asistencia_extranjero ? tariffData.asistencia_extranjero * people.length : 0;
  const catastroficaBase = input.cobertura_catastrofica_extranjero ? tariffData.costo_catastrofica_extranjero * people.length : 0;

  const totals: Record<FormaPago, BnpPaymentBreakdown> = {} as any;
  const formasPago: FormaPago[] = ['Anual', 'Semestral', 'Trimestral', 'Mensual'];

  for (const fp of formasPago) {
    const { factor, num_recibos } = PF[fp];
    const primaNeta = Math.round(primaAnualTotal * factor * 100) / 100;
    const asistencia = Math.round(asistenciaBase * factor * 100) / 100;
    const catastrofica = Math.round(catastroficaBase * factor * 100) / 100;
    const derechoPoliza = tariffData.derecho_poliza;
    const subtotal = primaNeta + asistencia + catastrofica;
    const baseIva = subtotal + derechoPoliza;
    const iva = Math.round(baseIva * IVA * 100) / 100;
    const total = Math.round((baseIva + iva) * 100) / 100;
    const primerPago = Math.round((total / num_recibos) * 100) / 100;
    const pagosSubsecuentes = num_recibos > 1 ? primerPago : 0;

    totals[fp] = {
      forma_pago: fp,
      prima_neta: primaNeta,
      asistencia_extranjero: asistencia,
      catastrofica_extranjero: catastrofica,
      derecho_poliza: derechoPoliza,
      subtotal,
      iva,
      total,
      primer_pago: primerPago,
      pagos_subsecuentes: pagosSubsecuentes,
      num_recibos,
    };
  }

  return {
    product: 'BNP',
    people_results: peopleResults,
    prima_anual_total: primaAnualTotal,
    totals,
    tariff_package_id: tariffData.package_id,
  };
}
