/**
 * Piezas compartidas por los motores de Bupa Nacional Vital (BNV) y Nacional Plus (BNP).
 *
 * Los dos cotizadores del Excel tienen exactamente la misma mecanica:
 *   1. Buscar la prima de cada asegurado en la tabla `MasterBase`
 *      (llave = CodigoPlan + Region + Edad [+ Sexo en BNP]) -> columna Rate.
 *   2. Sumar las primas + Asistencia en el extranjero (+ Catastrofica en BNP).
 *   3. Aplicar el recargo por forma de pago (1.045 / 1.075 / 1.09).
 *   4. Sumar Derecho de poliza e IVA (16%).
 *   5. Repartir en recibos: el Derecho de poliza se cobra COMPLETO en el primer recibo.
 */

import type { FormaPago, QuotePerson, GenderType } from './types';

export const IVA_RATE = 0.16;

export interface BupaRateRecord {
  plan_name: string;
  region: string;
  age: number;
  rate: number;
  rate_type: string;
}

/** Bupa (BNV y BNP) no ofrece pago bimestral: su Excel sólo trae anual, semestral,
 *  trimestral y mensual. Bimestral existe en el tipo compartido porque Únikuz Bx+ sí la maneja. */
export type FormaPagoBupa = Exclude<FormaPago, 'Bimestral'>;

/** Recargo por pago fraccionado. El Excel lo trae dentro de las formulas de "Datos Asegurado". */
export type FactoresPago = Record<FormaPagoBupa, number>;

export const FACTORES_PAGO_DEFAULT: FactoresPago = {
  Anual: 1,
  Semestral: 1.045,
  Trimestral: 1.075,
  Mensual: 1.09,
};

export const NUM_RECIBOS: Record<FormaPago, number> = {
  Anual: 1,
  Semestral: 2,
  Trimestral: 4,
  Bimestral: 6,
  Mensual: 12,
};

export const FORMAS_PAGO: FormaPagoBupa[] = ['Anual', 'Semestral', 'Trimestral', 'Mensual'];

export interface PagoDesglose {
  forma_pago: FormaPago;
  factor: number;
  prima_neta: number;
  asistencia_extranjero: number;
  catastrofica_extranjero: number;
  derecho_poliza: number;
  subtotal: number;
  iva: number;
  total: number;
  primer_pago: number;
  pagos_subsecuentes: number;
  num_recibos: number;
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Numero -> texto igual que lo concatena el Excel (sin decimales sobrantes). */
export function numKey(n: number): string {
  if (Number.isInteger(n)) return String(n);
  return String(Number(n.toFixed(6)));
}

/**
 * Indice de la tabla de tarifas. La llave replica la del Excel:
 *   VLOOKUP(CONCATENATE(CodigoPlan, Region, Edad[, Sexo]), MasterBase, Rate)
 * Acepta tanto el formato nuevo (PlanName = codigo limpio) como el viejo
 * (PlanName = llave completa "NVFS3D100C10TC30Mexico Region 2 ...74").
 */
export function buildRateIndex(
  rates: BupaRateRecord[],
  prefix: string | undefined,
  product: 'BNV' | 'BNP'
): Map<string, number> {
  const index = new Map<string, number>();
  const re = prefix
    ? new RegExp(`^(${prefix}\\d+(?:\\.\\d+)?D\\d+(?:\\.\\d+)?C\\d+(?:TC\\d+)?)`)
    : /^([A-Z]+\d+(?:\.\d+)?D\d+(?:\.\d+)?C\d+(?:TC\d+)?)/;

  for (const r of rates) {
    const m = re.exec(String(r.plan_name ?? ''));
    if (!m) continue;
    const code = m[1];
    const age = Number(r.age);
    if (!Number.isFinite(age)) continue;
    const rateType = product === 'BNP' ? String(r.rate_type || 'Unisex') : 'Unisex';
    index.set(`${code}|${String(r.region ?? '')}|${age}|${rateType}`, Number(r.rate));
  }
  return index;
}

/** Busqueda exacta, como el VLOOKUP(...,FALSE) del Excel: si no esta, no hay prima. */
export function lookupRate(
  index: Map<string, number>,
  code: string,
  region: string,
  age: number,
  rateType: string
): number | null {
  const direct = index.get(`${code}|${region}|${age}|${rateType}`);
  if (direct !== undefined) return direct;
  // Tolerancia de formato en la region (BNP guarda "Mexico Region 1" a secas).
  for (const [k, v] of index) {
    const parts = k.split('|');
    if (parts[0] === code && parts[2] === String(age) && parts[3] === rateType) {
      const regionOk = parts[1].toLowerCase().startsWith(region.toLowerCase()) ||
        region.toLowerCase().startsWith(parts[1].toLowerCase());
      if (regionOk) return v;
    }
  }
  return null;
}

export function generoDe(p: QuotePerson): GenderType {
  return (p.gender as GenderType) === 'Femenino' ? 'Femenino' : 'Masculino';
}

export function sexoExcel(p: QuotePerson): 'Male' | 'Female' {
  return generoDe(p) === 'Femenino' ? 'Female' : 'Male';
}

export interface EntradaPagos {
  /** Prima del periodo ya con el factor de forma de pago aplicado (incluye asistencia y catastrofica). */
  primaPeriodo: number;
  derechoPoliza: number;
  asistenciaExtranjero: number;
  catastroficaExtranjero: number;
  /** Importe extra que el Excel suma SOLO a la linea "Costo total" (doble conteo de la catastrofica). */
  extraEnCostoTotal: number;
}

/**
 * Reparte una prima anual entre las cuatro formas de pago, replicando las formulas
 * de "Datos Asegurado" (filas 43-54 en BNV / 41-53 en BNP):
 *   IVA           = (Total Prima + Derecho de poliza) * 16%
 *   Costo total   = Total Prima + Descuento + Derecho + IVA
 *   Primer pago   = (Total Prima / n + Derecho) * 1.16     (anual: el total completo)
 *   Subsecuentes  = (Total Prima / n) * 1.16
 */
export function calcularPagos(
  entrada: EntradaPagos,
  factores: FactoresPago
): Partial<Record<FormaPago, PagoDesglose>> {
  const { primaPeriodo, derechoPoliza, asistenciaExtranjero, catastroficaExtranjero, extraEnCostoTotal } = entrada;
  const out: Partial<Record<FormaPago, PagoDesglose>> = {};

  for (const fp of FORMAS_PAGO) {
    const factor = factores[fp] ?? FACTORES_PAGO_DEFAULT[fp];
    const n = NUM_RECIBOS[fp];
    const primaNeta = round2(primaPeriodo * factor);
    const subtotal = round2(primaNeta + derechoPoliza);
    const iva = round2(subtotal * IVA_RATE);
    const total = round2(subtotal + iva + extraEnCostoTotal);
    const primerPago = n === 1 ? total : round2((primaNeta / n + derechoPoliza) * (1 + IVA_RATE));
    const subsecuentes = n === 1 ? 0 : round2((primaNeta / n) * (1 + IVA_RATE));

    out[fp] = {
      forma_pago: fp,
      factor,
      prima_neta: primaNeta,
      asistencia_extranjero: round2(asistenciaExtranjero * factor),
      catastrofica_extranjero: round2(catastroficaExtranjero * factor),
      derecho_poliza: derechoPoliza,
      subtotal,
      iva,
      total,
      primer_pago: primerPago,
      pagos_subsecuentes: subsecuentes,
      num_recibos: n,
    };
  }
  return out;
}

/**
 * Zona del cotizador -> nombre de region con el que se construye la llave.
 * En el Excel: IF(C11="Zona 1: ...", "Mexico Region 1", "Mexico Region 2").
 */
export function regionDeZona(
  zona: string,
  zonas: Array<{ label: string; region: string }> | undefined,
  producto: 'BNV' | 'BNP'
): string {
  const z = String(zona ?? '').trim();
  if (zonas && zonas.length > 0) {
    const exacta = zonas.find(zz => zz.label.toLowerCase() === z.toLowerCase());
    if (exacta) return regionDeLabel(exacta.label, exacta.region, producto);
    const porPrefijo = zonas.find(zz => zz.label.toLowerCase().startsWith(z.toLowerCase()) || z.toLowerCase().startsWith(zz.label.toLowerCase()));
    if (porPrefijo) return regionDeLabel(porPrefijo.label, porPrefijo.region, producto);
  }
  return regionDeLabel(z, '', producto);
}

function regionDeLabel(label: string, regionCol: string, producto: 'BNV' | 'BNP'): string {
  const l = label.toLowerCase();
  const esZona1 = l.startsWith('zona 1') || l === 'zona 1';
  if (producto === 'BNV') {
    // La columna Region de MasterBase trae el nombre completo del producto.
    if (regionCol && regionCol.toLowerCase().includes('region')) {
      return esZona1 ? 'Mexico Region 1 BNV' : 'Mexico Region 2 (no CDMX, ZM Y MTY)';
    }
    return esZona1 ? 'Mexico Region 1 BNV' : 'Mexico Region 2 (no CDMX, ZM Y MTY)';
  }
  return esZona1 ? 'Mexico Region 1' : 'Mexico Region 2';
}
