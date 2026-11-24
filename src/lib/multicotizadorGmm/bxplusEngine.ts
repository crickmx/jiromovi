/**
 * Motor EXACTO de BX+ Unikuz — puerto directo de las fórmulas del Excel
 * "Cotizador_Únikuz_Bx+_...".
 *
 * El Excel arma la tarifa en la hoja `Tarifa` con un generador de columnas:
 *
 *   L7  = GASTO ADMON + GASTO ADQUIS + UTILIDAD            (0.10 + 0.27 + 0.07 = 0.44)
 *   H   = Prima de riesgo (col D/E por edad y sexo) / (1 - L7)
 *   BN4 = factor Entidad      (VLOOKUP del estado)
 *   BN5 = factor Nivel        (ELITE / PLUS / ESTANDAR)
 *   BN6 = factor Tabulador    (PLATA / PALADIO / OSMIO / IRIDIO / ORO / PLATINO)
 *   BN7 = factor Suma asegurada
 *   BN8 = factor Deducible
 *   BN9 = factor Coaseguro
 *
 *   Básica (CH/CI) = ROUND(H × BN4×BN5×BN6×BN7×BN8×BN9, 4)
 *
 * y cada cobertura adicional tiene SU PROPIA combinación de factores y su coeficiente
 * (no es "básica × coeficiente"): por eso el cálculo se transcribe columna por columna
 * tal como está en el Excel, en vez de aproximarlo.
 *
 * El total por asegurado es Básica + Σ(coberturas seleccionadas), y la hoja `Cotizacion`
 * agrega recargo por pago fraccionado, derecho de póliza (900), IVA 16% y el reparto en
 * recibos (el derecho se cobra completo en el primero).
 */

import type {
  BxplusQuoteInput, BxplusCalculationResult, BxplusPaymentBreakdown,
  QuotePerson, FormaPago, GenderType, BxplusCoverages,
} from './types';

/** Fila de una tabla de tarifas tal como la guarda la función `gmm-upload-tariff`. */
export type FilaTabla = Record<string, unknown>;

/** Tabla de tarifas (jsonb de Supabase): { table_key, data_json }. */
export interface TablaTarifaBx {
  table_key: string;
  data_json: unknown;
}

export interface BxplusTables {
  factor_estado: FilaTabla[];
  factor_nivel_hospitalario: FilaTabla[];
  factor_tabulador: FilaTabla[];
  factor_suma_asegurada: FilaTabla[];
  factor_deducible: FilaTabla[];
  factor_coaseguro: FilaTabla[];
  tope_coaseguro: FilaTabla[];
  forma_pago: FilaTabla[];
  base_intermedia_edad_sexo: FilaTabla[];
  coef_medicamentos: number;
  coef_preexistentes: number;
  coef_complicaciones: number;
  coef_vip: number;
  coef_antiguedad: number;
  coef_emergencia_ext: number;
  coef_enf_graves_ext: number;
  coef_ayuda_diaria: number;
  coef_ampliacion_servicios: number;
  denominador_cargas: number[];
  deducible_accidente_keys: unknown[];
  deducible_accidente_factors: unknown[];
  multiregion_carga_sistema: FilaTabla[];
  cobertura_internacional_carga_sistema: FilaTabla[];
  gastos_expedicion: number;
  iva: number;
}

const IVA_DEFAULT = 0.16;

/** ROUND de Excel a n decimales (evita el sesgo de Math.round en .5 y el ruido binario). */
function xround(n: number, dec = 4): number {
  if (!Number.isFinite(n)) return 0;
  const f = 10 ** dec;
  return Math.round((n + (n >= 0 ? 1 : -1) * 1e-12) * f) / f;
}

function norm(v: unknown): string {
  if (typeof v === 'number') return String(v);
  return String(v ?? '').trim().toLowerCase();
}

function igual(a: unknown, b: unknown): boolean {
  const na = Number(a);
  const nb = Number(b);
  const sa = String(a ?? '').trim();
  const sb = String(b ?? '').trim();
  if (sa !== '' && sb !== '' && Number.isFinite(na) && Number.isFinite(nb)) return na === nb;
  return norm(a) === norm(b);
}

function col(fila: FilaTabla | undefined, i: number): unknown {
  return fila ? fila[`col_${i}`] : undefined;
}

/** Busca una fila por su primera columna y devuelve la columna indicada (0 = col_0). */
function buscar(tabla: FilaTabla[] | undefined, clave: unknown, columna: number, etiqueta: string): number {
  if (!tabla || tabla.length === 0) {
    throw new Error(`[BX+] La tabla "${etiqueta}" no está cargada en la tarifa activa.`);
  }
  const fila = tabla.find(r => igual(col(r, 0), clave));
  if (!fila) {
    throw new Error(`[BX+] No se encontró "${clave}" en la tabla "${etiqueta}". Revisa la tarifa cargada.`);
  }
  const valor = Number(col(fila, columna));
  if (!Number.isFinite(valor)) {
    throw new Error(`[BX+] La tabla "${etiqueta}" no tiene un valor numérico para "${clave}".`);
  }
  return valor;
}

/** Tope de coaseguro contratado (hoja Tarifa, T13:U17). */
export function topeDeCoaseguro(tabla: FilaTabla[], coaseguro: unknown): number {
  const fila = (tabla || []).find(r => igual(col(r, 0), coaseguro));
  return fila ? Number(col(fila, 1)) || 0 : 0;
}

export interface BxplusDetalleAsegurado {
  basica: number;
  adicionales: Record<string, number>;
  adicionales_total: number;
  total: number;
}

/**
 * Calcula un asegurado con las fórmulas exactas del generador de tarifa.
 * `D` es la prima de riesgo de la edad y el sexo (columnas D/E de la hoja Tarifa).
 */
export function calcularAseguradoBxplus(
  edad: number,
  sexo: 'Hombre' | 'Mujer',
  input: BxplusQuoteInput,
  tables: BxplusTables
): BxplusDetalleAsegurado {
  const cov = input.coverages || {};

  const fila = (tables.base_intermedia_edad_sexo || []).find(r => Number(col(r, 0)) === Number(edad));
  if (!fila) {
    const edades = (tables.base_intermedia_edad_sexo || []).map(r => Number(col(r, 0))).filter(Number.isFinite);
    throw new Error(
      `[BX+] La tarifa activa no tiene prima para la edad ${edad} (rango ${Math.min(...edades)}-${Math.max(...edades)}).`
    );
  }
  const D = Number(col(fila, sexo === 'Hombre' ? 1 : 2)) || 0;

  const cargas = (tables.denominador_cargas || []).reduce((s, v) => s + (Number(v) || 0), 0);
  const k = 1 - cargas;
  if (k <= 0) throw new Error(`[BX+] Las cargas de la tarifa (${cargas}) no dejan margen para calcular.`);

  const BN4 = buscar(tables.factor_estado, input.estado, 2, 'Factor Entidad');
  const BN5 = buscar(tables.factor_nivel_hospitalario, input.nivel_hospitalario, 1, 'Nivel Hospitalario');
  const BN6 = buscar(tables.factor_tabulador, input.tabulador, 1, 'Tabulador Honorarios');
  const BN7 = buscar(tables.factor_suma_asegurada, input.suma_asegurada, 1, 'Suma Asegurada');
  const BN8 = buscar(tables.factor_deducible, input.deducible, 1, 'Deducible');
  const BN9 = buscar(tables.factor_coaseguro, input.coaseguro, 1, 'Coaseguro');

  const H = D / k;
  const basica = xround(H * BN4 * BN5 * BN6 * BN7 * BN8 * BN9, 4);

  // Factor de eliminación de deducible por accidente: el Excel lo toma de la columna
  // redondeada a 3 decimales (AV), no del valor crudo (AW).
  const dedAccKeys = tables.deducible_accidente_keys || [];
  const dedAccFactors = tables.deducible_accidente_factors || [];
  const iDed = dedAccKeys.findIndex(x => igual(x, input.deducible));
  const fDedAccidente = iDed >= 0 ? xround(Number(dedAccFactors[iDed]) || 0, 3) : 0;

  const factorMultiregion = (tables.multiregion_carga_sistema || []).find(r => norm(col(r, 0)) === norm(input.estado));
  const CW2 = factorMultiregion ? xround(Number(col(factorMultiregion, 2)) || 0, 5) : 0;
  const factorInternacional = (tables.cobertura_internacional_carga_sistema || [])
    .find(r => norm(col(r, 0)) === norm(input.estado));
  const DE2 = factorInternacional ? Number(col(factorInternacional, 2)) || 0 : 0;

  const adicionales: Record<string, number> = {};
  const suma = (nombre: keyof BxplusCoverages, valor: number) => {
    if (cov[nombre] && valor !== 0) adicionales[nombre] = xround(valor, 4);
  };

  suma('reconocimiento_antiguedad', basica * (tables.coef_antiguedad || 0));
  suma('medicamentos_fuera', ((D * BN4 * BN5 * BN7 * BN8 * BN9) / k) * (tables.coef_medicamentos || 0));
  suma('complicaciones_no_amparadas', ((D * BN4 * BN5 * BN6 * BN8 * BN9) / k) * (tables.coef_complicaciones || 0));
  suma('padecimientos_preexistentes', basica * (tables.coef_preexistentes || 0));
  suma('eliminacion_deducible_accidente', (D * fDedAccidente * BN4 * BN5) / k);
  suma('multiregion', (D * BN5 * BN6 * BN7 * BN8 * BN9 * CW2 * BN4) / k);
  suma('vip', (D * BN4 * BN5 * (tables.coef_vip || 0)) / k);
  suma('emergencia_medica_extranjero', (D * (tables.coef_emergencia_ext || 0)) / k);
  suma('enfermedades_graves_extranjero', basica * (tables.coef_enf_graves_ext || 0));
  suma('cobertura_internacional', (D * BN4 * BN5 * BN7 * BN8 * BN9 * DE2) / k);
  suma('ampliacion_servicios', ((D * BN4 * BN5 * BN6 * BN9) / k) * (tables.coef_ampliacion_servicios || 0));
  suma('ayuda_diaria', (D * (tables.coef_ayuda_diaria || 0)) / k);
  // Maternidad, indemnización de enfermedades graves y Xtensuz vienen en cero en el
  // cotizador oficial (columnas CT/DJ y el interruptor de Xtensuz apagado).

  const adicionalesTotal = xround(Object.values(adicionales).reduce((s, v) => s + v, 0), 4);

  return {
    basica,
    adicionales,
    adicionales_total: adicionalesTotal,
    total: xround(basica + adicionalesTotal, 4),
  };
}

export function calculateBxplus(
  input: BxplusQuoteInput,
  people: QuotePerson[],
  tablesRaw: TablaTarifaBx[],
  packageId: string
): BxplusCalculationResult {
  const error = (msg: string): BxplusCalculationResult => ({
    product: 'BXPLUS',
    people_results: [],
    prima_anual_total: 0,
    totals: {} as Record<FormaPago, BxplusPaymentBreakdown>,
    tariff_package_id: packageId,
    error: msg,
  });

  try {
    const tables = cargarTablasBxplus(tablesRaw);
    if (!people || people.length === 0) return error('Agrega al menos un asegurado.');

    const peopleResults = people.map(p => {
      const sexo = (p.gender as GenderType) === 'Femenino' ? 'Mujer' : 'Hombre';
      const det = calcularAseguradoBxplus(Number(p.age), sexo, input, tables);
      return {
        person_id: p.id,
        person_name: p.name,
        age: Number(p.age),
        gender: p.gender as GenderType,
        prima_base: det.basica,
        prima_total: det.total,
        adicionales_detalle: det.adicionales,
        prima_xtensuz: 0,
      };
    });

    const primaAnualTotal = xround(peopleResults.reduce((s, p) => s + p.prima_total, 0), 4);

    // ---- Hoja "Cotizacion" (filas 64-75) ----
    const descuentos = 0;
    const derechoPoliza = xround(Number(tables.gastos_expedicion) || 0, 2);
    const tasaIva = Number.isFinite(Number(tables.iva)) && Number(tables.iva) > 0 && Number(tables.iva) < 1
      ? Number(tables.iva)
      : IVA_DEFAULT;

    const totals = {} as Record<FormaPago, BxplusPaymentBreakdown>;
    const formas: FormaPago[] = ['Anual', 'Semestral', 'Trimestral', 'Mensual'];
    const nombreExcel: Record<FormaPago, string[]> = {
      Anual: ['ANUAL'],
      Semestral: ['SEMESTRAL'],
      Trimestral: ['TRIMESTRAL'],
      Mensual: ['MENSUAL', 'MENSUAL*', 'BIMESTRAL'],
    };

    for (const fp of formas) {
      // Se busca por nombre exacto primero (el Excel trae "MENSUAL*" con asterisco y una
      // fila BIMESTRAL aparte); el orden de las filas no debe decidir la tasa.
      const buscarForma = (nombre: string, exacto: boolean) => (tables.forma_pago || []).find(r => {
        const kf = norm(col(r, 0)).replace(/\*/g, '');
        const n = nombre.toLowerCase();
        return exacto ? kf === n : kf.startsWith(n);
      });
      const filaForma = nombreExcel[fp].map(n => buscarForma(n, true)).find(Boolean)
        ?? nombreExcel[fp].map(n => buscarForma(n, false)).find(Boolean);
      const recargoPct = filaForma ? Number(col(filaForma, 1)) || 0 : 0;
      const numRecibos = filaForma ? Number(col(filaForma, 2)) || 1 : 1;

      const recargo = xround(primaAnualTotal * recargoPct, 4);
      const subtotal = xround(primaAnualTotal - descuentos + recargo + derechoPoliza, 4);
      const iva = xround(tasaIva * subtotal, 4);
      const total = xround(iva + subtotal, 4);

      const primerPago = numRecibos === 1
        ? total
        : xround(((subtotal - derechoPoliza) / numRecibos + derechoPoliza) * (1 + tasaIva), 2);
      const subsecuentes = numRecibos === 1
        ? 0
        : numRecibos === 4 ? (total - primerPago) / 3
        : numRecibos === 12 ? (total - primerPago) / 11
        : numRecibos === 6 ? (total - primerPago) / 5
        : xround(total - primerPago, 2);

      totals[fp] = {
        forma_pago: fp,
        recargo,
        prima_neta: primaAnualTotal,
        gastos_expedicion: derechoPoliza,
        subtotal,
        iva,
        total,
        primer_pago: primerPago,
        pagos_subsecuentes: subsecuentes,
        num_recibos: numRecibos,
      };
    }

    return {
      product: 'BXPLUS',
      people_results: peopleResults,
      prima_anual_total: primaAnualTotal,
      totals,
      tariff_package_id: packageId,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return error(msg || 'Error al calcular BX+');
  }
}

function tablaDe(tablesRaw: TablaTarifaBx[], key: string): FilaTabla[] {
  const t = tablesRaw.find(x => x.table_key === key)?.data_json;
  return Array.isArray(t) ? (t as FilaTabla[]) : [];
}

/** Normaliza las tablas tal como las guarda la función `gmm-upload-tariff`. */
export function cargarTablasBxplus(tablesRaw: TablaTarifaBx[]): BxplusTables {
  const valor = (key: string) => tablesRaw.find(t => t.table_key === key)?.data_json;
  const num = (key: string, def = 0) => {
    const v = Number(valor(key));
    return Number.isFinite(v) && v !== 0 ? v : def;
  };
  return {
    factor_estado: tablaDe(tablesRaw, 'factor_estado'),
    factor_nivel_hospitalario: tablaDe(tablesRaw, 'factor_nivel_hospitalario'),
    factor_tabulador: tablaDe(tablesRaw, 'factor_tabulador'),
    factor_suma_asegurada: tablaDe(tablesRaw, 'factor_suma_asegurada'),
    factor_deducible: tablaDe(tablesRaw, 'factor_deducible'),
    factor_coaseguro: tablaDe(tablesRaw, 'factor_coaseguro'),
    tope_coaseguro: tablaDe(tablesRaw, 'tope_coaseguro'),
    forma_pago: tablaDe(tablesRaw, 'forma_pago'),
    base_intermedia_edad_sexo: tablaDe(tablesRaw, 'base_intermedia_edad_sexo'),
    coef_medicamentos: num('coef_medicamentos'),
    coef_preexistentes: num('coef_preexistentes'),
    coef_complicaciones: num('coef_complicaciones'),
    coef_vip: num('coef_vip'),
    coef_antiguedad: num('coef_antiguedad'),
    coef_emergencia_ext: num('coef_emergencia_ext'),
    coef_enf_graves_ext: num('coef_enf_graves_ext'),
    coef_ayuda_diaria: num('coef_ayuda_diaria'),
    coef_ampliacion_servicios: num('coef_ampliacion_servicios'),
    denominador_cargas: tablaDe(tablesRaw, 'denominador_cargas').map(v => Number(v)),
    deducible_accidente_keys: tablaDe(tablesRaw, 'deducible_accidente_keys'),
    deducible_accidente_factors: tablaDe(tablesRaw, 'deducible_accidente_factors'),
    multiregion_carga_sistema: tablaDe(tablesRaw, 'multiregion_carga_sistema'),
    cobertura_internacional_carga_sistema: tablaDe(tablesRaw, 'cobertura_internacional_carga_sistema'),
    gastos_expedicion: Number(valor('gastos_expedicion')) || 0,
    iva: Number(valor('iva')),
  };
}

/** Opciones del cotizador BX+ tomadas de las tablas cargadas. */
export function opcionesBxplus(tablesRaw: TablaTarifaBx[]) {
  const primeros = (tabla: FilaTabla[]) => tabla.map(r => col(r, 0)).filter(v => v !== null && v !== undefined && v !== '');
  return {
    estados: primeros(tablaDe(tablesRaw, 'factor_estado')).map(String),
    niveles: primeros(tablaDe(tablesRaw, 'factor_nivel_hospitalario')).map(String),
    tabuladores: primeros(tablaDe(tablesRaw, 'factor_tabulador')).map(String),
    sumas_aseguradas: primeros(tablaDe(tablesRaw, 'factor_suma_asegurada')).map(String),
    deducibles: primeros(tablaDe(tablesRaw, 'factor_deducible')).map(String),
    coaseguros: primeros(tablaDe(tablesRaw, 'factor_coaseguro')).map(String),
    topes_coaseguro: tablaDe(tablesRaw, 'tope_coaseguro').map(r => Number(col(r, 1))).filter(Number.isFinite),
  };
}
