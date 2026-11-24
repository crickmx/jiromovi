/**
 * Motor de Bupa Nacional Vital (BNV) — replica el cotizador Excel
 * "Cotizador-BNV-2026-V4".
 *
 * Logica (hoja "Datos Asegurado" + "MasterBase"):
 *   F4  = "NVFS" & (SA/1e6) & "D" & (Deducible/1e3) & "C" & (Coaseguro*100) & IF(Tope=0,"","TC" & Tope/1e3)
 *   A7  = IF(Zona="Zona 1: ...", "Mexico Region 1 BNV", "Mexico Region 2 (no CDMX, ZM Y MTY)")
 *   Prima de cada asegurado = VLOOKUP(F4 & A7 & Edad, MasterBase, Rate)   <- ya trae todos los factores
 *   Total Prima   = SUM(primas) + IF(Asistencia="Si", 1632, 0)
 *   Recargo       = x1.045 (semestral) / x1.075 (trimestral) / x1.09 (mensual)
 *   IVA           = (Total Prima + Derecho de poliza) * 16%
 *   Primer pago   = (Total Prima/n + Derecho) * 1.16   (el Derecho se cobra completo en el 1er recibo)
 */

import type {
  BnvQuoteInput, BnvCalculationResult, BnvPersonResult, BnvPaymentBreakdown,
  QuotePerson, FormaPago, GenderType,
} from './types';
import {
  FACTORES_PAGO_DEFAULT, buildRateIndex, lookupRate,
  calcularPagos, regionDeZona, numKey, round2, sexoExcel,
  type BupaRateRecord, type FactoresPago,
} from './bupaShared.ts';

export type BnvRateRecord = BupaRateRecord;

export interface BnvPackageConfig {
  id: string;
  derecho_poliza: number;
  asistencia_extranjero: number;
  /** Prefijo del codigo de plan tal como lo arma el Excel ("NVFS"). */
  plan_prefix?: string;
  zonas?: Array<{ label: string; region: string; factor: number }>;
  factores_pago?: FactoresPago;
  max_integrantes?: number;
}

export interface BnvAvailableOptions {
  sumasAseguradas: number[];
  deducibles: number[];
  coaseguros: number[];
  topesCoaseguro: number[];
}

/** Deriva las opciones que ofrece el cotizador a partir de la tabla de tarifas cargada. */
export function getBnvAvailableOptions(rates: BnvRateRecord[], prefix = 'NVFS'): BnvAvailableOptions {
  const sumas = new Set<number>();
  const deds = new Set<number>();
  const coass = new Set<number>();
  const topes = new Set<number>();
  const re = new RegExp(`^${prefix}(\\d+(?:\\.\\d+)?)D(\\d+(?:\\.\\d+)?)C(\\d+)(?:TC(\\d+))?$`);

  for (const r of rates) {
    const m = re.exec(String(r.plan_name ?? ''));
    if (!m) continue;
    sumas.add(Number(m[1]));
    deds.add(Number(m[2]));
    coass.add(Number(m[3]));
    if (m[4] != null) topes.add(Number(m[4]));
  }

  const asc = (a: number, b: number) => a - b;
  return {
    sumasAseguradas: [...sumas].sort(asc),
    deducibles: [...deds].sort(asc),
    coaseguros: [...coass].sort(asc),
    topesCoaseguro: [...topes].sort(asc).map(k => k * 1000),
  };
}

export function calculateBnv(
  input: BnvQuoteInput,
  people: QuotePerson[],
  rates: BnvRateRecord[],
  packageConfig: BnvPackageConfig
): BnvCalculationResult {
  const vacio = (error: string): BnvCalculationResult => ({
    product: 'BNV',
    people_results: [],
    prima_anual_total: 0,
    totals: {} as Partial<Record<FormaPago, BnvPaymentBreakdown>>,
    tariff_package_id: packageConfig.id,
    error,
  });

  try {
    if (!rates || rates.length === 0) {
      return vacio('No hay tarifas cargadas para BNV. Sube un archivo de cotizador en Tarifas.');
    }
    if (!people || people.length === 0) {
      return vacio('Agrega al menos un asegurado.');
    }

    const prefix = packageConfig.plan_prefix || 'NVFS';
    const index = buildRateIndex(rates, prefix, 'BNV');

    // Si la tarifa activa se cargó con el lector anterior (u otro archivo) no habrá ni una
    // llave del producto: mejor un error claro que una cotización en ceros.
    if (index.size === 0) {
      return vacio(
        `La tarifa BNV activa no contiene la tabla de tarifas del cotizador (no hay planes "${prefix}..."). ` +
        'Vuelve a subir el Excel en la pestaña Tarifas y actívala.'
      );
    }

    const region = regionDeZona(input.region_zone, packageConfig.zonas, 'BNV');

    // Llave del plan, tal como la arma el Excel (columna F de MasterBase).
    const saMdp = Number(input.suma_asegurada);
    const dedK = Number(input.deducible);
    const coasPct = Number(input.coaseguro);
    const topePesos = Number(input.tope_coaseguro ?? 0);
    const topeK = topePesos > 0 ? topePesos / 1000 : 0;
    const planCode =
      `${prefix}${numKey(saMdp)}D${numKey(dedK)}C${numKey(coasPct)}` +
      (topeK > 0 ? `TC${numKey(topeK)}` : '');

    const warnings: string[] = [];
    const peopleResults: BnvPersonResult[] = people.map(p => {
      const age = Number(p.age);
      const rate = lookupRate(index, planCode, region, age, 'Unisex');
      if (rate === null) {
        warnings.push(`Sin tarifa para ${p.name || 'asegurado'} (${age} años) en el plan ${planCode} / ${region}`);
      }
      return {
        person_id: p.id,
        person_name: p.name,
        relation: p.relation,
        age,
        gender: p.gender as GenderType,
        lookup_key: `${planCode}${region}${age}`,
        base_rate: rate ?? 0,
        discounted_rate: rate ?? 0,
      };
    });

    const primaPersonas = peopleResults.reduce((s, p) => s + p.discounted_rate, 0);
    const asistencia = input.asistencia_extranjero ? Number(packageConfig.asistencia_extranjero || 0) : 0;
    const primaAnual = round2(primaPersonas + asistencia);

    const factores = packageConfig.factores_pago ?? FACTORES_PAGO_DEFAULT;
    // En el Excel cada renglon (primas + asistencia) se multiplica por el factor de la
    // forma de pago, asi que equivale a multiplicar el "Total Prima".
    const totals = calcularPagos(
      {
        primaPeriodo: primaPersonas + asistencia,
        derechoPoliza: Number(packageConfig.derecho_poliza || 0),
        asistenciaExtranjero: asistencia,
        catastroficaExtranjero: 0,
        extraEnCostoTotal: 0,
      },
      factores
    ) as unknown as Partial<Record<FormaPago, BnvPaymentBreakdown>>;

    return {
      product: 'BNV',
      people_results: peopleResults,
      prima_anual_total: primaAnual,
      totals,
      tariff_package_id: packageConfig.id,
      warnings: warnings.length ? warnings : undefined,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return vacio(msg || 'Error al calcular BNV');
  }
}

// Reexport util para las pruebas y para la UI.
export { sexoExcel };
