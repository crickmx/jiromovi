/**
 * Lector del cotizador BX+ (Únikuz) — hoja "Tarifa".
 *
 * Sin dependencias a propósito: la misma pieza se usa desde la función edge
 * (`gmm-upload-tariff`, Deno con `npm:xlsx`) y desde el verificador local (Node con
 * `xlsx`), así que aquí sólo se manejan direcciones A1 y el workbook ya leído.
 *
 * Los rangos de abajo son los del archivo 2024. El archivo de junio 2026 recorre todas
 * las columnas +2 porque inserta dos columnas nuevas (la prima 2025 y la prima 2026).
 * Por eso el lector detecta el desplazamiento con la etiqueta "Factor Region" y aplica
 * el mismo rango corrido: un Excel nuevo se carga sin tocar código.
 *
 * Dos excepciones que no se resuelven con el desplazamiento:
 *   1. La tabla base. En 2026 hay dos bloques de prima ("2025 anterior" y "2026 actual");
 *      se toma el último, leyendo la edad de su propia columna.
 *   2. "Tope Coaseguro" sube un renglón en 2026. Se lee por etiqueta.
 *
 * Convención: las filas se numeran 1-based (como en Excel) y las columnas 0-based.
 */

export type TipoRango = 'table' | 'value' | 'array' | 'formula_rate';

export interface RangoExcel {
  sheet: string;
  range: string;
  type: TipoRango;
}

/** Rangos del layout 2024. */
export const RANGOS_BXPLUS: Record<string, RangoExcel> = {
  factor_estado: { sheet: 'Tarifa', range: 'W4:Z38', type: 'table' },
  factor_nivel_hospitalario: { sheet: 'Tarifa', range: 'AA4:AB6', type: 'table' },
  factor_tabulador: { sheet: 'Tarifa', range: 'AA11:AB16', type: 'table' },
  factor_suma_asegurada: { sheet: 'Tarifa', range: 'N4:O9', type: 'table' },
  factor_deducible: { sheet: 'Tarifa', range: 'Q4:R14', type: 'table' },
  factor_coaseguro: { sheet: 'Tarifa', range: 'T4:U8', type: 'table' },
  // El rango es sólo referencia: se lee por la etiqueta "Tope Coaseguro" porque en 2026
  // la tabla sube un renglón (T13:U17 → V12:W16).
  tope_coaseguro: { sheet: 'Tarifa', range: 'T13:U17', type: 'table' },
  forma_pago: { sheet: 'Tarifa', range: 'BL31:BN35', type: 'table' },
  base_intermedia_edad_sexo: { sheet: 'Tarifa', range: 'C3:E110', type: 'table' },
  coef_medicamentos: { sheet: 'Tarifa', range: 'AJ3', type: 'value' },
  coef_preexistentes: { sheet: 'Tarifa', range: 'AJ7', type: 'value' },
  coef_complicaciones: { sheet: 'Tarifa', range: 'AJ11', type: 'value' },
  coef_vip: { sheet: 'Tarifa', range: 'BI3', type: 'value' },
  coef_antiguedad: { sheet: 'Tarifa', range: 'BI7', type: 'value' },
  coef_emergencia_ext: { sheet: 'Tarifa', range: 'AW3', type: 'value' },
  coef_enf_graves_ext: { sheet: 'Tarifa', range: 'AW7', type: 'value' },
  coef_ayuda_diaria: { sheet: 'Tarifa', range: 'BC3', type: 'value' },
  coef_ampliacion_servicios: { sheet: 'Tarifa', range: 'BC7', type: 'value' },
  denominador_cargas: { sheet: 'Tarifa', range: 'L4:L6', type: 'array' },
  deducible_accidente_keys: { sheet: 'Tarifa', range: 'AU15:AU23', type: 'array' },
  deducible_accidente_factors: { sheet: 'Tarifa', range: 'AW15:AW23', type: 'array' },
  multiregion_carga_sistema: { sheet: 'Tarifa', range: 'AQ42:AS74', type: 'table' },
  cobertura_internacional_carga_sistema: { sheet: 'Tarifa', range: 'AY42:BA76', type: 'table' },
  maternidad_tasa_por_edad: { sheet: 'Tarifa', range: 'AN18:AO68', type: 'table' },
  maternidad_threshold: { sheet: 'Tarifa', range: 'CU2', type: 'value' },
  indemnizacion_eg_tabla: { sheet: 'Tarifa', range: 'BE3:BG50', type: 'table' },
  indemnizacion_eg_monto: { sheet: 'Tarifa', range: 'DK2', type: 'value' },
  xtensuz_factor: { sheet: 'Tarifa', range: 'AJ15:AK18', type: 'table' },
  gastos_expedicion: { sheet: 'Cotizacion', range: 'O67', type: 'value' },
  // OJO: en O69 el Excel tiene el IMPORTE del IVA (=0.16*O68), no la tasa. La tasa se lee
  // de la propia fórmula; si no se puede, queda 0.16.
  iva: { sheet: 'Cotizacion', range: 'O69', type: 'formula_rate' },
};

const ETIQUETA_TOPE = 'tope coaseguro';
const ETIQUETA_REGION = 'factor region';
const ETIQUETA_SUMA = 'factor suma asegurada';
const ETIQUETA_PRIMA = 'prima de riesgo';

// ---------------------------------------------------------------------------
// Direcciones A1 (sin librería)
// ---------------------------------------------------------------------------

export interface Celda { r: number; c: number }

export function decodeCol(letras: string): number {
  let n = 0;
  for (const ch of letras.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

export function encodeCol(n: number): string {
  let s = '';
  let x = n + 1;
  while (x > 0) {
    const rem = (x - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    x = Math.floor((x - 1) / 26);
  }
  return s;
}

export function encodeCell(celda: Celda): string {
  return `${encodeCol(celda.c)}${celda.r + 1}`;
}

export function decodeRange(rango: string): { s: Celda; e: Celda } {
  const m = /^\$?([A-Z]+)\$?(\d+)(?::\$?([A-Z]+)\$?(\d+))?$/i.exec(rango.trim());
  if (!m) throw new Error(`Rango inválido: ${rango}`);
  const s = { r: Number(m[2]) - 1, c: decodeCol(m[1]) };
  const e = m[3] ? { r: Number(m[4]) - 1, c: decodeCol(m[3]) } : { ...s };
  return { s, e };
}

// ---------------------------------------------------------------------------
// Detección del layout
// ---------------------------------------------------------------------------

export interface LayoutBxplus {
  /** Texto legible de cómo se detectó el archivo. */
  etiqueta: string;
  /** Columnas que se recorrió el layout respecto al 2024. */
  desplazamiento: number;
  base: {
    colEdad: string;
    colPrima: string;
    /** Fila 1-based del encabezado ("Edad"). */
    filaEncabezado: number;
    /** Fila 1-based de la primera fila de datos. */
    filaInicio: number;
    /** Fila 1-based de la última fila con prima. */
    filaFin: number;
    bloques: number;
  };
  /** Columnas del generador de tarifa (para verificaciones). */
  generador: {
    colEdad: string;
    colHombre: string;
    colMujer: string;
    colAdicHombre: string;
    colAdicMujer: string;
  };
  avisos: string[];
}

export interface TablaExtraida {
  table_key: string;
  data_json: unknown;
  row_count: number | null;
}

export interface ResultadoLectura {
  layout: LayoutBxplus;
  tablas: TablaExtraida[];
  errores: string[];
}

const norm = (v: unknown): string =>
  String(v ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

type Workbook = { Sheets: Record<string, Record<string, any>>; SheetNames: string[] };

export function resolveSheetName(workbook: Workbook, objetivo: string): string | null {
  if (workbook.Sheets[objetivo]) return objetivo;
  const buscado = norm(objetivo);
  for (const nombre of workbook.SheetNames) {
    if (norm(nombre) === buscado) return nombre;
  }
  for (const nombre of workbook.SheetNames) {
    if (norm(nombre).startsWith(buscado)) return nombre;
  }
  return null;
}

const celda = (hoja: Record<string, any>, r: number, c: number) => hoja[encodeCell({ r, c })];

/** Busca en la fila `fila` (1-based) la primera columna cuya etiqueta coincida. */
function buscarEtiquetaEnFila(
  hoja: Record<string, any>,
  fila: number,
  coincide: (texto: string) => boolean,
  maxCols = 200,
): number {
  for (let c = 0; c < maxCols; c++) {
    const v = celda(hoja, fila - 1, c)?.v;
    if (v !== undefined && v !== null && coincide(norm(v))) return c;
  }
  return -1;
}

/** Busca en la columna `col` (0-based) la primera fila cuya etiqueta coincida. */
function buscarEtiquetaEnColumna(
  hoja: Record<string, any>,
  col: number,
  desde: number,
  hasta: number,
  coincide: (texto: string) => boolean,
): number {
  for (let r = desde; r <= hasta; r++) {
    const v = celda(hoja, r - 1, col)?.v;
    if (v !== undefined && v !== null && coincide(norm(v))) return r;
  }
  return -1;
}

function ultimaFilaNumerica(hoja: Record<string, any>, col: number, desde: number, hasta = 400): number {
  let ultima = desde;
  for (let r = desde; r <= hasta; r++) {
    const v = celda(hoja, r - 1, col)?.v;
    if (typeof v === 'number' && Number.isFinite(v)) ultima = r;
  }
  return ultima;
}

export function detectarLayout(workbook: Workbook): LayoutBxplus {
  const nombre = resolveSheetName(workbook, 'Tarifa');
  if (!nombre) throw new Error(`Hoja "Tarifa" no encontrada. Hojas disponibles: [${workbook.SheetNames.join(', ')}]`);
  const hoja = workbook.Sheets[nombre];
  const avisos: string[] = [];

  // --- desplazamiento: "Factor Region" está en W2 en 2024 y en Y2 en 2026 ---
  const colRegion = buscarEtiquetaEnFila(hoja, 2, t => t === ETIQUETA_REGION);
  let desplazamiento = 0;
  if (colRegion >= 0) {
    desplazamiento = colRegion - decodeCol('W');
  } else {
    const colSuma = buscarEtiquetaEnFila(hoja, 2, t => t === ETIQUETA_SUMA);
    if (colSuma >= 0) {
      desplazamiento = colSuma - decodeCol('N');
      avisos.push('No se encontró "Factor Region"; el desplazamiento se calculó con "Factor Suma Asegurada".');
    } else {
      avisos.push('No se pudo detectar el desplazamiento de columnas; se asume el layout 2024.');
    }
  }

  // --- tabla base: uno o dos bloques de prima ---
  const bloques: number[] = [];
  for (let c = 0; c < 200; c++) {
    const v = celda(hoja, 1, c)?.v;
    if (v !== undefined && v !== null && norm(v).startsWith(ETIQUETA_PRIMA)) bloques.push(c);
  }
  if (bloques.length === 0) {
    throw new Error('No se encontró la etiqueta "Prima de Riesgo" en la fila 2 de la hoja Tarifa.');
  }
  const colPrima = bloques[bloques.length - 1];
  if (bloques.length > 1) {
    avisos.push(`El archivo trae ${bloques.length} bloques de prima; se usa el último (${encodeCol(colPrima)}2).`);
  }

  // La edad puede estar en la columna del propio bloque (2024: "Edad" en C3) o a su
  // izquierda (2026: "Hombre" en F3 y la edad en C3). Si la celda del bloque es "Edad",
  // las primas empiezan una columna a la derecha.
  const filaEncabezado = 3;
  let colEdad = colPrima;
  let colPrimaReal = colPrima;
  if (norm(celda(hoja, filaEncabezado - 1, colPrima)?.v) === 'edad') {
    colPrimaReal = colPrima + 1;
  } else {
    for (let c = colPrima; c >= 0; c--) {
      if (norm(celda(hoja, filaEncabezado - 1, c)?.v) === 'edad') {
        colEdad = c;
        break;
      }
    }
  }

  const filaFin = ultimaFilaNumerica(hoja, colEdad, filaEncabezado + 1);

  // --- generador de tarifa (columnas de comparación) ---
  // "EDAD" aparece varias veces en la fila 3; la del generador es la ÚLTIMA.
  let colGenEdad = -1;
  for (let c = 0; c < 200; c++) {
    if (norm(celda(hoja, 2, c)?.v) === 'edad') colGenEdad = c;
  }
  const colGenAdic = buscarEtiquetaEnFila(hoja, 4, t => t === 'total adicionales');

  const generador = {
    colEdad: encodeCol(colGenEdad >= 0 ? colGenEdad : decodeCol('CG')),
    colHombre: encodeCol(colGenEdad >= 0 ? colGenEdad + 1 : decodeCol('CH')),
    colMujer: encodeCol(colGenEdad >= 0 ? colGenEdad + 2 : decodeCol('CI')),
    colAdicHombre: encodeCol(colGenAdic >= 0 ? colGenAdic : decodeCol('BV')),
    colAdicMujer: encodeCol(colGenAdic >= 0 ? colGenAdic + 1 : decodeCol('BW')),
  };

  return {
    etiqueta: `${bloques.length > 1 ? 'dos bloques de prima' : 'un bloque de prima'}, desplazamiento ${desplazamiento >= 0 ? '+' : ''}${desplazamiento}`,
    desplazamiento,
    base: {
      colEdad: encodeCol(colEdad),
      colPrima: encodeCol(colPrimaReal),
      filaEncabezado,
      filaInicio: filaEncabezado + 1,
      filaFin,
      bloques: bloques.length,
    },
    generador,
    avisos,
  };
}

// ---------------------------------------------------------------------------
// Extracción
// ---------------------------------------------------------------------------

function correrRango(rango: string, desplazamiento: number): string {
  const { s, e } = decodeRange(rango);
  const s2 = encodeCol(s.c + desplazamiento);
  const e2 = encodeCol(e.c + desplazamiento);
  return s.r === e.r && s.c === e.c ? `${s2}${s.r + 1}` : `${s2}${s.r + 1}:${e2}${e.r + 1}`;
}

function leerRango(hoja: Record<string, any>, rango: string, tipo: TipoRango): unknown {
  if (tipo === 'value') {
    const v = hoja[rango]?.v;
    return v === undefined ? null : v;
  }
  const { s, e } = decodeRange(rango);
  if (tipo === 'array') {
    const salida: unknown[] = [];
    for (let r = s.r; r <= e.r; r++) {
      const v = celda(hoja, r, s.c)?.v;
      salida.push(v === undefined ? null : v);
    }
    return salida;
  }
  if (tipo === 'table') {
    const filas: Record<string, unknown>[] = [];
    for (let r = s.r; r <= e.r; r++) {
      const fila: Record<string, unknown> = {};
      for (let c = s.c; c <= e.c; c++) {
        const v = celda(hoja, r, c)?.v;
        fila[`col_${c - s.c}`] = v === undefined ? null : v;
      }
      filas.push(fila);
    }
    return filas;
  }
  return null;
}

function leerTopeCoaseguro(hoja: Record<string, any>, desplazamiento: number): unknown {
  const col = decodeCol('T') + desplazamiento;
  const filaEtiqueta = buscarEtiquetaEnColumna(hoja, col, 6, 20, t => t === ETIQUETA_TOPE);
  if (filaEtiqueta < 0) throw new Error('No se encontró la etiqueta "Tope Coaseguro"');
  const filas: Record<string, unknown>[] = [];
  for (let i = 2; i <= 6; i++) {
    const r = filaEtiqueta + i - 1; // 0-based
    filas.push({
      col_0: celda(hoja, r, col)?.v ?? null,
      col_1: celda(hoja, r, col + 1)?.v ?? null,
    });
  }
  return filas;
}

function leerTablaBase(hoja: Record<string, any>, layout: LayoutBxplus): unknown {
  const colEdad = decodeCol(layout.base.colEdad);
  const colPrima = decodeCol(layout.base.colPrima);
  const filas: Record<string, unknown>[] = [];
  for (let r = layout.base.filaEncabezado; r <= layout.base.filaFin; r++) {
    filas.push({
      col_0: celda(hoja, r - 1, colEdad)?.v ?? null,
      col_1: celda(hoja, r - 1, colPrima)?.v ?? null,
      col_2: celda(hoja, r - 1, colPrima + 1)?.v ?? null,
    });
  }
  return filas;
}

function parseTasaIva(hoja: Record<string, any>, rango: string): number {
  const formula = hoja[rango]?.f;
  if (typeof formula === 'string') {
    const m = /(\d+(?:\.\d+)?)\s*\*/.exec(formula);
    const tasa = m ? Number(m[1]) : NaN;
    if (Number.isFinite(tasa) && tasa > 0 && tasa < 1) return tasa;
  }
  return 0.16;
}

/**
 * Extrae todas las tablas del cotizador BX+ aplicando el desplazamiento detectado.
 * Las tablas que fallan se reportan en `errores` sin abortar el resto.
 */
export function extraerTablasBxplus(workbook: Workbook): ResultadoLectura {
  const layout = detectarLayout(workbook);
  const nombreTarifa = resolveSheetName(workbook, 'Tarifa')!;
  const nombreCotizacion = resolveSheetName(workbook, 'Cotizacion');
  const hojaTarifa = workbook.Sheets[nombreTarifa];
  const hojaCotizacion = nombreCotizacion ? workbook.Sheets[nombreCotizacion] : null;

  const tablas: TablaExtraida[] = [];
  const errores: string[] = [];

  for (const [tableKey, def] of Object.entries(RANGOS_BXPLUS)) {
    try {
      let dato: unknown;
      if (tableKey === 'base_intermedia_edad_sexo') {
        dato = leerTablaBase(hojaTarifa, layout);
      } else if (tableKey === 'tope_coaseguro') {
        dato = leerTopeCoaseguro(hojaTarifa, layout.desplazamiento);
      } else if (def.type === 'formula_rate') {
        if (!hojaCotizacion) throw new Error(`Hoja "${def.sheet}" no encontrada`);
        dato = parseTasaIva(hojaCotizacion, def.range);
      } else {
        const hoja = def.sheet === 'Cotizacion' ? hojaCotizacion : hojaTarifa;
        if (!hoja) throw new Error(`Hoja "${def.sheet}" no encontrada`);
        const rango = def.sheet === 'Tarifa' ? correrRango(def.range, layout.desplazamiento) : def.range;
        dato = leerRango(hoja, rango, def.type);
      }
      const limpio = dato === null || dato === undefined ? (def.type === 'value' ? null : []) : dato;
      tablas.push({
        table_key: tableKey,
        data_json: def.type === 'value' && limpio === null ? { value: null } : limpio,
        row_count: Array.isArray(limpio) ? limpio.length : null,
      });
    } catch (error) {
      errores.push(`${tableKey}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return { layout, tablas, errores };
}
