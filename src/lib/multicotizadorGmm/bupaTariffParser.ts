/**
 * Lector fiel de los cotizadores Excel de Bupa: Nacional Vital (BNV) y Nacional Plus (BNP).
 *
 * El cotizador real vive en dos hojas:
 *  - `Master`     : parametros y listas (sumas, deducibles, coaseguros, topes, zonas,
 *                   tipo de cliente, derecho de poliza, asistencia en el extranjero).
 *  - `MasterBase` : la tabla de tarifas finales (columnas Llave/PlanName/Region/LowAge/
 *                   Rate/RateType). El motor del Excel hace
 *                   VLOOKUP(PlanCode & Region & Edad[& Sexo], MasterBase!M:R, Rate).
 *
 * Por eso el motor de la app solo tiene que replicar esa llave y esa busqueda: todos los
 * factores (zona, suma, deducible, coaseguro, cargas, seguro dental, sexo) YA vienen
 * horneados dentro de la columna Rate.
 *
 * El parser se guia por los ENCABEZADOS (no por direcciones fijas) para que un Excel
 * nuevo de la aseguradora se lea igual aunque muevan columnas o agreguen renglones.
 */

import * as XLSX from 'xlsx';

export type BupaProduct = 'BNV' | 'BNP';

export interface BupaRate {
  plan_name: string;
  region: string;
  age: number;
  rate: number;
  rate_type: string;
}

export interface BupaZona {
  /** Etiqueta que ve el asesor en el Excel (columna B de Master). */
  label: string;
  /** Nombre de region con el que se construye la llave (columna O de MasterBase). */
  region: string;
  factor: number;
}

export interface BupaEstado {
  estado: string;
  zona: string;
}

export interface BupaClientType {
  label: string;
  /** Sufijo que el Excel agrega al codigo de plan (T / PE / ''). */
  suffix: string;
  factor: number;
}

export interface BupaCatastrofica {
  /** Costo por integrante (I33 = H33 * 5800 en el Excel). */
  costo_por_integrante: number;
  /** Sumas aseguradas (en pesos) con las que aplica la cobertura. */
  sumas_elegibles: number[];
  /** Deducibles (en pesos) con los que aplica la cobertura. */
  deducibles_elegibles: number[];
}

export interface BupaPackageMeta {
  product: BupaProduct;
  /** Prefijo del codigo de plan tal como lo arma el Excel ("NVFS" / "NPS"). */
  plan_prefix: string;
  sumas_aseguradas: number[];   // en millones de pesos
  deducibles: number[];         // en miles de pesos
  coaseguros: number[];         // en porcentaje (0, 5, 10, 20)
  topes_coaseguro: number[];    // en pesos (20000, 30000, 40000)
  zonas: BupaZona[];
  estados: BupaEstado[];
  client_types: BupaClientType[];
  derecho_poliza: number;
  asistencia_extranjero: number;
  catastrofica: BupaCatastrofica;
  /** Maternidad aplica si el deducible es <= este valor (VBA validarMaternidad). */
  maternidad_deducible_max: number;
  max_integrantes: number;
  /** Recargo por pago fraccionado, leído de las formulas de "Datos Asegurado". */
  factores_pago?: { Anual: number; Semestral: number; Trimestral: number; Mensual: number };
  rates_count: number;
}

export interface ParsedBupa {
  meta: BupaPackageMeta;
  rates: BupaRate[];
  errors: string[];
  warnings: string[];
}

const MAX_INTEGRANTES = 8;              // VBA: "El valor maximo de integrantes es 8"
const MATERNIDAD_DEDUCIBLE_MAX = 35000; // VBA validarMaternidad: C29 <= 35000 -> "Si"

// ---------------------------------------------------------------------------
// Utilidades de hoja (coordenadas 1-based, como el usuario las ve en Excel)
// ---------------------------------------------------------------------------

function resolveSheetName(workbook: XLSX.WorkBook, targetName: string): string | null {
  if (workbook.Sheets[targetName]) return targetName;
  const targetLower = targetName.toLowerCase().trim();
  for (const name of workbook.SheetNames) {
    if (name.toLowerCase().trim() === targetLower) return name;
  }
  for (const name of workbook.SheetNames) {
    if (name.toLowerCase().trim().startsWith(targetLower)) return name;
  }
  return null;
}

function cellAt(ws: XLSX.WorkSheet, row: number, col: number): XLSX.CellObject | null {
  return ws[XLSX.utils.encode_cell({ r: row - 1, c: col - 1 })] || null;
}

function valueAt(ws: XLSX.WorkSheet, row: number, col: number): unknown {
  const cell = cellAt(ws, row, col);
  return cell ? cell.v : null;
}

function formulaAt(ws: XLSX.WorkSheet, row: number, col: number): string | null {
  const cell = cellAt(ws, row, col);
  return cell && typeof cell.f === 'string' ? cell.f : null;
}

function textAt(ws: XLSX.WorkSheet, row: number, col: number): string {
  const v = valueAt(ws, row, col);
  return v === null || v === undefined ? '' : String(v).trim();
}

/** Busca un encabezado por texto en las primeras filas de la hoja. */
function findHeader(
  ws: XLSX.WorkSheet,
  names: string[],
  maxRow = 30,
  maxCol = 80
): { row: number; col: number } | null {
  const wanted = names.map(n => n.toLowerCase().trim());
  for (let r = 1; r <= maxRow; r++) {
    for (let c = 1; c <= maxCol; c++) {
      const txt = textAt(ws, r, c).toLowerCase();
      if (!txt) continue;
      if (wanted.some(w => txt === w || txt.startsWith(w))) return { row: r, col: c };
    }
  }
  return null;
}

/** Lee hacia abajo desde `startRow` hasta la primera celda vacia. */
function readDown(ws: XLSX.WorkSheet, startRow: number, col: number, maxRows = 400): unknown[] {
  const out: unknown[] = [];
  for (let r = startRow; r < startRow + maxRows; r++) {
    const v = valueAt(ws, r, col);
    if (v === null || v === undefined || v === '') break;
    out.push(v);
  }
  return out;
}

function toNumber(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const cleaned = v.replace(/[$\s,]/g, '').replace('%', '');
    const n = Number(cleaned);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

/** Numero -> texto como lo concatena el Excel (sin ceros sobrantes). */
function numKey(n: number): string {
  if (Number.isInteger(n)) return String(n);
  return String(Number(n.toFixed(6)));
}

// ---------------------------------------------------------------------------
// Lectura de la hoja Master (parametros y listas)
// ---------------------------------------------------------------------------

function readMaster(ws: XLSX.WorkSheet, product: BupaProduct, warnings: string[]) {
  const zonas: BupaZona[] = [];
  const estados: BupaEstado[] = [];
  const clientTypes: BupaClientType[] = [];
  let derechoPoliza = 1600;
  let sumas: number[] = [];
  let deducibles: number[] = [];
  let coaseguros: number[] = [];
  let topes: number[] = [];

  // Zonas / lugares de residencia: B = etiqueta, C = Zona, D = FD Zona
  const hResidencia = findHeader(ws, ['Lugares de residencia']);
  if (hResidencia) {
    const { row, col } = hResidencia;
    for (let r = row + 1; r < row + 200; r++) {
      const label = textAt(ws, r, col);
      if (!label) break;
      const zonaTxt = textAt(ws, r, col + 1);
      const factor = toNumber(valueAt(ws, r, col + 2));
      if (product === 'BNP') {
        // En BNP la lista es estado -> Zona 1 / Zona 2 (la region se deriva de la zona).
        if (zonaTxt) estados.push({ estado: label, zona: zonaTxt });
      }
      if (zonaTxt) {
        zonas.push({ label, region: zonaTxt, factor: factor ?? 1 });
      }
    }
  }

  // Sumas aseguradas (en pesos) -> millones
  const hSumas = findHeader(ws, ['Sumas aseguradas']);
  if (hSumas) {
    sumas = readDown(ws, hSumas.row + 1, hSumas.col)
      .map(toNumber)
      .filter((n): n is number => n !== null && n > 0)
      .map(n => n / 1_000_000);
  } else {
    warnings.push('Master: no se encontro la lista de Sumas aseguradas');
  }

  // Deducibles (en pesos) -> miles
  const hDed = findHeader(ws, ['Deducibles']);
  if (hDed) {
    deducibles = readDown(ws, hDed.row + 1, hDed.col)
      .map(toNumber)
      .filter((n): n is number => n !== null && n >= 0)
      .map(n => n / 1000);
  } else {
    warnings.push('Master: no se encontro la lista de Deducibles');
  }

  // Coaseguros (0, 0.1, 0.2) -> porcentaje
  const hCoas = findHeader(ws, ['Coasegurado']);
  if (hCoas) {
    coaseguros = readDown(ws, hCoas.row + 1, hCoas.col)
      .map(toNumber)
      .filter((n): n is number => n !== null && n >= 0)
      .map(n => (n > 0 && n <= 1 ? Math.round(n * 100) : Math.round(n)));
  } else {
    warnings.push('Master: no se encontro la lista de Coasegurado');
  }

  // Topes de coaseguro (en pesos) - solo existen cuando hay coaseguro > 0
  const hTope = findHeader(ws, ['Tope coaseguro']);
  if (hTope) {
    topes = readDown(ws, hTope.row + 1, hTope.col)
      .map(toNumber)
      .filter((n): n is number => n !== null && n > 0);
  }

  // Tipos de cliente: I = etiqueta, J = factor
  const hCliente = findHeader(ws, ['Tipo Cliente']);
  if (hCliente) {
    const { row, col } = hCliente;
    for (let r = row + 1; r < row + 10; r++) {
      const label = textAt(ws, r, col);
      if (!label) break;
      const factor = toNumber(valueAt(ws, r, col + 1));
      clientTypes.push({
        label,
        suffix: sufijoDeTipoCliente(label),
        factor: factor ?? 1,
      });
    }
  }

  // Derecho de poliza: encabezado "Administracion"
  const hAdmin = findHeader(ws, ['Administracion']);
  if (hAdmin) {
    const v = toNumber(valueAt(ws, hAdmin.row + 1, hAdmin.col));
    if (v !== null && v > 0) derechoPoliza = v;
  }

  return { zonas, estados, clientTypes, derechoPoliza, sumas, deducibles, coaseguros, topes };
}

/** El Excel marca el tipo de cliente con un sufijo en el codigo de plan. */
export function sufijoDeTipoCliente(label: string): string {
  const l = label.toLowerCase();
  if (l.includes('transfer')) return 'T';
  if (l.includes('periodos de espera')) return 'PE';
  return '';
}

// ---------------------------------------------------------------------------
// Lectura de la hoja MasterBase (tabla de tarifas)
// ---------------------------------------------------------------------------

function readMasterBase(
  ws: XLSX.WorkSheet,
  errors: string[],
  warnings: string[]
): { rates: BupaRate[]; planPrefix: string | null } {
  const rates: BupaRate[] = [];

  const hKey = findHeader(ws, ['Llave de busqueda']);
  const hPlan = findHeader(ws, ['PlanName']);
  const hRegion = findHeader(ws, ['Region']);
  const hAge = findHeader(ws, ['LowAge']);
  const hRate = findHeader(ws, ['Rate']);
  const hType = findHeader(ws, ['RateType']);

  if (!hKey || !hPlan || !hRegion || !hAge || !hRate) {
    errors.push('MasterBase: no se encontraron los encabezados Llave/PlanName/Region/LowAge/Rate');
    return { rates, planPrefix: null };
  }

  const maxRow = ws['!ref'] ? XLSX.utils.decode_range(ws['!ref']).e.r + 1 : 0;
  const planCol = hPlan.col;
  const prefixCount = new Map<string, number>();

  for (let r = hKey.row + 1; r <= maxRow; r++) {
    const plan = textAt(ws, r, planCol);
    if (!plan) continue;
    const age = toNumber(valueAt(ws, r, hAge.col));
    const rate = toNumber(valueAt(ws, r, hRate.col));
    if (age === null || rate === null) continue;

    rates.push({
      plan_name: plan,
      region: textAt(ws, r, hRegion.col),
      age,
      rate,
      rate_type: hType ? textAt(ws, r, hType.col) || 'Unisex' : 'Unisex',
    });

    const m = /^([A-Z]+)/.exec(plan);
    if (m) prefixCount.set(m[1], (prefixCount.get(m[1]) ?? 0) + 1);
  }

  if (rates.length === 0) {
    errors.push('MasterBase: la tabla de tarifas esta vacia');
    return { rates, planPrefix: null };
  }

  // El prefijo del producto sale del propio Excel (F4 en BNV, E4 en BNP:
  // CONCATENATE("NVFS", ...) / CONCATENATE("NPS", ...)); si no, el mas frecuente.
  let planPrefix: string | null = null;
  for (const c of [6, 5, 3, 4, 7]) {
    const f = formulaAt(ws, 4, c);
    if (!f) continue;
    const lit = /CONCATENATE\("([A-Z]+)"/i.exec(f) || /"([A-Z]{2,6})"/.exec(f);
    if (lit) { planPrefix = lit[1].toUpperCase(); break; }
  }
  if (!planPrefix) {
    const sorted = [...prefixCount.entries()].sort((a, b) => b[1] - a[1]);
    planPrefix = sorted.length > 0 ? sorted[0][0] : null;
    warnings.push('MasterBase: no se pudo leer el prefijo del codigo de plan del Excel; se uso el mas frecuente');
  }

  return { rates, planPrefix };
}

// ---------------------------------------------------------------------------
// Reglas del cotizador que viven en formulas de "Datos Asegurado"
// ---------------------------------------------------------------------------

function readDatosAseguradoRules(ws: XLSX.WorkSheet, warnings: string[]) {
  let asistencia = 1632;
  const factores_pago = { Anual: 1, Semestral: 1.045, Trimestral: 1.075, Mensual: 1.09 };
  const catastrofica: BupaCatastrofica = {
    costo_por_integrante: 5800,
    sumas_elegibles: [20_000_000, 50_000_000],
    deducibles_elegibles: [35_000, 55_000, 75_000, 115_000, 200_000],
  };

  const maxRow = ws['!ref'] ? XLSX.utils.decode_range(ws['!ref']).e.r + 1 : 0;
  const maxCol = ws['!ref'] ? XLSX.utils.decode_range(ws['!ref']).e.c + 1 : 0;

  for (let r = 1; r <= maxRow; r++) {
    for (let c = 1; c <= maxCol; c++) {
      const f = formulaAt(ws, r, c);
      if (!f) continue;

      // Asistencia en el extranjero: IF($E$32="Si",1632,0)
      const asis = /asistencia/i.test(textAt(ws, r, 1) + textAt(ws, r, 2) + textAt(ws, r, 3));
      if (asis && /1632|1,632/.test(f)) {
        const n = toNumber(/\b(\d{3,6})\b/.exec(f.replace(/[^0-9,]/g, ' '))?.[1] ?? null);
        if (n) asistencia = n;
      }

      // Costo de la catastrofica: H33*5800 / I33 = ...
      const mCat = /^=?H33\*(\d+)/.exec(f.replace(/\s/g, ''));
      if (mCat) catastrofica.costo_por_integrante = Number(mCat[1]);

      // Elegibilidad: AND(OR(C27=20000000,C27=50000000),OR(C29=35000,...))
      if (/C27=/.test(f) && /C29=/.test(f)) {
        const sumas = [...f.matchAll(/C27=(\d+)/g)].map(m => Number(m[1]));
        const deds = [...f.matchAll(/C29=(\d+)/g)].map(m => Number(m[1]));
        if (sumas.length) catastrofica.sumas_elegibles = [...new Set(sumas)];
        if (deds.length) catastrofica.deducibles_elegibles = [...new Set(deds)];
      }
    }

    // Recargos por forma de pago: la fila "Prima del asegurado titular" trae en las
    // columnas D/E/F el factor aplicado (x1.045, x1.075, x1.09).
    const etiqueta = (textAt(ws, r, 1) + textAt(ws, r, 2) + textAt(ws, r, 3)).toLowerCase();
    if (etiqueta.includes('prima del asegurado titular')) {
      const fSem = formulaAt(ws, r, 4) || '';
      const fTri = formulaAt(ws, r, 5) || '';
      const fMen = formulaAt(ws, r, 6) || '';
      factores_pago.Semestral = factorDeFormula(fSem) ?? factores_pago.Semestral;
      factores_pago.Trimestral = factorDeFormula(fTri) ?? factores_pago.Trimestral;
      factores_pago.Mensual = factorDeFormula(fMen) ?? factores_pago.Mensual;
    }
  }

  if (asistencia !== 1632) {
    warnings.push(`Asistencia en el extranjero leida del Excel: ${asistencia}`);
  }
  return { asistencia, catastrofica, factores_pago };
}

/** Saca el multiplicador de una formula de pago fraccionado: "*1.045" o "*(1+4.5%)". */
function factorDeFormula(formula: string): number | null {
  if (!formula) return null;
  const pct = /\(?\s*1\s*\+\s*(\d+(?:\.\d+)?)\s*%\s*\)?/.exec(formula);
  if (pct) return 1 + Number(pct[1]) / 100;
  const soloPct = /(\d+(?:\.\d+)?)\s*%/.exec(formula);
  if (soloPct) return 1 + Number(soloPct[1]) / 100;
  const mult = /[*)]([01]\.\d+)/.exec(formula);
  if (mult) return Number(mult[1]);
  return null;
}

// ---------------------------------------------------------------------------
// Entrada principal
// ---------------------------------------------------------------------------

export function parseBupaWorkbook(workbook: XLSX.WorkBook, product: BupaProduct): ParsedBupa {
  const errors: string[] = [];
  const warnings: string[] = [];

  const masterName = resolveSheetName(workbook, 'Master');
  const masterBaseName = resolveSheetName(workbook, 'MasterBase');
  const datosName = resolveSheetName(workbook, 'Datos Asegurado');

  if (!masterBaseName) {
    throw new Error(
      `No se encontro la hoja "MasterBase" (la tabla de tarifas). Hojas disponibles: [${workbook.SheetNames.join(', ')}]`
    );
  }

  const master = masterName ? readMaster(workbook.Sheets[masterName], product, warnings) : null;
  if (!masterName) errors.push('No se encontro la hoja "Master" (parametros del cotizador)');

  const { rates, planPrefix } = readMasterBase(workbook.Sheets[masterBaseName], errors, warnings);
  if (!planPrefix) errors.push('No se pudo determinar el prefijo del codigo de plan (NVFS / NPS)');

  const rules = datosName
    ? readDatosAseguradoRules(workbook.Sheets[datosName], warnings)
    : {
        asistencia: 1632,
        catastrofica: { costo_por_integrante: 5800, sumas_elegibles: [], deducibles_elegibles: [] },
        factores_pago: { Anual: 1, Semestral: 1.045, Trimestral: 1.075, Mensual: 1.09 },
      };

  // Las listas de opciones se derivan de los codigos de plan REALES de la tabla:
  // es la unica fuente que no miente (el Excel tiene deducibles en la tabla que no
  // estan en la lista de la hoja Master, y al reves).
  const { sumas, deducibles, coaseguros, topes } = opcionesDesdeCodigos(rates, planPrefix);

  const meta: BupaPackageMeta = {
    product,
    plan_prefix: planPrefix ?? '',
    sumas_aseguradas: sumas,
    deducibles,
    coaseguros,
    topes_coaseguro: topes,
    zonas: master?.zonas ?? [],
    estados: master?.estados ?? [],
    client_types: master?.clientTypes ?? [],
    derecho_poliza: master?.derechoPoliza ?? 1600,
    asistencia_extranjero: rules.asistencia,
    catastrofica: rules.catastrofica,
    maternidad_deducible_max: MATERNIDAD_DEDUCIBLE_MAX,
    max_integrantes: MAX_INTEGRANTES,
    factores_pago: rules.factores_pago,
    rates_count: rates.length,
  };

  if (meta.sumas_aseguradas.length === 0) errors.push('No se pudo derivar ninguna suma asegurada de la tabla de tarifas');
  if (meta.deducibles.length === 0) errors.push('No se pudo derivar ningun deducible de la tabla de tarifas');

  return { meta, rates, errors, warnings };
}

/** Deriva sumas / deducibles / coaseguros / topes de los codigos de plan de la tabla. */
export function opcionesDesdeCodigos(rates: BupaRate[], planPrefix: string | null) {
  const sumas = new Set<number>();
  const deducibles = new Set<number>();
  const coaseguros = new Set<number>();
  const topes = new Set<number>();
  const re = planPrefix
    ? new RegExp(`^${planPrefix}(\\d+(?:\\.\\d+)?)D(\\d+(?:\\.\\d+)?)C(\\d+)(?:TC(\\d+))?$`)
    : /^([A-Z]+)(\d+(?:\.\d+)?)D(\d+(?:\.\d+)?)C(\d+)(?:TC(\d+))?$/;

  for (const r of rates) {
    const m = re.exec(r.plan_name);
    if (!m) continue;
    const offset = planPrefix ? 0 : 1;
    const sa = Number(m[1 + offset]);
    const ded = Number(m[2 + offset]);
    const coas = Number(m[3 + offset]);
    const tope = m[4 + offset];
    if (Number.isFinite(sa)) sumas.add(sa);
    if (Number.isFinite(ded)) deducibles.add(ded);
    if (Number.isFinite(coas)) coaseguros.add(coas);
    if (tope !== undefined && tope !== null && tope !== '') topes.add(Number(tope));
  }

  const asc = (a: number, b: number) => a - b;
  return {
    sumas: [...sumas].sort(asc),
    deducibles: [...deducibles].sort(asc),
    coaseguros: [...coaseguros].sort(asc),
    topes: [...topes].sort(asc).map(k => k * 1000), // a pesos
  };
}

/** Utilidad compartida con los motores: extrae el codigo de plan del nombre guardado. */
export function planCodeDe(planName: string, prefix?: string): string {
  const re = prefix
    ? new RegExp(`^(${prefix}\\d+(?:\\.\\d+)?D\\d+(?:\\.\\d+)?C\\d+(?:TC\\d+)?)`)
    : /^([A-Z]+\d+(?:\.\d+)?D\d+(?:\.\d+)?C\d+(?:TC\d+)?)/;
  const m = re.exec(planName);
  return m ? m[1] : planName;
}

export { numKey };
