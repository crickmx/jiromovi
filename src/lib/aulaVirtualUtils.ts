import { supabase } from './supabase';

export interface AulaSession {
  id: string;
  titulo: string;
  descripcion: string | null;
  instructor_id: string | null;
  fecha_inicio: string;
  fecha_fin: string;
  duracion_minutos: number;
  esta_activa: boolean;
  iniciada_at: string | null;
  finalizada_at: string | null;
  grabar_sesion: boolean;
  enlace_sala: string;
  enlace_invitado: string;
  max_participantes: number;
  room_id: string | null;
  estado: 'programada' | 'en_vivo' | 'finalizada' | 'cancelada';
  metadata: any;
  created_at: string;
  updated_at: string;
}

export interface AulaParticipante {
  id: string;
  sesion_id: string;
  usuario_id: string | null;
  nombre_invitado: string | null;
  email_invitado: string | null;
  rol_participante: 'instructor' | 'participante' | 'invitado';
  puede_compartir_pantalla: boolean;
  puede_hablar: boolean;
  puede_video: boolean;
  ingreso_at: string | null;
  salida_at: string | null;
  duracion_conexion_segundos: number;
  peer_id: string | null;
  estado_conexion: 'conectado' | 'desconectado' | 'expulsado';
  created_at: string;
}

export interface AulaGrabacion {
  id: string;
  sesion_id: string;
  archivo_original_url: string | null;
  archivo_procesado_url: string | null;
  miniatura_url: string | null;
  duracion_segundos: number | null;
  tamano_bytes: number | null;
  formato_original: string;
  formato_procesado: string;
  estado_procesamiento: 'grabando' | 'procesando' | 'completado' | 'error';
  iniciado_at: string;
  completado_at: string | null;
  error_mensaje: string | null;
  publicado_ondemand: boolean;
  leccion_ondemand_id: string | null;
  created_at: string;
}

export async function crearSesion(sessionData: {
  titulo: string;
  descripcion?: string;
  fecha_inicio: string;
  fecha_fin: string;
  duracion_minutos: number;
  grabar_sesion?: boolean;
  max_participantes?: number;
}) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('No hay sesión activa');

  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/aula-virtual-session-manager`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        action: 'create',
        sessionData
      }),
    }
  );

  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || 'Error al crear la sesión');
  }

  return result.data.session as AulaSession;
}

export async function iniciarSesion(sessionId: string) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('No hay sesión activa');

  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/aula-virtual-session-manager`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        action: 'start',
        sessionId
      }),
    }
  );

  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || 'Error al iniciar la sesión');
  }

  return result.data;
}

export async function finalizarSesion(sessionId: string) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('No hay sesión activa');

  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/aula-virtual-session-manager`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        action: 'end',
        sessionId
      }),
    }
  );

  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || 'Error al finalizar la sesión');
  }

  return result.data;
}

export async function unirseASesion(sessionId: string, peerId?: string) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('No hay sesión activa');

  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/aula-virtual-session-manager`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        action: 'join',
        sessionId,
        participantData: { peerId }
      }),
    }
  );

  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || 'Error al unirse a la sesión');
  }

  return result.data;
}

export async function salirDeSesion(sessionId: string) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('No hay sesión activa');

  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/aula-virtual-session-manager`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        action: 'leave',
        sessionId
      }),
    }
  );

  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || 'Error al salir de la sesión');
  }

  return result.data;
}

export async function convertirGrabacionAOnDemand(
  grabacionId: string,
  options?: {
    titulo?: string;
    descripcion?: string;
    categoriaId?: string;
    publicar?: boolean;
  }
) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('No hay sesión activa');

  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/convertir-grabacion-ondemand`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        grabacionId,
        ...options
      }),
    }
  );

  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || 'Error al convertir la grabación');
  }

  return result.data;
}

export async function obtenerSesiones() {
  const { data, error } = await supabase
    .from('aula_virtual_sesiones')
    .select(`
      *,
      instructor:usuarios(id, nombre_completo)
    `)
    .order('fecha_inicio', { ascending: true });

  if (error) {
    console.error('Error obteniendo sesiones:', error);
    throw error;
  }

  console.log('✅ Sesiones obtenidas desde Supabase:', data);
  return data as (AulaSession & { instructor: { id: string; nombre_completo: string } | null })[];
}

export async function obtenerParticipantes(sessionId: string) {
  const { data, error } = await supabase
    .from('aula_virtual_participantes')
    .select(`
      *,
      usuario:usuarios(id, nombre_completo, email_laboral)
    `)
    .eq('sesion_id', sessionId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data;
}

export async function obtenerGrabaciones(sessionId?: string) {
  let query = supabase
    .from('aula_virtual_grabaciones')
    .select(`
      *,
      sesion:aula_virtual_sesiones(id, titulo, instructor_id)
    `)
    .order('created_at', { ascending: false });

  if (sessionId) {
    query = query.eq('sesion_id', sessionId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as (AulaGrabacion & { sesion: Partial<AulaSession> })[];
}

export function generarEnlaceInvitado(session: AulaSession): string {
  return `${window.location.origin}/aula-virtual/sala/${session.room_id}`;
}

export function generarEnlaceSala(session: AulaSession): string {
  return `${window.location.origin}/aula-virtual/sala/${session.room_id}`;
}

export function copiarAlPortapapeles(texto: string): Promise<void> {
  return navigator.clipboard.writeText(texto);
}
