/**
 * Utilidad de días hábiles para México.
 * Festivos LFT Art. 74 + tabla dias_no_habiles (excepciones personalizadas)
 * + configuracion_jornada (horario laboral global).
 */
import { supabase } from './supabase';

// ── Festivos México LFT Art. 74 ────────────────────────────────────────────────

interface HolidayDef {
  month: number; // 1-12
  day?: number;  // fixed day, or use rule
  rule?: 'first-monday' | 'third-monday';
}

const MX_HOLIDAYS: HolidayDef[] = [
  { month: 1,  day: 1  }, // Año Nuevo
  { month: 2,  rule: 'first-monday'  }, // Día de la Constitución
  { month: 3,  rule: 'third-monday'  }, // Natalicio Benito Juárez
  { month: 5,  day: 1  }, // Día del Trabajo
  { month: 9,  day: 16 }, // Independencia
  { month: 11, rule: 'third-monday' }, // Revolución Mexicana
  { month: 12, day: 25 }, // Navidad
];

function getNthMonday(year: number, month: number, n: number): Date {
  const d = new Date(year, month - 1, 1);
  const dow = d.getDay(); // 0=Sun
  const offset = dow === 1 ? 0 : (8 - dow) % 7;
  d.setDate(1 + offset + (n - 1) * 7);
  return d;
}

function getMxHolidayDates(year: number): Set<string> {
  const set = new Set<string>();
  for (const h of MX_HOLIDAYS) {
    let date: Date;
    if (h.day) {
      date = new Date(year, h.month - 1, h.day);
    } else if (h.rule === 'first-monday') {
      date = getNthMonday(year, h.month, 1);
    } else {
      date = getNthMonday(year, h.month, 3);
    }
    set.add(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`);
  }
  return set;
}

function isMxHoliday(date: Date): boolean {
  const key = fechaStr(date);
  const year = date.getFullYear();
  return getMxHolidayDates(year).has(key);
}

// ── Tipos ──────────────────────────────────────────────────────────────────────

interface Jornada {
  hora_inicio: string;           // 'HH:MM'
  hora_fin: string;              // 'HH:MM'
  horas_productivas_dia: number; // horas netas de trabajo por día
}

// ── Caché en memoria (TTL 5 min) ───────────────────────────────────────────────

let _jornada: Jornada | null = null;
// 'cerrado' = día completamente no hábil | 'media' = media jornada (hpd × 0.5)
let _diasConfig: Map<string, 'cerrado' | 'media'> | null = null;
let _cacheTs = 0;
const CACHE_TTL = 5 * 60 * 1000;

async function loadConfig(): Promise<{ jornada: Jornada; diasConfig: Map<string, 'cerrado' | 'media'> }> {
  if (_jornada && _diasConfig && Date.now() - _cacheTs < CACHE_TTL) {
    return { jornada: _jornada, diasConfig: _diasConfig };
  }
  const [{ data: j }, { data: nh }] = await Promise.all([
    supabase
      .from('configuracion_jornada')
      .select('hora_inicio, hora_fin, horas_productivas_dia')
      .limit(1)
      .single(),
    supabase.from('dias_no_habiles').select('fecha, es_media_jornada').eq('activo', true),
  ]);
  _jornada = (j as Jornada | null) ?? { hora_inicio: '09:00', hora_fin: '18:00', horas_productivas_dia: 8 };
  _diasConfig = new Map<string, 'cerrado' | 'media'>();
  for (const r of ((nh ?? []) as { fecha: string; es_media_jornada: boolean }[])) {
    _diasConfig.set(r.fecha, r.es_media_jornada ? 'media' : 'cerrado');
  }
  _cacheTs = Date.now();
  return { jornada: _jornada, diasConfig: _diasConfig };
}

/** Invalida la caché (llamar tras guardar cambios en jornada o dias_no_habiles). */
export function invalidarCacheDiasHabiles() {
  _jornada    = null;
  _diasConfig = null;
  _cacheTs    = 0;
}

// ── Helpers internos ───────────────────────────────────────────────────────────

function parsearTiempo(t: string): { h: number; m: number } {
  const [h, m] = t.split(':').map(Number);
  return { h: h ?? 0, m: m ?? 0 };
}

function fechaStr(d: Date): string {
  return d.toISOString().split('T')[0];
}

function diaSiguiente(d: Date): Date { const n = new Date(d); n.setDate(n.getDate() + 1); return n; }

function esDiaHabilInterno(fecha: Date, diasConfig: Map<string, 'cerrado' | 'media'>): boolean {
  const dow = fecha.getDay();
  if (dow === 0 || dow === 6) return false;
  if (diasConfig.get(fechaStr(fecha)) === 'cerrado') return false;
  if (isMxHoliday(fecha)) return false;
  return true;
}

// Factor 0.5 para medias jornadas, 1.0 para días normales hábiles
function factorJornada(fecha: Date, diasConfig: Map<string, 'cerrado' | 'media'>): number {
  return diasConfig.get(fechaStr(fecha)) === 'media' ? 0.5 : 1;
}

// ── Exports principales ────────────────────────────────────────────────────────

export async function esDiaHabil(fecha: Date): Promise<boolean> {
  const { diasConfig } = await loadConfig();
  return esDiaHabilInterno(fecha, diasConfig);
}

/**
 * Suma `dias` días hábiles a `fecha` y devuelve la fecha resultante (sin hora).
 */
export async function sumarDiasHabiles(fecha: Date, dias: number): Promise<Date> {
  const { diasConfig } = await loadConfig();
  let current = new Date(fecha);
  current.setHours(0, 0, 0, 0);
  let remaining = Math.ceil(dias);
  while (remaining > 0) {
    current = diaSiguiente(current);
    if (esDiaHabilInterno(current, diasConfig)) remaining--;
  }
  return current;
}

/**
 * Calcula las horas hábiles entre dos momentos exactos.
 * Usa la jornada configurada y salta festivos / días no hábiles.
 * Los días con es_media_jornada=true cuentan hpd × 0.5 horas.
 * Si `pausas` se provee, descuenta esos intervalos del total.
 */
export async function calcularHorasHabilesEntre(
  inicio: Date,
  fin: Date,
  pausas?: { inicio: Date; fin: Date }[]
): Promise<number> {
  if (fin <= inicio) return 0;
  const { jornada, diasConfig } = await loadConfig();
  const ji = parsearTiempo(jornada.hora_inicio);
  const jf = parsearTiempo(jornada.hora_fin);
  const hpd = jornada.horas_productivas_dia;
  const minJornada = (jf.h * 60 + jf.m) - (ji.h * 60 + ji.m);

  function horasEnDia(dia: Date, desde?: Date, hasta?: Date): number {
    if (dia.getDay() === 0 || dia.getDay() === 6) return 0;
    const cfg = diasConfig.get(fechaStr(dia));
    if (cfg === 'cerrado') return 0;
  if (isMxHoliday(dia)) return 0;
    const jorIni = ji.h * 60 + ji.m;
    const jorFin = jf.h * 60 + jf.m;
    const desdeMin = desde ? Math.max(jorIni, desde.getHours() * 60 + desde.getMinutes()) : jorIni;
    const hastaMin = hasta ? Math.min(jorFin, hasta.getHours() * 60 + hasta.getMinutes()) : jorFin;
    if (hastaMin <= desdeMin) return 0;
    const factor = cfg === 'media' ? 0.5 : 1;
    return hpd * factor * (hastaMin - desdeMin) / minJornada;
  }

  let total = 0;
  let current = new Date(inicio);
  current.setHours(0, 0, 0, 0);
  const endDay = new Date(fin);
  endDay.setHours(0, 0, 0, 0);

  while (current <= endDay) {
    const esPrimero = fechaStr(current) === fechaStr(inicio);
    const esUltimo  = fechaStr(current) === fechaStr(fin);
    total += horasEnDia(current, esPrimero ? inicio : undefined, esUltimo ? fin : undefined);
    current = diaSiguiente(current);
  }

  // Descontar pausas
  if (pausas) {
    for (const p of pausas) {
      total -= await calcularHorasHabilesEntre(p.inicio, p.fin);
    }
  }

  return Math.max(0, total);
}

/**
 * Calcula los días hábiles entre dos momentos.
 * Devuelve número decimal (no redondeado) para cálculos de stats.
 */
export async function calcularDiasHabilesEntre(
  inicio: Date,
  fin: Date,
  pausas?: { inicio: Date; fin: Date }[]
): Promise<number> {
  const { jornada } = await loadConfig();
  const horas = await calcularHorasHabilesEntre(inicio, fin, pausas);
  return horas / jornada.horas_productivas_dia;
}

/**
 * Calcula la fecha límite (deadline) dado el momento de creación y el SLA en horas hábiles.
 * Redondea HACIA ARRIBA: si las horas se agotan a mitad de un día, el deadline es ese día completo.
 * Respeta medias jornadas: esos días aportan hpd × 0.5 al contador de horas disponibles.
 */
export async function calcularDeadline(creacion: Date, slaHoras: number): Promise<Date> {
  const { jornada, diasConfig } = await loadConfig();
  const ji = parsearTiempo(jornada.hora_inicio);
  const jf = parsearTiempo(jornada.hora_fin);
  const hpd = jornada.horas_productivas_dia;
  const minJornada = (jf.h * 60 + jf.m) - (ji.h * 60 + ji.m);

  const isWorkday = (d: Date) => esDiaHabilInterno(d, diasConfig);
  const hpdDia    = (d: Date) => hpd * factorJornada(d, diasConfig);

  let horasRestantes = slaHoras;
  let current = new Date(creacion);

  if (isWorkday(current)) {
    const horaFin24    = jf.h + jf.m / 60;
    const horaInicio24 = ji.h + ji.m / 60;
    const horaCreacion = creacion.getHours() + creacion.getMinutes() / 60;
    let minRestantes: number;
    if (horaCreacion <= horaInicio24) {
      minRestantes = minJornada;
    } else if (horaCreacion >= horaFin24) {
      minRestantes = 0;
    } else {
      minRestantes = (horaFin24 - horaCreacion) * 60;
    }
    const horasHoy = hpdDia(current) * (minRestantes / minJornada);

    if (horasHoy >= horasRestantes) {
      const result = new Date(creacion);
      result.setHours(0, 0, 0, 0);
      return result;
    }
    horasRestantes -= horasHoy;
  }

  current = new Date(creacion);
  current.setHours(0, 0, 0, 0);
  current = diaSiguiente(current);

  let safety = 0;
  while (safety++ < 3650) {
    if (isWorkday(current)) {
      const disponible = hpdDia(current);
      if (horasRestantes <= disponible) {
        return new Date(current);
      }
      horasRestantes -= disponible;
    }
    current = diaSiguiente(current);
  }

  return current;
}

// ── Helper UI: lista festivos de un año para la página admin ──────────────────

export interface FestivoInfo {
  fecha: string;           // 'YYYY-MM-DD'
  nombre: string;
  tipo: 'automatico' | 'personalizado';
  activo?: boolean;
  id?: string;
  descripcion?: string;
  es_media_jornada?: boolean;
}

export async function getFestivosDelAno(year: number): Promise<FestivoInfo[]> {
  const NOMBRES: Record<string, string> = {
    '01-01': 'Año Nuevo',
    '05-01': 'Día del Trabajo',
    '09-16': 'Día de Independencia',
    '12-25': 'Navidad',
  };
  const oficiales: FestivoInfo[] = Array.from(getMxHolidayDates(year)).map(fecha => ({
    fecha,
    nombre: NOMBRES[fecha.slice(5)] ?? 'Día festivo',
    tipo: 'automatico' as const,
  }));

  const { data: custom } = await supabase
    .from('dias_no_habiles')
    .select('id, fecha, descripcion, activo, es_media_jornada')
    .gte('fecha', `${year}-01-01`)
    .lte('fecha', `${year}-12-31`)
    .order('fecha');

  const personalizados: FestivoInfo[] = ((custom ?? []) as {
    id: string; fecha: string; descripcion: string; activo: boolean; es_media_jornada: boolean;
  }[]).map(c => ({
    fecha: c.fecha,
    nombre: c.descripcion,
    descripcion: c.descripcion,
    tipo: 'personalizado' as const,
    activo: c.activo,
    id: c.id,
    es_media_jornada: c.es_media_jornada,
  }));

  return [...oficiales, ...personalizados].sort((a, b) => a.fecha.localeCompare(b.fecha));
}
