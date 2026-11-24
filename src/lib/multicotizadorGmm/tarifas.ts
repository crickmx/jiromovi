/**
 * Carga de las tarifas ACTIVAS del Multicotizador GMM.
 *
 * Un solo lugar que sabe de dónde sale cada cotizador:
 *  - BNV / BNP -> `multicotizador_gmm_packages` + `multicotizador_gmm_rates`
 *  - BX+       -> `tariff_packages` + `tariff_tables`
 *
 * La meta del paquete (listas de opciones, zonas, tipos de cliente, derecho de póliza,
 * reglas de la catastrófica) viaja completa en `internal_factors`, y las listas también se
 * duplican en sus columnas para poder listarlas sin abrir el JSON.
 */

import { supabase } from '../supabase';
import type { ProductId, OpcionesGmm } from './types';
import type {
  BupaPackageMeta, BupaProduct, BupaClientType, BupaZona, BupaEstado,
} from './bupaTariffParser';
import type { BnvRateRecord } from './bnvEngine';
import type { BnpRateRecord } from './bnpEngine';
import { opcionesBxplus } from './bxplusEngine';

export interface FilaPaqueteGmm {
  id: string;
  product: string;
  version_name: string | null;
  source_filename: string | null;
  status: string;
  derecho_poliza: number | null;
  asistencia_extranjero: number | null;
  costo_catastrofica_extranjero: number | null;
  sumas_aseguradas: number[] | null;
  deducibles: number[] | null;
  coaseguros: number[] | null;
  topes_coaseguro: number[] | null;
  client_types: BupaClientType[] | null;
  internal_factors: Partial<BupaPackageMeta> | null;
  rates_count: number | null;
  activated_at: string | null;
}

export interface FilaPaqueteBx {
  id: string;
  name: string | null;
  status: string;
  activated_at: string | null;
}

export interface TablaTarifa {
  table_key: string;
  data_json: unknown;
}

export interface PaqueteBupa {
  pkg: FilaPaqueteGmm;
  rates: BnvRateRecord[] | BnpRateRecord[];
  meta: Partial<BupaPackageMeta>;
}

export interface PaqueteBxplus {
  pkg: FilaPaqueteBx;
  tables: TablaTarifa[];
}

export interface TarifasActivas {
  BNV?: PaqueteBupa;
  BNP?: PaqueteBupa;
  BXPLUS?: PaqueteBxplus;
  errores: Partial<Record<ProductId, string>>;
}

function metaDe(pkg: FilaPaqueteGmm): Partial<BupaPackageMeta> {
  const internal = (pkg.internal_factors ?? {}) as Partial<BupaPackageMeta>;
  const product = (pkg.product ?? internal.product) as BupaProduct;
  return {
    ...internal,
    product,
    plan_prefix: internal.plan_prefix || (product === 'BNP' ? 'NPS' : 'NVFS'),
    sumas_aseguradas: pkg.sumas_aseguradas?.length ? pkg.sumas_aseguradas : internal.sumas_aseguradas,
    deducibles: pkg.deducibles?.length ? pkg.deducibles : internal.deducibles,
    coaseguros: pkg.coaseguros?.length ? pkg.coaseguros : internal.coaseguros,
    topes_coaseguro: pkg.topes_coaseguro?.length ? pkg.topes_coaseguro : internal.topes_coaseguro,
    client_types: pkg.client_types?.length ? pkg.client_types : internal.client_types,
    zonas: (internal.zonas ?? []) as BupaZona[],
    estados: (internal.estados ?? []) as BupaEstado[],
    derecho_poliza: Number(pkg.derecho_poliza ?? internal.derecho_poliza ?? 1600),
    asistencia_extranjero: Number(pkg.asistencia_extranjero ?? internal.asistencia_extranjero ?? 1632),
  };
}

/**
 * Trae TODAS las filas de una consulta paginando.
 *
 * PostgREST corta cada respuesta en 1,000 filas (`content-range: 0-999/*`), así que una sola
 * llamada a `multicotizador_gmm_rates` devolvía sólo la milésima parte de la tabla y el
 * cotizador no encontraba la tarifa de casi ningún plan. Se piden páginas en paralelo.
 */
async function traerTodo<T>(
  construir: (desde: number, hasta: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>
): Promise<T[] | { error: string }> {
  const TAMANO = 1000;
  const CONCURRENTES = 8;

  const primera = await construir(0, TAMANO - 1);
  if (primera.error) return { error: primera.error.message };
  const filas: T[] = [...(primera.data ?? [])];
  if (filas.length < TAMANO) return filas;

  // Páginas siguientes en tandas: si una tanda trae menos de lo pedido, ya no hay más.
  for (let vuelta = 0; vuelta < 400; vuelta++) {
    const inicio = TAMANO + vuelta * TAMANO * CONCURRENTES;
    const peticiones: Array<PromiseLike<{ data: T[] | null; error: { message: string } | null }>> = [];
    for (let i = 0; i < CONCURRENTES; i++) {
      const desde = inicio + i * TAMANO;
      peticiones.push(construir(desde, desde + TAMANO - 1));
    }
    const resultados = await Promise.all(peticiones);
    let corto = false;
    for (const r of resultados) {
      if (r.error) return { error: r.error.message };
      const lote = r.data ?? [];
      filas.push(...lote);
      if (lote.length < TAMANO) corto = true;
    }
    if (corto) break;
  }

  return filas;
}

async function cargarBupa(product: BupaProduct): Promise<PaqueteBupa | { error: string }> {
  const { data, error } = await supabase
    .from('multicotizador_gmm_packages')
    .select('*')
    .eq('product', product)
    .eq('status', 'active')
    .order('activated_at', { ascending: false })
    .limit(1);

  if (error) return { error: `No se pudo leer la tarifa ${product}: ${error.message}` };
  const pkg = (data?.[0] ?? null) as FilaPaqueteGmm | null;
  if (!pkg) return { error: `No hay tarifa ${product} activa. Súbela en la pestaña Tarifas.` };

  const rates = await traerTodo<BnvRateRecord>((desde, hasta) =>
    supabase
      .from('multicotizador_gmm_rates')
      .select('plan_name, region, age, rate, rate_type')
      .eq('package_id', pkg.id)
      .order('id', { ascending: true })
      .range(desde, hasta)
  );

  if (!Array.isArray(rates)) return { error: `No se pudieron leer las tarifas ${product}: ${rates.error}` };
  if (rates.length === 0) {
    return { error: `La tarifa ${product} activa no tiene datos. Sube de nuevo el cotizador en Tarifas.` };
  }

  return { pkg, rates, meta: metaDe(pkg) };
}

async function cargarBxplus(): Promise<PaqueteBxplus | { error: string }> {
  const { data, error } = await supabase
    .from('tariff_packages')
    .select('id, name, status, activated_at')
    .eq('status', 'active')
    .order('activated_at', { ascending: false })
    .limit(1);

  if (error) return { error: `No se pudo leer la tarifa BX+: ${error.message}` };
  const pkg = (data?.[0] ?? null) as FilaPaqueteBx | null;
  if (!pkg) return { error: 'No hay tarifa BX+ Unikuz activa.' };

  const { data: tables, error: tablesError } = await supabase
    .from('tariff_tables')
    .select('table_key, data_json')
    .eq('tariff_package_id', pkg.id);

  if (tablesError) return { error: `No se pudieron leer las tablas BX+: ${tablesError.message}` };
  if (!tables || tables.length === 0) return { error: 'La tarifa BX+ activa no tiene tablas cargadas.' };

  return { pkg, tables: tables as TablaTarifa[] };
}

export async function cargarTarifasActivas(necesarias?: ProductId[]): Promise<TarifasActivas> {
  const quiere = (p: ProductId) => !necesarias || necesarias.includes(p);
  const out: TarifasActivas = { errores: {} };

  const [bnv, bnp, bx] = await Promise.all([
    quiere('BNV') ? cargarBupa('BNV') : Promise.resolve(null),
    quiere('BNP') ? cargarBupa('BNP') : Promise.resolve(null),
    quiere('BXPLUS') ? cargarBxplus() : Promise.resolve(null),
  ]);

  if (bnv) {
    if ('error' in bnv) out.errores.BNV = bnv.error; else out.BNV = bnv;
  }
  if (bnp) {
    if ('error' in bnp) out.errores.BNP = bnp.error; else out.BNP = bnp;
  }
  if (bx) {
    if ('error' in bx) out.errores.BXPLUS = bx.error; else out.BXPLUS = bx;
  }
  return out;
}

/** Opciones para los selectores de la UI, tomadas del paquete activo. */
export function opcionesDeTarifas(t: TarifasActivas): OpcionesGmm {
  const out: OpcionesGmm = {};
  if (t.BNV) {
    out.BNV = {
      sumas_aseguradas: t.BNV.meta.sumas_aseguradas ?? [],
      deducibles: t.BNV.meta.deducibles ?? [],
      coaseguros: t.BNV.meta.coaseguros ?? [],
      topes_coaseguro: t.BNV.meta.topes_coaseguro ?? [],
      zonas: (t.BNV.meta.zonas ?? []).map(z => ({ label: z.label, region: z.region })),
      client_types: (t.BNV.meta.client_types ?? []).map(c => ({ label: c.label, suffix: c.suffix })),
      derecho_poliza: t.BNV.meta.derecho_poliza,
    };
  }
  if (t.BNP) {
    out.BNP = {
      sumas_aseguradas: t.BNP.meta.sumas_aseguradas ?? [],
      deducibles: t.BNP.meta.deducibles ?? [],
      coaseguros: t.BNP.meta.coaseguros ?? [],
      estados: t.BNP.meta.estados ?? [],
      zonas: (t.BNP.meta.zonas ?? []).map(z => ({ label: z.label, region: z.region })),
      client_types: (t.BNP.meta.client_types ?? []).map(c => ({ label: c.label, suffix: c.suffix })),
      derecho_poliza: t.BNP.meta.derecho_poliza,
    };
  }
  if (t.BXPLUS) {
    // Las listas de BX+ viven en las tablas de la hoja Tarifa del Excel.
    const o = opcionesBxplus(t.BXPLUS.tables);
    out.BXPLUS = {
      sumas_aseguradas: o.sumas_aseguradas,
      deducibles: o.deducibles,
      coaseguros: o.coaseguros,
      topes_coaseguro: o.topes_coaseguro,
      estados_bx: o.estados,
      niveles: o.niveles,
      tabuladores: o.tabuladores,
    };
  }
  return out;
}
