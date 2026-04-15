import { supabase } from './supabase';

/**
 * Función central para enviar notificaciones transaccionales.
 * Usa la función RPC `enviar_notificacion_completa` que respeta
 * los canales configurados en el catálogo unificado.
 *
 * @param codigoEvento - Código del tipo de notificación (ej: 'cuenta_activada')
 * @param userId - UUID del usuario destinatario
 * @param datosAdicionales - Variables para reemplazar en la plantilla
 * @param accionUrl - URL de la acción (opcional)
 */
export async function sendTransactionalNotification(
  codigoEvento: string,
  userId: string,
  datosAdicionales: Record<string, unknown> = {},
  accionUrl = '/dashboard'
) {
  try {
    const { error } = await supabase.rpc('enviar_notificacion_completa', {
      p_tipo_codigo: codigoEvento,
      p_user_id: userId,
      p_titulo: datosAdicionales['titulo'] as string || codigoEvento,
      p_mensaje: datosAdicionales['mensaje'] as string || '',
      p_modulo: datosAdicionales['modulo'] as string || 'sistema',
      p_datos_adicionales: datosAdicionales,
      p_accion_url: accionUrl,
    });

    if (error) {
      console.error(`[sendTransactionalNotification] Error al enviar '${codigoEvento}':`, error);
      return { success: false, error };
    }

    return { success: true };
  } catch (error) {
    console.error(`[sendTransactionalNotification] Error general:`, error);
    return { success: false, error };
  }
}

export async function enviarCuentaActivada(usuario: {
  nombre: string;
  apellidos: string;
  email: string;
  telefono?: string;
  userId: string;
}) {
  return sendTransactionalNotification(
    'cuenta_activada',
    usuario.userId,
    {
      nombre: usuario.nombre,
      apellidos: usuario.apellidos,
      email_laboral: usuario.email,
    },
    '/dashboard'
  );
}

export async function enviarRecuperacionPassword(
  usuario: { nombre: string; apellidos: string; email: string; userId: string },
  resetUrl: string
) {
  return sendTransactionalNotification(
    'password_reset',
    usuario.userId,
    {
      nombre: usuario.nombre,
      apellidos: usuario.apellidos,
      reset_url: resetUrl,
    },
    resetUrl
  );
}

export async function enviarNuevoEvento(
  usuario: { nombre: string; apellidos: string; email: string; userId: string },
  evento: { titulo: string; descripcion: string; fecha: string; hora: string; instructor?: string }
) {
  return sendTransactionalNotification(
    'nuevo_evento',
    usuario.userId,
    {
      nombre: usuario.nombre,
      apellidos: usuario.apellidos,
      titulo_evento: evento.titulo,
      descripcion_evento: evento.descripcion,
      fecha_evento: evento.fecha,
      hora_evento: evento.hora,
      instructor: evento.instructor || '',
    },
    '/seguros-education/aula-virtual'
  );
}

export async function enviarRecordatorioEvento(
  usuario: { nombre: string; apellidos: string; email: string; userId: string },
  evento: { titulo: string; fecha: string; hora: string }
) {
  return sendTransactionalNotification(
    'recordatorio_evento',
    usuario.userId,
    {
      nombre: usuario.nombre,
      apellidos: usuario.apellidos,
      titulo_evento: evento.titulo,
      fecha_evento: evento.fecha,
      hora_evento: evento.hora,
    },
    '/seguros-education/aula-virtual'
  );
}

export async function enviarCancelacionEvento(
  usuario: { nombre: string; apellidos: string; email: string; userId: string },
  evento: { titulo: string; motivo?: string }
) {
  return sendTransactionalNotification(
    'cancelacion_evento',
    usuario.userId,
    {
      nombre: usuario.nombre,
      apellidos: usuario.apellidos,
      titulo_evento: evento.titulo,
      motivo_cancelacion: evento.motivo || 'No especificado',
    },
    '/seguros-education'
  );
}
