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
  topeCoaseguro: number | null;
}

const PLAN_REGEX = /^NVFS(\d+)D(\d+)C(\d+)(?:TC(\d+))?/;

function parsePlanName(planName: string): ParsedPlan | null {
  const m = planName.match(PLAN_REGEX);
  if (!m) return null;
  return {
    suma: Number(m[1]),
    deducible: Number(m[2]),
    coaseguro: Number(m[3]),
    topeCoaseguro: m[4] != null ? Number(m[4]) : null,
  };
}

function matchesRegion(region: string, zone: string): boolean {
  if (zone === 'Zona 1') return region.toLowerCase().includes('region 1');
  return region.toLowerCase().includes('region 2');
}

export function getBnvAvailableOptions(rates: BnvRateRecord[]): BnvAvailableOptions & { topesCoaseguro: number[] } {
  const sumas = new Set<number>();
  const deds = new Set<number>();
  const coass = new Set<number>();
  const topes = new Set<number>();

  for (const r of rates) {
    const parsed = parsePlanName(r.plan_name);
    if (!parsed) continue;
    sumas.add(parsed.suma);
    deds.add(parsed.deducible);
    coass.add(parsed.coaseguro);
    if (parsed.topeCoaseguro != null) topes.add(parsed.topeCoaseguro);
  }

  return {
    sumasAseguradas: [...sumas].sort((a, b) => a - b),
    deducibles: [...deds].sort((a, b) => a - b),
    coaseguros: [...coass].sort((a, b) => a - b),
    topesCoaseguro: [...topes].sort((a, b) => a - b),
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

    // Filtrar por la combinación pedida (S/D/C/región), indexar por edad.
    // Coaccionamos a número en ambos lados: si el input llega como string (p.ej. de
    // una cotización guardada) el === estricto fallaba en silencio y no encontraba nada.
    const targetSuma = Number(input.suma_asegurada);
    const targetDed = Number(input.deducible);
    const targetCoas = Number(input.coaseguro);
    const targetTopeK = input.tope_coaseguro ? Math.round(Number(input.tope_coaseguro) / 1000) : 0;

    // Agrupar candidatos (misma SA/Ded/Coas/Región) por tope de coaseguro → edad → tasa.
    // El tope se resuelve por el más cercano si no hay match exacto, en lugar de fallar
    // duro (mismo criterio de degradado que usa el motor BNP con nearestKey).
    const byTope = new Map<number, Map<number, number>>();

    for (const r of rates) {
      const parsed = parsePlanName(r.plan_name);
      if (!parsed) continue;
      if (Number(parsed.suma) !== targetSuma) continue;
      if (Number(parsed.deducible) !== targetDed) continue;
      if (Number(parsed.coaseguro) !== targetCoas) continue;
      if (!matchesRegion(r.region, input.region_zone)) continue;
      const rate = Number(r.rate);
      if (isNaN(rate) || rate <= 0) continue;
      const topeK = parsed.topeCoaseguro == null ? 0 : Number(parsed.topeCoaseguro);
      if (!byTope.has(topeK)) byTope.set(topeK, new Map<number, number>());
      byTope.get(topeK)!.set(Number(r.age), rate);
    }

    // Elegir el grupo de tope adecuado
    let ratesByAge: Map<number, number> | undefined;
    if (byTope.size > 0) {
      if (targetCoas <= 0) {
        // Coaseguro 0% → el tope no aplica (esos planes no llevan TC)
        ratesByAge = byTope.get(0) ?? [...byTope.values()][0];
      } else if (targetTopeK > 0 && byTope.has(targetTopeK)) {
        ratesByAge = byTope.get(targetTopeK);
      } else {
        // Tope más cercano disponible para esta combinación
        const topesDisponibles = [...byTope.keys()].filter(t => t > 0);
        if (topesDisponibles.length > 0) {
          const nearestTope = topesDisponibles.reduce((prev, curr) =>
            Math.abs(curr - targetTopeK) < Math.abs(prev - targetTopeK) ? curr : prev, topesDisponibles[0]);
          ratesByAge = byTope.get(nearestTope);
        } else {
          ratesByAge = [...byTope.values()][0];
        }
      }
    }

    if (!ratesByAge || ratesByAge.size === 0) {
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
