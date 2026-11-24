// Qué hacer cuando el correo del alta ya está ocupado.
//
// El alta falla en `auth.admin.createUser`, que rechaza un correo ya
// registrado — y el que lo ocupa suele ser invisible en MOVI (un usuario dado
// de baja, o una cuenta huérfana sin ficha). Antes el mensaje era el crudo de
// Supabase y no había salida; ahora se puede saber quién lo tiene y seguir.

import { supabase } from './supabase';

export interface OcupanteCorreo {
  user_id: string;
  nombre: string | null;
  apellidos: string | null;
  rol: string | null;
  /** ¿Se ve en MOVI? Si no, quitárselo no le afecta a nadie. */
  visible: boolean;
  motivo: 'activo' | 'eliminado' | 'huerfano_auth';
  eliminado_en: string | null;
}

export function nombreDeOcupante(o: OcupanteCorreo): string {
  const n = `${o.nombre ?? ''} ${o.apellidos ?? ''}`.trim();
  if (n) return n;
  return o.motivo === 'huerfano_auth' ? 'una cuenta sin ficha en MOVI' : 'un usuario sin nombre';
}

/** Quién tiene ese correo, o `null` si está libre. */
export async function quienOcupaCorreo(email: string): Promise<OcupanteCorreo | null> {
  const limpio = (email ?? '').trim();
  if (!limpio) return null;
  const { data, error } = await supabase.rpc('quien_ocupa_correo', { p_email: limpio });
  if (error) {
    console.error('Error consultando quién ocupa el correo:', error);
    return null;
  }
  const fila = Array.isArray(data) ? data[0] : data;
  return (fila as OcupanteCorreo) ?? null;
}

export interface ResultadoLiberar {
  success: boolean;
  error?: string;
  error_code?: 'NO_AUTORIZADO' | 'EN_USO' | 'LIBRE';
  nombre?: string;
  era_visible?: boolean;
}

/**
 * Suelta el correo para poder asignárselo a otro. Solo Administrador.
 *
 * `forzar` es para el caso feo: quitárselo a alguien que sigue trabajando lo
 * deja sin poder entrar, así que sin esa bandera la función se niega.
 */
export async function liberarCorreoOcupado(email: string, forzar = false): Promise<ResultadoLiberar> {
  const { data, error } = await supabase.rpc('liberar_correo_ocupado', {
    p_email: email.trim(),
    p_forzar: forzar,
  });
  if (error) {
    console.error('Error liberando el correo:', error);
    return { success: false, error: error.message };
  }
  return (data ?? { success: false, error: 'Sin respuesta' }) as ResultadoLiberar;
}

/**
 * Deja el alta en espera de que un Administrador la autorice.
 *
 * Quien no es Administrador no puede soltar el correo de nadie, pero tampoco
 * tiene por qué perder lo que ya capturó: se guarda entero y el Administrador
 * lo crea tal cual.
 */
export async function dejarSolicitudAlta(params: {
  datos: Record<string, unknown>;
  emailSolicitado: string;
  solicitadoPor: string;
  ocupadoPor?: string | null;
}): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase.from('usuarios_solicitudes_alta').insert({
    datos: params.datos,
    email_solicitado: params.emailSolicitado.trim(),
    solicitado_por: params.solicitadoPor,
    ocupado_por: params.ocupadoPor ?? null,
    motivo: 'correo_ocupado',
    estado: 'pendiente',
  });
  if (error) {
    console.error('Error dejando la solicitud de alta:', error);
    return { success: false, error: error.message };
  }
  return { success: true };
}
