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
  lookup_key?: string;
}

export interface BnvPackageConfig {
  id: string;
  derecho_poliza: number;
  asistencia_extranjero: number;
}

export interface BnvAvailableOptions {
  sumasAseguradas: number[];  // MDP values e.g. [1, 2, 3, 4, 5, 10]
  deducibles: number[];       // K values e.g. [0, 15, 20, 30, 50, 100]
  coaseguros: number[];       // percent values e.g. [0, 10, 20]
  topesCoaseguro: number[];   // K values e.g. [0, 30, 50]
}

// Region string as stored in MasterBase col O
const REGION_STRINGS: Record<'Zona 1' | 'Zona 2', string> = {
  'Zona 1': 'Mexico Region 1 BNV',
  'Zona 2': 'Mexico Region 2 (no CDMX, ZM Y MTY)',
};

// FD_Zona: multiplier applied per-member before summing
const FD_ZONA: Record<'Zona 1' | 'Zona 2', number> = {
  'Zona 1': 0.8,
  'Zona 2': 1.0,
};

const ADMINISTRACION = 1600;

/**
 * Build the PlanName code from user selections.
 * Formula from Excel: CONCATENATE("NVFS", sa_mdp, "D", ded_k, "C", coas_pct, IF(tc=0,"","TC"), IF(tc=0,"",tc_k))
 * sumaMdp    = suma_asegurada in MDP units (e.g. 1, 2, 3, 4, 5, 10)
 * deducibleK = deducible in K units (e.g. 0, 15, 20, 30, 50, 100)
 * coaseguroPct = coaseguro percent (e.g. 0, 10, 20)
 * topePesos  = tope_coaseguro in MXN pesos (e.g. 0, 30000, 50000) — divided by 1000 for TC code
 */
export function buildBnvPlanName(
  sumaMdp: number,
  deducibleK: number,
  coaseguroPct: number,
  topePesos: number,
): string {
  const topeK = topePesos / 1000;
  const base = `NVFS${sumaMdp}D${deducibleK}C${coaseguroPct}`;
  return topeK > 0 ? `${base}TC${topeK}` : base;
}

/**
 * Build the exact lookup key as stored in MasterBase col M (llave de busqueda).
 * Llave = PlanName + Region + LowAge (concatenated, no separator)
 */
function buildLookupKey(planName: string, region: string, age: number): string {
  return `${planName}${region}${age}`;
}

/** Derive available options from the set of stored llave strings. */
export function getBnvAvailableOptions(rates: BnvRateRecord[]): BnvAvailableOptions {
  const sumasSet = new Set<number>();
  const dedsSet = new Set<number>();
  const coasSet = new Set<number>();
  const topesSet = new Set<number>();
  topesSet.add(0);

  // plan_name holds the llave; extract PlanName prefix before the region string
  const regionPrefixes = Object.values(REGION_STRINGS);

  for (const r of rates) {
    // llave = PlanName + Region + age  (plan_name col holds llave)
    const llave = r.plan_name;
    let planName = llave;
    for (const rp of regionPrefixes) {
      const idx = llave.indexOf(rp);
      if (idx !== -1) { planName = llave.slice(0, idx); break; }
    }

    if (!planName.startsWith('NVFS')) continue;

    const saMatch = planName.match(/^NVFS(\d+(?:\.\d+)?)D/);
    const dedMatch = planName.match(/D(\d+(?:\.\d+)?)C/);
    const coasMatch = planName.match(/C(\d+(?:\.\d+)?)(?:TC|$)/);
    const topeMatch = planName.match(/TC(\d+(?:\.\d+)?)$/);

    if (saMatch) sumasSet.add(Number(saMatch[1]));
    if (dedMatch) dedsSet.add(Number(dedMatch[1]));
    if (coasMatch) coasSet.add(Number(coasMatch[1]));
    if (topeMatch) topesSet.add(Number(topeMatch[1]) * 1000); // convert K→pesos
  }

  return {
    sumasAseguradas: Array.from(sumasSet).sort((a, b) => a - b),
    deducibles: Array.from(dedsSet).sort((a, b) => a - b),
    coaseguros: Array.from(coasSet).sort((a, b) => a - b),
    topesCoaseguro: Array.from(topesSet).sort((a, b) => a - b),
  };
}

export function calculateBnv(
  input: BnvQuoteInput,
  people: QuotePerson[],
  rates: BnvRateRecord[],
  packageConfig: BnvPackageConfig,
): BnvCalculationResult {
  try {
    if (!rates || rates.length === 0) {
      return {
        product: 'BNV', people_results: [], prima_anual_total: 0, totals: {} as any,
        tariff_package_id: packageConfig.id,
        error: 'No hay tarifas cargadas para BNV. Sube un archivo de cotizador en Tarifas.',
      };
    }

    // Build the rate index keyed by lookup_key for O(1) exact lookup
    const rateIndex = new Map<string, number>();
    for (const r of rates) {
      const key = r.lookup_key ?? r.plan_name;
      rateIndex.set(key, Number(r.rate));
    }

    const planName = buildBnvPlanName(
      input.suma_asegurada,
      input.deducible,
      input.coaseguro,
      input.tope_coaseguro,
    );

    const regionStr = REGION_STRINGS[input.region_zone] ?? REGION_STRINGS['Zona 1'];
    const fdZona = FD_ZONA[input.region_zone] ?? 1.0;

    const peopleResults: BnvPersonResult[] = people.map(p => {
      const llave = buildLookupKey(planName, regionStr, p.age);
      const rawRate = rateIndex.get(llave) ?? 0;
      const memberRate = rawRate * fdZona;

      return {
        person_id: p.id,
        person_name: p.name,
        relation: p.relation,
        age: p.age,
        lookup_key: llave,
        base_rate: rawRate,
        discounted_rate: memberRate,
      };
    });

    const missingRates = peopleResults.filter(p => p.base_rate === 0);

    // prima_anual_total = pure sum of member rates × fdZona (no Administracion, no IVA)
    // This matches how the DB stores prima_neta_total: $21,634 = rate only
    const sumMemberRates = peopleResults.reduce((sum, p) => sum + p.discounted_rate, 0);
    const primaAnualTotal = sumMemberRates;

    const totals: Record<FormaPago, BnvPaymentBreakdown> = {} as any;
    const formasPago: FormaPago[] = ['Anual', 'Semestral', 'Trimestral', 'Mensual'];

    for (const fp of formasPago) {
      const { factor, num_recibos } = PAYMENT_FACTORS[fp];
      // Apply frequency factor to the pure member rates sum, then add Administracion, then IVA
      const primaNeta = sumMemberRates * factor;
      const subtotal = primaNeta + ADMINISTRACION;
      const iva = subtotal * IVA_RATE;
      const total = subtotal + iva;
      const primerPago = total / num_recibos;

      totals[fp] = {
        forma_pago: fp,
        prima_neta: primaNeta,
        asistencia_extranjero: 0,
        derecho_poliza: ADMINISTRACION,
        subtotal,
        iva,
        total,
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

    if (missingRates.length > 0) {
      const names = missingRates.map(p => `${p.person_name} (${p.age} años)`).join(', ');
      (result as any).warning =
        `No se encontro tarifa para: ${names}. Llave buscada: ${missingRates[0].lookup_key}. ` +
        'Verifica que el plan y la region sean correctos.';
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
