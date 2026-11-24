/**
 * Motor de Bupa Nacional Plus (BNP) — replica el cotizador Excel
 * "Cotizador-BNP-2026-V3-Nuevos-Negocios".
 *
 * Logica (hoja "Datos Asegurado" + "MasterBase"):
 *   E4  = "NPS" & (SA/1e6) & "D" & (Deducible/1e3) & "C" & (Coaseguro*100) & SufijoTipoCliente
 *   A7  = IF(Zona="Zona 1", "Mexico Region 1", "Mexico Region 2")
 *   Prima = VLOOKUP(E4 & A7 & Edad & Sexo, MasterBase, Rate)   <- la tarifa ya es por sexo
 *   Total Prima = SUM(primas) + IF(Asistencia="Si",1632,0) + Catastrofica
 *   Catastrofica = IF(Aplica, 5800 * Integrantes, "N/A")
 *        Aplica si E33="Si" Y la suma asegurada esta en {20,50} MDP
 *        Y el deducible esta en {35,000, 55,000, 75,000, 115,000, 200,000}
 *   Recargo = x1.045 / x1.075 / x1.09 ; IVA = 16%
 *   Primer pago = (Total Prima/n + Derecho) * 1.16
 */

import type {
  BnpQuoteInput, BnpCalculationResult, BnpPersonResult, BnpPaymentBreakdown,
  QuotePerson, FormaPago, GenderType,
} from './types';
import {
  FACTORES_PAGO_DEFAULT, FORMAS_PAGO, buildRateIndex, lookupRate, calcularPagos,
  regionDeZona, numKey, round2, sexoExcel,
  type BupaRateRecord, type FactoresPago,
} from './bupaShared.ts';

export type BnpRateRecord = BupaRateRecord;

export interface BnpPackageConfig {
  id: string;
  derecho_poliza: number;
  asistencia_extranjero: number;
  costo_catastrofica_extranjero: number;
  plan_prefix?: string;
  zonas?: Array<{ label: string; region: string; factor: number }>;
  /** BNP elige la zona por estado de residencia (hoja Master, B3:D35). */
  estados?: Array<{ estado: string; zona: string }>;
  client_types?: Array<{ label: string; suffix: string; factor: number }>;
  catastrofica?: {
    costo_por_integrante: number;
    sumas_elegibles: number[];
    deducibles_elegibles: number[];
  };
  factores_pago?: FactoresPago;
  max_integrantes?: number;
}

export interface BnpAvailableOptions {
  sumasAseguradas: number[];
  deducibles: number[];
  coaseguros: number[];
}

/** Sufijo que el Excel agrega al codigo de plan segun el tipo de cliente. */
export function sufijoCliente(
  clientType: string | undefined,
  clientTypes: Array<{ label: string; suffix: string }> | undefined
): string {
  const c = String(clientType ?? '').trim();
  if (clientTypes && clientTypes.length > 0) {
    const exacto = clientTypes.find(ct => ct.label.toLowerCase() === c.toLowerCase());
    if (exacto) return exacto.suffix ?? '';
  }
  const l = c.toLowerCase();
  if (l.includes('transfer')) return 'T';
  if (l.includes('periodos de espera')) return 'PE';
  return '';
}

export function getBnpAvailableOptions(rates: BnpRateRecord[], prefix = 'NPS'): BnpAvailableOptions {
  const sumas = new Set<number>();
  const deds = new Set<number>();
  const coass = new Set<number>();
  const re = new RegExp(`^${prefix}(\\d+(?:\\.\\d+)?)D(\\d+(?:\\.\\d+)?)C(\\d+)(?:T|PE)?$`);

  for (const r of rates) {
    const m = re.exec(String(r.plan_name ?? ''));
    if (!m) continue;
    sumas.add(Number(m[1]));
    deds.add(Number(m[2]));
    coass.add(Number(m[3]));
  }

  const asc = (a: number, b: number) => a - b;
  return {
    sumasAseguradas: [...sumas].sort(asc),
    deducibles: [...deds].sort(asc),
    coaseguros: [...coass].sort(asc),
  };
}

/** Zona (Zona 1 / Zona 2) a partir del estado de residencia. */
export function zonaDeEstado(
  estado: string | undefined,
  estados: Array<{ estado: string; zona: string }> | undefined
): string | null {
  const e = String(estado ?? '').trim().toLowerCase();
  if (!e || !estados) return null;
  const exacto = estados.find(x => x.estado.toLowerCase() === e);
  if (exacto) return exacto.zona;
  const parcial = estados.find(x => x.estado.toLowerCase().startsWith(e) || e.startsWith(x.estado.toLowerCase()));
  return parcial ? parcial.zona : null;
}

export function calculateBnp(
  input: BnpQuoteInput,
  people: QuotePerson[],
  rates: BnpRateRecord[],
  packageConfig: BnpPackageConfig
): BnpCalculationResult {
  const vacio = (error: string): BnpCalculationResult => ({
    product: 'BNP',
    people_results: [],
    prima_anual_total: 0,
    totals: {} as Partial<Record<FormaPago, BnpPaymentBreakdown>>,
    tariff_package_id: packageConfig.id,
    error,
  });

  try {
    if (!rates || rates.length === 0) {
      return vacio('No hay tarifas cargadas para BNP. Sube un archivo de cotizador en Tarifas.');
    }
    if (!people || people.length === 0) {
      return vacio('Agrega al menos un asegurado.');
    }

    const prefix = packageConfig.plan_prefix || 'NPS';
    const index = buildRateIndex(rates, prefix, 'BNP');

    // La tarifa BNP que está activa se cargó con el lector anterior (guardaba las columnas
    // de la hoja Master, no la tabla de tarifas). Sin las llaves del producto no se puede
    // cotizar: se avisa en vez de devolver ceros.
    if (index.size === 0) {
      return vacio(
        `La tarifa BNP activa no contiene la tabla de tarifas del cotizador (no hay planes "${prefix}..."). ` +
        'Vuelve a subir el Excel en la pestaña Tarifas y actívala.'
      );
    }

    // La zona sale del estado de residencia cuando lo hay (como en el Excel);
    // si no, se usa la zona elegida directamente.
    const zonaDeEstadoCalc = zonaDeEstado(input.estado, packageConfig.estados);
    const zona = zonaDeEstadoCalc ?? input.region_zone;
    const region = regionDeZona(zona, packageConfig.zonas, 'BNP');

    const saMdp = Number(input.suma_asegurada);
    const dedK = Number(input.deducible);
    const coasPct = Number(input.coaseguro);
    const suffix = sufijoCliente(input.client_type, packageConfig.client_types);
    const planCodeBase = `${prefix}${numKey(saMdp)}D${numKey(dedK)}C${numKey(coasPct)}`;

    const warnings: string[] = [];
    const peopleResults: BnpPersonResult[] = people.map(p => {
      const age = Number(p.age);
      const sexo = sexoExcel(p);
      // El Excel marca el tipo de cliente en el codigo; si esa variante no existe en la
      // tabla se usa la generica (las tres traen la misma tarifa en el archivo actual).
      let rate = lookupRate(index, `${planCodeBase}${suffix}`, region, age, sexo);
      let code = `${planCodeBase}${suffix}`;
      if (rate === null && suffix) {
        rate = lookupRate(index, planCodeBase, region, age, sexo);
        code = planCodeBase;
      }
      if (rate === null) {
        warnings.push(`Sin tarifa para ${p.name || 'asegurado'} (${age} años, ${sexo}) en el plan ${code} / ${region}`);
      }
      return {
        person_id: p.id,
        person_name: p.name,
        relation: p.relation,
        age,
        gender: p.gender as GenderType,
        lookup_key: `${code}${region}${age}${sexo}`,
        annual_premium: rate ?? 0,
      };
    });

    const primaPersonas = peopleResults.reduce((s, p) => s + p.annual_premium, 0);
    const asistencia = input.asistencia_extranjero ? Number(packageConfig.asistencia_extranjero || 0) : 0;

    // Cobertura de enfermedades catastroficas en el extranjero (celdas H33/I33/C46).
    const cat = packageConfig.catastrofica ?? {
      costo_por_integrante: Number(packageConfig.costo_catastrofica_extranjero || 0),
      sumas_elegibles: [20_000_000, 50_000_000],
      deducibles_elegibles: [35_000, 55_000, 75_000, 115_000, 200_000],
    };
    const saPesos = saMdp * 1_000_000;
    const dedPesos = dedK * 1000;
    const titular = people.find(p => p.relation === 'Titular') ?? people[0];
    const titularMayor = Number(titular?.age ?? 0) >= 18;
    const aplicaCatastrofica =
      Boolean(input.cobertura_catastrofica_extranjero) &&
      titularMayor &&
      cat.sumas_elegibles.includes(saPesos) &&
      cat.deducibles_elegibles.includes(dedPesos);
    const importeCatastrofica = aplicaCatastrofica ? cat.costo_por_integrante * people.length : 0;

    const primaAnual = round2(primaPersonas + asistencia + importeCatastrofica);

    const factores = packageConfig.factores_pago ?? FACTORES_PAGO_DEFAULT;
    const totals = calcularPagos(
      {
        primaPeriodo: primaPersonas + asistencia + importeCatastrofica,
        derechoPoliza: Number(packageConfig.derecho_poliza || 0),
        asistenciaExtranjero: asistencia,
        catastroficaExtranjero: importeCatastrofica,
        // El Excel suma la catastrófica dos veces en la línea "Costo total"
        // (C51 = ...+C46+C47, y C47 = SUM(C41:C46) ya la incluye). Se replica tal cual
        // para que el número coincida con el Excel; si la aseguradora corrige la
        // fórmula, este término debe quedar en 0.
        extraEnCostoTotal: importeCatastrofica,
      },
      factores
    ) as unknown as Partial<Record<FormaPago, BnpPaymentBreakdown>>;

    return {
      product: 'BNP',
      people_results: peopleResults,
      prima_anual_total: primaAnual,
      totals,
      tariff_package_id: packageConfig.id,
      warnings: warnings.length ? warnings : undefined,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return vacio(msg || 'Error al calcular BNP');
  }
}

export { FORMAS_PAGO };
