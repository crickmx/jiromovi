/**
 * Utilidad de días hábiles para México.
 * Fuentes: date-holidays (Art. 74 LFT) + tabla dias_no_habiles (excepciones personalizadas)
 *          + configuracion_jornada (horario laboral global).
 */
import Holidays from 'date-holidays';
import { supabase } from './supabase';

// ── Tipos ──────────────────────────────────────────────────────────────────────

interface Jornada {
  hora_inicio: string;           // 'HH:MM'
  hora_fin: string;              // 'HH:MM'
  horas_productivas_dia: number; // horas netas de trabajo por día
}

// ── Caché en memoria (TTL 5 min) ───────────────────────────────────────────────

let _jornada: Jornada | null = null;
let _noHabiles: Set<string> | null = null; // fechas 'YYYY-MM-DD'
let _cacheTs = 0;
const CACHE_TTL = 5 * 60 * 1000;

const hd = new Holidays('MX');

async function loadConfig(): Promise<{ jornada: Jornada; noHabiles: Set<string> }> {
  if (_jornada && _noHabiles && Date.now() - _cacheTs < CACHE_TTL) {
    return { jornada: _jornada, noHabiles: _noHabiles };
  }
  const [{ data: j }, { data: nh }] = await Promise.all([
    supabase
      .from('configuracion_jornada')
      .select('hora_inicio, hora_fin, horas_productivas_dia')
      .limit(1)
      .single(),
    supabase.from('dias_no_habiles').select('fecha').eq('activo', true),
  ]);
  _jornada  = (j as Jornada | null) ?? { hora_inicio: '09:00', hora_fin: '18:00', horas_productivas_dia: 8 };
  _noHabiles = new Set(((nh ?? []) as { fecha: string }[]).map(r => r.fecha));
  _cacheTs   = Date.now();
  return { jornada: _jornada, noHabiles: _noHabiles };
}

/** Invalida la caché (llamar tras guardar cambios en jornada o dias_no_habiles). */
export function invalidarCacheDiasHabiles() {
  _jornada   = null;
  _noHabiles = null;
  _cacheTs   = 0;
}

// ── Helpers internos ───────────────────────────────────────────────────────────

function parsearTiempo(t: string): { h: number; m: number } {
  const [h, m] = t.split(':').map(Number);
  return { h: h ?? 0, m: m ?? 0 };
}

function fechaStr(d: Date): string {
  return d.toISOString().split('T')[0];
}

function diaAnterior(d: Date): Date { const n = new Date(d); n.setDate(n.getDate() - 1); return n; }
function diaSiguiente(d: Date): Date { const n = new Date(d); n.setDate(n.getDate() + 1); return n; }

async function esDiaHabilInterno(fecha: Date, noHabiles: Set<string>): Promise<boolean> {
  const dow = fecha.getDay();
  if (dow === 0 || dow === 6) return false;
  if (noHabiles.has(fechaStr(fecha))) return false;
  if (hd.isHoliday(fecha)) return false;
  return true;
}

// ── Exports principales ────────────────────────────────────────────────────────

export async function esDiaHabil(fecha: Date): Promise<boolean> {
  const { noHabiles } = await loadConfig();
  return esDiaHabilInterno(fecha, noHabiles);
}

/**
 * Suma `dias` días hábiles a `fecha` y devuelve la fecha resultante (sin hora).
 */
export async function sumarDiasHabiles(fecha: Date, dias: number): Promise<Date> {
  const { noHabiles } = await loadConfig();
  let current = new Date(fecha);
  current.setHours(0, 0, 0, 0);
  let remaining = Math.ceil(dias); // redondear hacia arriba
  while (remaining > 0) {
    current = diaSiguiente(current);
    if (await esDiaHabilInterno(current, noHabiles)) remaining--;
  }
  return current;
}

/**
 * Calcula las horas hábiles entre dos momentos exactos.
 * Usa la jornada configurada y salta festivos / días no hábiles.
 * Si `pausas` se provee, descuenta esos intervalos del total.
 */
export async function calcularHorasHabilesEntre(
  inicio: Date,
  fin: Date,
  pausas?: { inicio: Date; fin: Date }[]
): Promise<number> {
  if (fin <= inicio) return 0;
  const { jornada, noHabiles } = await loadConfig();
  const ji = parsearTiempo(jornada.hora_inicio);
  const jf = parsearTiempo(jornada.hora_fin);
  const hpd = jornada.horas_productivas_dia;
  const minJornada = (jf.h * 60 + jf.m) - (ji.h * 60 + ji.m);

  function horasEnDia(dia: Date, desde?: Date, hasta?: Date): number {
    if (dia.getDay() === 0 || dia.getDay() === 6) return 0;
    if (noHabiles.has(fechaStr(dia))) return 0;
    if (hd.isHoliday(dia)) return 0;
    const jorIni = ji.h * 60 + ji.m;
    const jorFin = jf.h * 60 + jf.m;
    const desdeMin = desde ? Math.max(jorIni, desde.getHours() * 60 + desde.getMinutes()) : jorIni;
    const hastaMin = hasta ? Math.min(jorFin, hasta.getHours() * 60 + hasta.getMinutes()) : jorFin;
    if (hastaMin <= desdeMin) return 0;
    return hpd * (hastaMin - desdeMin) / minJornada;
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
 * Con `pausas`, descuenta esos intervalos.
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
 * Devuelve siempre una fecha sin hora (midnight local).
 */
export async function calcularDeadline(creacion: Date, slaHoras: number): Promise<Date> {
  const { jornada, noHabiles } = await loadConfig();
  const ji = parsearTiempo(jornada.hora_inicio);
  const jf = parsearTiempo(jornada.hora_fin);
  const hpd = jornada.horas_productivas_dia;
  const minJornada = (jf.h * 60 + jf.m) - (ji.h * 60 + ji.m);

  const isWorkday = (d: Date) => {
    if (d.getDay() === 0 || d.getDay() === 6) return false;
    if (noHabiles.has(fechaStr(d))) return false;
    if (hd.isHoliday(d)) return false;
    return true;
  };

  let horasRestantes = slaHoras;
  let current = new Date(creacion);

  // Horas disponibles hoy a partir de la hora de creación
  if (isWorkday(current)) {
    const horaFin24    = jf.h + jf.m / 60;
    const horaInicio24 = ji.h + ji.m / 60;
    const horaCreacion = creacion.getHours() + creacion.getMinutes() / 60;
    let minRestantes: number;
    if (horaCreacion <= horaInicio24) {
      minRestantes = minJornada;          // antes o al inicio → día completo
    } else if (horaCreacion >= horaFin24) {
      minRestantes = 0;                   // después del cierre → 0 hoy
    } else {
      minRestantes = (horaFin24 - horaCreacion) * 60;
    }
    const horasHoy = hpd * (minRestantes / minJornada);

    if (horasHoy >= horasRestantes) {
      const result = new Date(creacion);
      result.setHours(0, 0, 0, 0);
      return result;
    }
    horasRestantes -= horasHoy;
  }

  // Avanzar días hábiles hasta consumir todas las horas
  current = new Date(creacion);
  current.setHours(0, 0, 0, 0);
  current = diaSiguiente(current);

  let safety = 0;
  while (safety++ < 3650) {
    if (isWorkday(current)) {
      if (horasRestantes <= hpd) {
        return new Date(current); // deadline = este día (redondeado arriba)
      }
      horasRestantes -= hpd;
    }
    current = diaSiguiente(current);
  }

  return current; // fallback (no debería llegar aquí)
}

// ── Helper UI: lista festivos de un año para la página admin ──────────────────

export interface FestivoInfo {
  fecha: string;    // 'YYYY-MM-DD'
  nombre: string;
  tipo: 'automatico' | 'personalizado';
  activo?: boolean;
  id?: string;
  descripcion?: string;
}

export async function getFestivosDelAno(year: number): Promise<FestivoInfo[]> {
  const hdYear = new Holidays('MX');
  const oficiales: FestivoInfo[] = hdYear.getHolidays(year)
    .filter(h => h.type === 'public')
    .map(h => ({
      fecha: fechaStr(new Date(h.date)),
      nombre: h.name,
      tipo: 'automatico' as const,
    }));

  const { data: custom } = await supabase
    .from('dias_no_habiles')
    .select('id, fecha, descripcion, activo')
    .gte('fecha', `${year}-01-01`)
    .lte('fecha', `${year}-12-31`)
    .order('fecha');

  const personalizados: FestivoInfo[] = ((custom ?? []) as { id: string; fecha: string; descripcion: string; activo: boolean }[])
    .map(c => ({
      fecha: c.fecha,
      nombre: c.descripcion,
      descripcion: c.descripcion,
      tipo: 'personalizado' as const,
      activo: c.activo,
      id: c.id,
    }));

  return [...oficiales, ...personalizados].sort((a, b) => a.fecha.localeCompare(b.fecha));
}
