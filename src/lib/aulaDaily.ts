import { supabase } from './supabase';

/**
 * Puerta al Aula Virtual sobre Daily.
 *
 * Todo lo delicado (sala privada, meeting tokens, grabación en la nube) vive en
 * las edge functions `aula-daily`, `aula-invitado` y `aula-publicar`. Aquí solo
 * se piden las credenciales y se normalizan los errores para la UI.
 */

export type RolAula = 'host' | 'cohost' | 'oyente' | 'ponente';

export interface EntradaAula {
  room_url: string;
  room_name: string;
  token: string;
  rol: RolAula;
  nombre: string;
}

export interface EntradaInvitado extends EntradaAula {
  sesion: string;
  participante_id: string;
  invitado_id: string;
  empresa: string;
  avatar_url: string | null;
  clase: string;
  grabar: boolean;
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
    invocar<{ room_name: string; room_url: string; link_token: string | null }>('aula-daily', {
      action: 'crear-sala',
      evento_id: eventoId,
    }),

  entrar: (eventoId: string) =>
    invocar<EntradaAula>('aula-daily', { action: 'token-entrada', evento_id: eventoId }),

  iniciar: (eventoId: string) =>
    invocar<{ ok: boolean; grabacion: { ok: boolean; error?: string } }>('aula-daily', {
      action: 'iniciar',
      evento_id: eventoId,
    }),

  finalizar: (eventoId: string) =>
    invocar<{ ok: boolean }>('aula-daily', { action: 'finalizar', evento_id: eventoId }),

  estado: (eventoId: string) =>
    invocar<{ estado: string; empezado: boolean; link_activo: boolean; sala_lista: boolean }>(
      'aula-daily',
      { action: 'estado', evento_id: eventoId },
    ),
};

export const aulaInvitado = {
  info: (token: string) =>
    invocar<{ clase: string; estado: string; fecha_inicio: string | null; fecha_fin: string | null }>(
      'aula-invitado',
      { action: 'info', token },
    ),

  entrar: (token: string, nombre: string, empresa: string, avatar?: string | null) =>
    invocar<EntradaInvitado>('aula-invitado', {
      action: 'join',
      token,
      nombre,
      empresa,
      avatar: avatar ?? null,
    }),

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