import type {
  BnvQuoteInput, BnvCalculationResult, BnvPersonResult, BnvPaymentBreakdown,
  QuotePerson, FormaPago, RegionZone, ClientType, InternalFactor,
  PAYMENT_FACTORS, IVA_RATE,
} from './types';
import { PAYMENT_FACTORS as PF, IVA_RATE as IVA } from './types';

export interface BnvTariffData {
  package_id: string;
  derecho_poliza: number;
  asistencia_extranjero: number;
  client_types: ClientType[];
  internal_factors: InternalFactor[];
  rates: Array<{ lookup_key: string; region: string; age: number; rate: number }>;
}

const REGION_MAP: Record<RegionZone, string> = {
  'Zona 1': 'Mexico Region 1',
  'Zona 2': 'Mexico Region 2',
};

function buildLookupKey(input: BnvQuoteInput): string {
  const sa = input.suma_asegurada;
  const ded = input.deducible;
  const coas = input.coaseguro;
  const tope = input.tope_coaseguro;
  return `NVFS${sa}D${ded}C${coas}TC${tope}`;
}

function findRate(rates: BnvTariffData['rates'], lookupKey: string, region: string, age: number): number | null {
  const match = rates.find(r =>
    r.lookup_key === lookupKey && r.region === region && r.age === age
  );
  return match ? match.rate : null;
}

function getClientDiscount(clientTypes: ClientType[], selectedType: string): number {
  const ct = clientTypes.find(c => c.client_type === selectedType);
  return ct ? ct.discount_factor : 1.0;
}

function getInternalFactor(factors: InternalFactor[], name: string): number {
  const f = factors.find(x => x.factor_name === name);
  return f ? f.value : 1.0;
}

export function calculateBnv(
  input: BnvQuoteInput,
  people: QuotePerson[],
  tariffData: BnvTariffData
): BnvCalculationResult {
  const lookupKey = buildLookupKey(input);
  const mappedRegion = REGION_MAP[input.region_zone];
  const discount = getClientDiscount(tariffData.client_types, input.client_type);

  const peopleResults: BnvPersonResult[] = [];
  let missingRates = 0;

  for (const person of people) {
    const baseRate = findRate(tariffData.rates, lookupKey, mappedRegion, person.age);
    if (baseRate === null) {
      missingRates++;
      peopleResults.push({
        person_id: person.id,
        person_name: person.name,
        relation: person.relation,
        age: person.age,
        lookup_key: lookupKey,
        base_rate: 0,
        discounted_rate: 0,
      });
      continue;
    }

    const discountedRate = Math.round(baseRate * discount * 100) / 100;
    peopleResults.push({
      person_id: person.id,
      person_name: person.name,
      relation: person.relation,
      age: person.age,
      lookup_key: lookupKey,
      base_rate: baseRate,
      discounted_rate: discountedRate,
    });
  }

  if (missingRates === people.length && people.length > 0) {
    return {
      product: 'BNV',
      people_results: peopleResults,
      prima_anual_total: 0,
      totals: {} as any,
      tariff_package_id: tariffData.package_id,
      error: `No se encontraron tarifas para la combinacion: ${lookupKey} / ${mappedRegion}`,
    };
  }

  const primaAnualTotal = peopleResults.reduce((sum, p) => sum + p.discounted_rate, 0);
  const asistenciaBase = input.asistencia_extranjero ? tariffData.asistencia_extranjero * people.length : 0;

  const totals: Record<FormaPago, BnvPaymentBreakdown> = {} as any;
  const formasPago: FormaPago[] = ['Anual', 'Semestral', 'Trimestral', 'Mensual'];

  for (const fp of formasPago) {
    const { factor, num_recibos } = PF[fp];
    const primaNeta = Math.round(primaAnualTotal * factor * 100) / 100;
    const asistencia = Math.round(asistenciaBase * factor * 100) / 100;
    const derechoPoliza = tariffData.derecho_poliza;
    const subtotal = primaNeta + asistencia;
    const baseIva = subtotal + derechoPoliza;
    const iva = Math.round(baseIva * IVA * 100) / 100;
    const total = Math.round((baseIva + iva) * 100) / 100;
    const primerPago = Math.round((total / num_recibos) * 100) / 100;
    const pagosSubsecuentes = num_recibos > 1 ? primerPago : 0;

    totals[fp] = {
      forma_pago: fp,
      prima_neta: primaNeta,
      asistencia_extranjero: asistencia,
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
    product: 'BNV',
    people_results: peopleResults,
    prima_anual_total: primaAnualTotal,
    totals,
    tariff_package_id: tariffData.package_id,
  };
}
