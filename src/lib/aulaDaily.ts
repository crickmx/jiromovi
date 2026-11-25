import { supabase } from './supabase';

/**
 * Puerta al Aula Virtual sobre Daily.
 *
 * Todo lo delicado (sala privada, meeting tokens, grabación en la nube) vive en
 * las edge functions `aula-daily`, `aula-invitado` y `aula-publicar`. Aquí solo
 * se piden las credenciales y se normalizan los errores para la UI.
 */

export type RolAula = 'host' | 'cohost' | 'oyente' | 'ponente';

/**
 * Sube la imagen miniatura de una clase a `aula-portadas` y devuelve su URL pública.
 * Es la misma imagen que `aula-publicar` copia a `seguros_lessons.miniatura_url`
 * cuando la grabación se publica en On Demand.
 */
export async function subirPortadaClase(archivo: File): Promise<string> {
  if (!archivo.type.startsWith('image/')) throw new Error('La imagen miniatura debe ser un archivo de imagen');
  if (archivo.size > 8 * 1024 * 1024) throw new Error('La imagen miniatura no debe pesar más de 8 MB');

  const ext = (archivo.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '') || 'png';
  const path = `eventos/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from('aula-portadas')
    .upload(path, archivo, { contentType: archivo.type || 'image/png', cacheControl: '3600', upsert: false });
  if (error) throw new Error(`No se pudo subir la imagen miniatura: ${error.message}`);

  return supabase.storage.from('aula-portadas').getPublicUrl(path).data.publicUrl;
}

export interface EntradaAula {
  room_url: string;
  room_name: string;
  token: string;
  rol: RolAula;
  nombre: string;
  /** Token del link público para invitar ponentes (solo lo recibe quien conduce). */
  link_token?: string | null;
  /** Token del link público para invitar oyentes (solo lo recibe quien conduce). */
  link_token_asistente?: string | null;
}

export interface EntradaInvitado extends EntradaAula {
  evento_id: string;
  sesion: string;
  participante_id: string;
  invitado_id: string;
  empresa: string;
  avatar_url: string | null;
  clase: string;
  grabar: boolean;
  tipo?: 'ponente' | 'asistente';
  oficina?: { id: string; nombre: string } | null;
  /** Si el alta del usuario pendiente falló, aquí viene el motivo (el invitado entra igual). */
  registro_error?: string | null;
  ya_era_usuario?: boolean;
}

async function invocar<T>(funcion: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(funcion, { body });
  if (error) {
    // El cuerpo del error trae el motivo real; supabase-js solo da el status.
    const contexto = (error as { context?: Response }).context;
    if (contexto && typeof contexto.json === 'function') {
      try {
        const payload = await contexto.json();
        if (payload?.error) throw new Error(String(payload.error));
      } catch (e) {
        if (e instanceof Error && e.message) throw e;
      }
    }
    throw new Error(error.message || 'No se pudo conectar con el Aula Virtual');
  }
  if (data?.error) throw new Error(String(data.error));
  return data as T;
}

export const aulaDaily = {
  crearSala: (eventoId: string) =>
    invocar<{
      room_name: string;
      room_url: string;
      link_token: string | null;
      link_token_asistente: string | null;
    }>('aula-daily', {
      action: 'crear-sala',
      evento_id: eventoId,
    }),

  /**
   * Encola la invitación (correo + WhatsApp + in-app) para toda la plantilla.
   * Devuelve cuántos destinatarios quedaron en la cola.
   */
  invitar: (eventoId: string) =>
    invocar<{ ok: boolean; encolados: number }>('aula-daily', {
      action: 'invitar',
      evento_id: eventoId,
    }),

  entrar: (eventoId: string) =>
    invocar<EntradaAula>('aula-daily', { action: 'token-entrada', evento_id: eventoId }),

  iniciar: (eventoId: string) =>
    invocar<{ ok: boolean; grabacion: { ok: boolean; pendiente?: string; error?: string } }>('aula-daily', {
      action: 'iniciar',
      evento_id: eventoId,
    }),

  /** Se llama cuando el anfitrión ya está dentro: Daily no graba salas vacías. */
  iniciarGrabacionNube: (eventoId: string) =>
    invocar<{ ok: boolean; error?: string; omitido?: string }>('aula-daily', {
      action: 'grabacion-iniciar',
      evento_id: eventoId,
    }),

  finalizar: (eventoId: string) =>
    invocar<{ ok: boolean }>('aula-daily', { action: 'finalizar', evento_id: eventoId }),

  /** Borra la sala en Daily y el evento (sus hijos caen en cascada). */
  eliminar: (eventoId: string) =>
    invocar<{ ok: boolean }>('aula-daily', { action: 'eliminar', evento_id: eventoId }),

  estado: (eventoId: string) =>
    invocar<{ estado: string; empezado: boolean; link_activo: boolean; sala_lista: boolean }>(
      'aula-daily',
      { action: 'estado', evento_id: eventoId },
    ),
};

export interface InfoInvitacion {
  evento_id: string;
  clase: string;
  estado: string;
  /** `asistente` = link abierto para oyentes; `ponente` = link de invitados con voz. */
  tipo: 'ponente' | 'asistente';
  ponente: string | null;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  /** Solo llega en el link de asistentes: la ruta pública no puede leer `oficinas`. */
  oficinas: { id: string; nombre: string }[];
}

export interface DatosAsistente {
  nombre: string;
  email: string;
  whatsapp: string;
  oficina_id: string;
}

export const aulaInvitado = {
  info: (token: string) => invocar<InfoInvitacion>('aula-invitado', { action: 'info', token }),

  entrar: (token: string, nombre: string, empresa: string, avatar?: string | null) =>
    invocar<EntradaInvitado>('aula-invitado', {
      action: 'join',
      token,
      nombre,
      empresa,
      avatar: avatar ?? null,
    }),

  /** Alta del asistente externo: queda registrado como usuario pendiente de activación. */
  entrarAsistente: (token: string, datos: DatosAsistente) =>
    invocar<EntradaInvitado>('aula-invitado', { action: 'join', token, ...datos }),

  mensaje: (sesion: string, texto: string) =>
    invocar<{ ok: boolean; id: string }>('aula-invitado', { action: 'mensaje', sesion, texto }),

  adjunto: (sesion: string, nombre: string, mime: string, base64: string) =>
    invocar<{ ok: boolean; id: string; url: string }>('aula-invitado', {
      action: 'adjunto',
      sesion,
      nombre,
      mime,
      base64,
    }),

  salir: (sesion: string) =>
    invocar<{ ok: boolean }>('aula-invitado', { action: 'salir', sesion }),
};

export const aulaPublicar = {
  subirUrls: (eventoId: string) =>
    Promise.all([
      invocar<{ path: string; token: string }>('aula-publicar', {
        action: 'subir-url',
        evento_id: eventoId,
        tipo: 'video',
        ext: 'webm',
      }),
      invocar<{ path: string; token: string }>('aula-publicar', {
        action: 'subir-url',
        evento_id: eventoId,
        tipo: 'audio',
        ext: 'webm',
      }),
    ]),

  publicar: (eventoId: string, datos: {
    video_path: string;
    audio_path: string | null;
    duracion_segundos: number;
    tamano_bytes: number;
  }) =>
    invocar<{ ok: boolean; leccion_id: string; documentos: number; transcrito: boolean }>(
      'aula-publicar',
      { action: 'publicar', evento_id: eventoId, ...datos },
    ),
};

/** Sube un blob al bucket de grabaciones usando la URL firmada. */
export async function subirConUrlFirmada(path: string, token: string, blob: Blob) {
  const { error } = await supabase.storage
    .from('aula-grabaciones')
    .uploadToSignedUrl(path, token, blob, { contentType: blob.type || 'video/webm' });
  if (error) throw error;
}