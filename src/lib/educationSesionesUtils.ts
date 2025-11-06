import { supabase } from './supabase';
import type { Database } from './database.types';

type SesionProgramada = Database['public']['Tables']['education_sesiones_programadas']['Row'];
type SesionInsert = Database['public']['Tables']['education_sesiones_programadas']['Insert'];
type SesionUpdate = Database['public']['Tables']['education_sesiones_programadas']['Update'];
type Registro = Database['public']['Tables']['education_sesiones_registro']['Row'];

export type { SesionProgramada, SesionInsert, SesionUpdate, Registro };

export interface SesionConRegistro extends SesionProgramada {
  total_registros?: number;
  usuario_registrado?: boolean;
  registros?: Registro[];
}

export async function obtenerSesionesProgramadas(filtros?: {
  estatus?: string;
  compania?: string;
  desde?: string;
  hasta?: string;
  tags?: string[];
}): Promise<SesionConRegistro[]> {
  let query = supabase
    .from('education_sesiones_programadas')
    .select(`
      *,
      registros:education_sesiones_registro(count)
    `)
    .eq('publicada', true)
    .order('fecha', { ascending: true })
    .order('hora', { ascending: true });

  if (filtros?.estatus) {
    query = query.eq('estatus', filtros.estatus);
  }

  if (filtros?.compania) {
    query = query.ilike('compania', `%${filtros.compania}%`);
  }

  if (filtros?.desde) {
    query = query.gte('fecha', filtros.desde);
  }

  if (filtros?.hasta) {
    query = query.lte('fecha', filtros.hasta);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error obteniendo sesiones:', error);
    throw error;
  }

  const user = (await supabase.auth.getUser()).data.user;
  const userId = user?.id;

  if (!userId) return data || [];

  const sesionIds = data?.map(s => s.id) || [];
  const { data: registrosUsuario } = await supabase
    .from('education_sesiones_registro')
    .select('sesion_id')
    .eq('usuario_id', userId)
    .in('sesion_id', sesionIds);

  const registradoIds = new Set(registrosUsuario?.map(r => r.sesion_id) || []);

  return (data || []).map(sesion => ({
    ...sesion,
    total_registros: sesion.registros?.[0]?.count || 0,
    usuario_registrado: registradoIds.has(sesion.id)
  }));
}

export async function crearSesionProgramada(datos: SesionInsert): Promise<SesionProgramada> {
  const { data, error } = await supabase
    .from('education_sesiones_programadas')
    .insert(datos)
    .select()
    .single();

  if (error) {
    console.error('Error creando sesión:', error);
    throw error;
  }

  return data;
}

export async function actualizarSesionProgramada(
  id: string,
  datos: SesionUpdate
): Promise<SesionProgramada> {
  const { data, error } = await supabase
    .from('education_sesiones_programadas')
    .update(datos)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error actualizando sesión:', error);
    throw error;
  }

  return data;
}

export async function eliminarSesionProgramada(id: string): Promise<void> {
  const { error } = await supabase
    .from('education_sesiones_programadas')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error eliminando sesión:', error);
    throw error;
  }
}

export async function registrarseEnSesion(sesionId: string): Promise<void> {
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) throw new Error('Usuario no autenticado');

  const { data: sesion } = await supabase
    .from('education_sesiones_programadas')
    .select('capacidad, registros:education_sesiones_registro(count)')
    .eq('id', sesionId)
    .single();

  if (sesion?.capacidad) {
    const totalRegistros = sesion.registros?.[0]?.count || 0;
    if (totalRegistros >= sesion.capacidad) {
      throw new Error('La sesión ha alcanzado su capacidad máxima');
    }
  }

  const { error } = await supabase
    .from('education_sesiones_registro')
    .insert({
      sesion_id: sesionId,
      usuario_id: user.id
    });

  if (error) {
    if (error.code === '23505') {
      throw new Error('Ya estás registrado en esta sesión');
    }
    console.error('Error registrándose:', error);
    throw error;
  }
}

export async function cancelarRegistro(sesionId: string): Promise<void> {
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) throw new Error('Usuario no autenticado');

  const { error } = await supabase
    .from('education_sesiones_registro')
    .delete()
    .eq('sesion_id', sesionId)
    .eq('usuario_id', user.id);

  if (error) {
    console.error('Error cancelando registro:', error);
    throw error;
  }
}

export function puedeIngresar(sesion: SesionProgramada): boolean {
  const now = new Date();
  const fechaHora = new Date(`${sesion.fecha}T${sesion.hora}`);
  const minutosAnticipacion = sesion.minutos_anticipacion || 15;
  const tiempoAnticipacion = minutosAnticipacion * 60 * 1000;

  const puedeIngresarDesde = new Date(fechaHora.getTime() - tiempoAnticipacion);
  const finSesion = new Date(fechaHora.getTime() + (sesion.duracion_minutos * 60 * 1000));

  return now >= puedeIngresarDesde && now <= finSesion && sesion.estatus !== 'cancelada';
}

export function obtenerTiempoRestante(sesion: SesionProgramada): string | null {
  const now = new Date();
  const fechaHora = new Date(`${sesion.fecha}T${sesion.hora}`);
  const diff = fechaHora.getTime() - now.getTime();

  if (diff < 0) return null;

  const dias = Math.floor(diff / (1000 * 60 * 60 * 24));
  const horas = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutos = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (dias > 0) {
    return `${dias} día${dias > 1 ? 's' : ''} ${horas}h`;
  } else if (horas > 0) {
    return `${horas}h ${minutos}min`;
  } else {
    return `${minutos} min`;
  }
}

export function generarArchivoICS(sesion: SesionProgramada): string {
  const fechaHora = new Date(`${sesion.fecha}T${sesion.hora}`);
  const fechaFin = new Date(fechaHora.getTime() + (sesion.duracion_minutos * 60 * 1000));

  const formatFecha = (date: Date) => {
    return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  };

  let descripcion = sesion.descripcion.replace(/\n/g, '\\n');
  if (sesion.link_acceso) {
    descripcion += `\\n\\nEnlace de acceso: ${sesion.link_acceso}`;
  }
  if (sesion.clave_acceso) {
    descripcion += `\\n\\nClave de acceso: ${sesion.clave_acceso}`;
  }

  const ics = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Seguros Education//ES
BEGIN:VEVENT
UID:${sesion.id}@seguroseducation.com
DTSTAMP:${formatFecha(new Date())}
DTSTART:${formatFecha(fechaHora)}
DTEND:${formatFecha(fechaFin)}
SUMMARY:${sesion.titulo} - ${sesion.compania}
DESCRIPTION:${descripcion}
LOCATION:${sesion.link_acceso}
STATUS:CONFIRMED
SEQUENCE:0
BEGIN:VALARM
TRIGGER:-PT15M
DESCRIPTION:Recordatorio: ${sesion.titulo}
ACTION:DISPLAY
END:VALARM
END:VEVENT
END:VCALENDAR`;

  return ics;
}

export function descargarICS(sesion: SesionProgramada) {
  const ics = generarArchivoICS(sesion);
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${sesion.titulo.replace(/[^a-z0-9]/gi, '_')}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export async function copiarAlPortapapeles(texto: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch (error) {
    console.error('Error copiando al portapapeles:', error);
    return false;
  }
}
