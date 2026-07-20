import { addMinutes, format } from 'date-fns';
import { fromZonedTime, toZonedTime } from 'date-fns-tz';
import { supabase } from './supabase';
import type {
  AgendaCalendario,
  AgendaCrearReservaResult,
  AgendaExcepcionDisponibilidad,
  AgendaModalidad,
  AgendaPublicEventType,
  AgendaReglaDisponibilidad,
  AgendaReserva,
  AgendaTipoCita,
  AgendaWebsiteBloque,
  AgendaWebsiteBloquePublico,
} from './agendaTypes';

// ═══════════════════════════════════════════════════════════════
// Admin CRUD (autenticado, sujeto a RLS por user_id = auth.uid())
// ═══════════════════════════════════════════════════════════════

export async function listCalendarios(userId: string): Promise<AgendaCalendario[]> {
  const { data, error } = await supabase
    .from('agenda_calendarios')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function crearCalendario(input: Pick<AgendaCalendario, 'user_id' | 'nombre' | 'marca' | 'color' | 'zona_horaria'>): Promise<AgendaCalendario> {
  const { data, error } = await supabase.from('agenda_calendarios').insert(input).select().single();
  if (error) throw error;
  return data;
}

export async function actualizarCalendario(id: string, updates: Partial<AgendaCalendario>): Promise<void> {
  const { error } = await supabase.from('agenda_calendarios').update(updates).eq('id', id);
  if (error) throw error;
}

export async function eliminarCalendario(id: string): Promise<void> {
  const { error } = await supabase.from('agenda_calendarios').delete().eq('id', id);
  if (error) throw error;
}

export async function listTiposCita(calendarioId: string): Promise<AgendaTipoCita[]> {
  const { data, error } = await supabase
    .from('agenda_tipos_cita')
    .select('*')
    .eq('calendario_id', calendarioId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function listTodosTiposCitaDeUsuario(userId: string): Promise<AgendaTipoCita[]> {
  const { data, error } = await supabase
    .from('agenda_tipos_cita')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function crearTipoCita(input: Omit<AgendaTipoCita, 'id' | 'created_at' | 'updated_at'>): Promise<AgendaTipoCita> {
  const { data, error } = await supabase.from('agenda_tipos_cita').insert(input).select().single();
  if (error) throw error;
  return data;
}

export async function actualizarTipoCita(id: string, updates: Partial<AgendaTipoCita>): Promise<void> {
  const { error } = await supabase.from('agenda_tipos_cita').update(updates).eq('id', id);
  if (error) throw error;
}

export async function eliminarTipoCita(id: string): Promise<void> {
  const { error } = await supabase.from('agenda_tipos_cita').delete().eq('id', id);
  if (error) throw error;
}

export async function listReglas(calendarioId: string): Promise<AgendaReglaDisponibilidad[]> {
  const { data, error } = await supabase
    .from('agenda_disponibilidad_reglas')
    .select('*')
    .eq('calendario_id', calendarioId)
    .order('weekday', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function crearRegla(input: Omit<AgendaReglaDisponibilidad, 'id'>): Promise<AgendaReglaDisponibilidad> {
  const { data, error } = await supabase.from('agenda_disponibilidad_reglas').insert(input).select().single();
  if (error) throw error;
  return data;
}

export async function eliminarRegla(id: string): Promise<void> {
  const { error } = await supabase.from('agenda_disponibilidad_reglas').delete().eq('id', id);
  if (error) throw error;
}

export async function listExcepciones(calendarioId: string): Promise<AgendaExcepcionDisponibilidad[]> {
  const { data, error } = await supabase
    .from('agenda_disponibilidad_excepciones')
    .select('*')
    .eq('calendario_id', calendarioId)
    .order('fecha', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function crearExcepcion(input: Omit<AgendaExcepcionDisponibilidad, 'id'>): Promise<AgendaExcepcionDisponibilidad> {
  const { data, error } = await supabase.from('agenda_disponibilidad_excepciones').insert(input).select().single();
  if (error) throw error;
  return data;
}

export async function eliminarExcepcion(id: string): Promise<void> {
  const { error } = await supabase.from('agenda_disponibilidad_excepciones').delete().eq('id', id);
  if (error) throw error;
}

export async function listReservas(userId: string): Promise<AgendaReserva[]> {
  const { data, error } = await supabase
    .from('agenda_reservas')
    .select('*')
    .eq('user_id', userId)
    .order('start_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function cancelarReserva(id: string, motivo: string): Promise<void> {
  const { error } = await supabase
    .from('agenda_reservas')
    .update({ status: 'cancelada', cancelado_en: new Date().toISOString(), cancelado_motivo: motivo })
    .eq('id', id);
  if (error) throw error;
}

export async function listWebsiteBloques(userId: string): Promise<AgendaWebsiteBloque[]> {
  const { data, error } = await supabase
    .from('agenda_website_bloques')
    .select('*')
    .eq('user_id', userId)
    .order('orden', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function guardarWebsiteBloques(userId: string, bloques: Array<{ tipo_cita_id: string; visible: boolean; orden: number }>): Promise<void> {
  await supabase.from('agenda_website_bloques').delete().eq('user_id', userId);
  if (bloques.length === 0) return;
  const { error } = await supabase
    .from('agenda_website_bloques')
    .insert(bloques.map(b => ({ user_id: userId, ...b })));
  if (error) throw error;
}

// ═══════════════════════════════════════════════════════════════
// Slug
// ═══════════════════════════════════════════════════════════════

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

export async function tipoCitaSlugDisponible(userId: string, slug: string, excludeId?: string): Promise<boolean> {
  let query = supabase.from('agenda_tipos_cita').select('id').eq('user_id', userId).eq('slug', slug);
  if (excludeId) query = query.neq('id', excludeId);
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return !data;
}

// ═══════════════════════════════════════════════════════════════
// Público (sin sesión) — vía RPC SECURITY DEFINER
// ═══════════════════════════════════════════════════════════════

export async function getPublicEventType(webSlug: string, tipoSlug: string): Promise<AgendaPublicEventType | null> {
  const { data, error } = await supabase.rpc('agenda_public_get_event_type', {
    p_web_slug: webSlug,
    p_tipo_slug: tipoSlug,
  });
  if (error) {
    console.error('Error fetching public event type:', error);
    return null;
  }
  return data as AgendaPublicEventType | null;
}

export async function getPublicWebsiteBlocks(userId: string): Promise<AgendaWebsiteBloquePublico[]> {
  const { data, error } = await supabase.rpc('agenda_public_get_website_blocks', { p_user_id: userId });
  if (error) {
    console.error('Error fetching agenda website blocks:', error);
    return [];
  }
  return (data as AgendaWebsiteBloquePublico[]) || [];
}

export async function crearReservaPublica(params: {
  tipo_cita_id: string;
  start_at: string;
  invitado_nombre: string;
  invitado_email: string;
  modalidad: AgendaModalidad;
  invitado_telefono?: string | null;
  invitado_notas?: string | null;
  zona_horaria_invitado?: string | null;
}): Promise<AgendaCrearReservaResult> {
  const { data, error } = await supabase.rpc('agenda_public_crear_reserva', {
    p_tipo_cita_id: params.tipo_cita_id,
    p_start_at: params.start_at,
    p_invitado_nombre: params.invitado_nombre,
    p_invitado_email: params.invitado_email,
    p_modalidad: params.modalidad,
    p_invitado_telefono: params.invitado_telefono ?? null,
    p_invitado_notas: params.invitado_notas ?? null,
    p_zona_horaria_invitado: params.zona_horaria_invitado ?? null,
  });
  if (error) throw new Error(error.message);
  return data as AgendaCrearReservaResult;
}

// ═══════════════════════════════════════════════════════════════
// Cálculo de horarios disponibles (usado en la página pública)
// ═══════════════════════════════════════════════════════════════

export interface SlotsPorDia {
  fecha: string; // yyyy-MM-dd en la zona horaria del calendario
  slots: string[]; // ISO UTC
}

/**
 * Recalcula los horarios disponibles en el cliente para pintar el selector.
 * La disponibilidad real se vuelve a validar por completo dentro de
 * agenda_public_crear_reserva — esto solo evita mostrarle al invitado
 * horarios que sabemos de antemano que van a fallar.
 */
export function calcularSlotsDisponibles(data: AgendaPublicEventType, diasAdelante = 21): SlotsPorDia[] {
  const { tipo_cita, reglas, excepciones, calendario } = data;
  const tz = calendario.zona_horaria;
  const duracion = tipo_cita.duracion_minutos;
  const bufferAntes = tipo_cita.buffer_antes_minutos;
  const bufferDespues = tipo_cita.buffer_despues_minutos;
  const minimaAnticipacion = addMinutes(new Date(), tipo_cita.anticipacion_minima_minutos);

  const ocupados = data.ocupados.map(o => ({
    start: new Date(o.start_at).getTime() - bufferAntes * 60000,
    end: new Date(o.end_at).getTime() + bufferDespues * 60000,
  }));

  const excepcionesPorFecha = new Map<string, { todo_el_dia: boolean; start_time: string | null; end_time: string | null }>();
  for (const exc of excepciones) {
    excepcionesPorFecha.set(exc.fecha, exc);
  }

  const reglasPorWeekday = new Map<number, Array<{ start_time: string; end_time: string }>>();
  for (const regla of reglas) {
    const list = reglasPorWeekday.get(regla.weekday) || [];
    list.push({ start_time: regla.start_time, end_time: regla.end_time });
    reglasPorWeekday.set(regla.weekday, list);
  }

  const resultado: SlotsPorDia[] = [];
  const hoyLocal = toZonedTime(new Date(), tz);

  for (let i = 0; i < diasAdelante; i++) {
    const diaLocal = new Date(hoyLocal);
    diaLocal.setDate(diaLocal.getDate() + i);
    const fechaStr = format(diaLocal, 'yyyy-MM-dd');
    const weekday = diaLocal.getDay();

    const excepcion = excepcionesPorFecha.get(fechaStr);
    if (excepcion?.todo_el_dia) continue;

    const reglasDelDia = reglasPorWeekday.get(weekday) || [];
    if (reglasDelDia.length === 0) continue;

    if (tipo_cita.limite_reservas_por_dia != null) {
      const reservasDelDia = ocupados.filter(o => format(toZonedTime(new Date(o.start), tz), 'yyyy-MM-dd') === fechaStr).length;
      if (reservasDelDia >= tipo_cita.limite_reservas_por_dia) continue;
    }

    const slotsDelDia: string[] = [];

    for (const rango of reglasDelDia) {
      const [startH, startM] = rango.start_time.split(':').map(Number);
      const [endH, endM] = rango.end_time.split(':').map(Number);

      let cursor = new Date(diaLocal);
      cursor.setHours(startH, startM, 0, 0);
      const finRango = new Date(diaLocal);
      finRango.setHours(endH, endM, 0, 0);

      while (addMinutes(cursor, duracion) <= finRango) {
        const inicioUTC = fromZonedTime(cursor, tz);
        const finUTC = addMinutes(inicioUTC, duracion);

        const dentroDeAnticipacion = inicioUTC >= minimaAnticipacion;
        const bloqueadoPorExcepcion = !!(
          excepcion && !excepcion.todo_el_dia && excepcion.start_time && excepcion.end_time &&
          cursor.getHours() * 60 + cursor.getMinutes() < timeToMinutes(excepcion.end_time) &&
          addMinutes(cursor, duracion).getHours() * 60 + addMinutes(cursor, duracion).getMinutes() > timeToMinutes(excepcion.start_time)
        );
        const solapaOcupado = ocupados.some(o => inicioUTC.getTime() < o.end && finUTC.getTime() > o.start);

        if (dentroDeAnticipacion && !bloqueadoPorExcepcion && !solapaOcupado) {
          slotsDelDia.push(inicioUTC.toISOString());
        }

        cursor = addMinutes(cursor, duracion);
      }
    }

    if (slotsDelDia.length > 0) {
      resultado.push({ fecha: fechaStr, slots: slotsDelDia });
    }
  }

  return resultado;
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

// ═══════════════════════════════════════════════════════════════
// Jitsi
// ═══════════════════════════════════════════════════════════════

export function buildJitsiEmbedUrl(meetingUrl: string): string {
  return `${meetingUrl}#config.prejoinPageEnabled=false`;
}
