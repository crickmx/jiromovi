import { supabase } from './supabase';

export interface NotificationParams {
  user_id: string;
  titulo: string;
  mensaje: string;
  modulo: string;
  icono?: string;
  accion_url?: string;
  accion_texto?: string;
}

export async function crearNotificacion(params: NotificationParams) {
  try {
    const { error } = await supabase.from('notificaciones').insert({
      user_id: params.user_id,
      titulo: params.titulo,
      mensaje: params.mensaje,
      modulo: params.modulo,
      icono: params.icono || 'bell',
      accion_url: params.accion_url,
      accion_texto: params.accion_texto || 'Ver más',
    });

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Error creating notification:', error);
    return { success: false, error };
  }
}

export async function crearNotificacionGlobal(
  titulo: string,
  mensaje: string,
  accion_url: string | null,
  destinatarios: {
    tipo: 'todos' | 'oficina' | 'rol' | 'usuario';
    oficina_id?: string;
    rol?: string;
    user_id?: string;
  },
  enviado_por: string,
  enviar_whatsapp: boolean = false
) {
  try {
    const { error } = await supabase.rpc('enviar_notificacion_global', {
      p_titulo: titulo,
      p_mensaje: mensaje,
      p_accion_url: accion_url,
      p_destinatarios: destinatarios,
      p_enviado_por: enviado_por,
      p_enviar_whatsapp: enviar_whatsapp,
    });

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Error sending global notification:', error);
    return { success: false, error };
  }
}

// Notification templates for different modules

export const NotificationTemplates = {
  // Email notifications
  nuevoCorreo: (remitente: string, user_id: string) =>
    crearNotificacion({
      user_id,
      titulo: 'Nuevo correo recibido',
      mensaje: `Has recibido un nuevo correo de ${remitente}.`,
      modulo: 'Correos',
      icono: 'mail',
      accion_url: '/gestor-emails',
      accion_texto: 'Ver correo',
    }),

  correoEnviado: (user_id: string) =>
    crearNotificacion({
      user_id,
      titulo: 'Correo enviado',
      mensaje: 'Tu correo programado fue enviado correctamente.',
      modulo: 'Correos',
      icono: 'mail',
      accion_url: '/gestor-emails',
      accion_texto: 'Ver enviados',
    }),

  // Chat notifications
  nuevoMensaje: (nombre: string, user_id: string, chat_id: string) =>
    crearNotificacion({
      user_id,
      titulo: 'Nuevo mensaje',
      mensaje: `Nuevo mensaje de ${nombre}.`,
      modulo: 'Chat',
      icono: 'message',
      accion_url: `/chat?id=${chat_id}`,
      accion_texto: 'Abrir chat',
    }),

  agregadoAGrupo: (nombre: string, grupo: string, user_id: string, chat_id: string) =>
    crearNotificacion({
      user_id,
      titulo: 'Agregado a grupo',
      mensaje: `${nombre} te ha agregado al grupo ${grupo}.`,
      modulo: 'Chat',
      icono: 'users',
      accion_url: `/chat?id=${chat_id}`,
      accion_texto: 'Ver grupo',
    }),

  // Vacaciones notifications
  solicitudEnviada: (fechaInicio: string, fechaFin: string, user_id: string) =>
    crearNotificacion({
      user_id,
      titulo: 'Solicitud de vacaciones enviada',
      mensaje: `Has solicitado vacaciones del ${fechaInicio} al ${fechaFin}.`,
      modulo: 'Vacaciones',
      icono: 'calendar',
      accion_url: '/vacaciones',
      accion_texto: 'Ver solicitud',
    }),

  solicitudPendiente: (empleado: string, user_id: string) =>
    crearNotificacion({
      user_id,
      titulo: 'Solicitud de vacaciones pendiente',
      mensaje: `${empleado} tiene una solicitud de vacaciones pendiente.`,
      modulo: 'Vacaciones',
      icono: 'calendar',
      accion_url: '/vacaciones',
      accion_texto: 'Revisar',
    }),

  solicitudAprobada: (user_id: string) =>
    crearNotificacion({
      user_id,
      titulo: 'Solicitud aprobada',
      mensaje: 'Tu solicitud de vacaciones fue aprobada.',
      modulo: 'Vacaciones',
      icono: 'check-circle',
      accion_url: '/vacaciones',
      accion_texto: 'Ver historial',
    }),

  solicitudRechazada: (user_id: string) =>
    crearNotificacion({
      user_id,
      titulo: 'Solicitud rechazada',
      mensaje: 'Tu solicitud de vacaciones fue rechazada.',
      modulo: 'Vacaciones',
      icono: 'x-circle',
      accion_url: '/vacaciones',
      accion_texto: 'Ver detalle',
    }),

  // Seguros Education notifications
  nuevaSesion: (titulo: string, fecha: string, hora: string, user_id: string) =>
    crearNotificacion({
      user_id,
      titulo: 'Nueva sesión en Aula Virtual',
      mensaje: `${titulo} - ${fecha} a las ${hora}.`,
      modulo: 'Educación',
      icono: 'video',
      accion_url: '/seguros-education/aula-virtual',
      accion_texto: 'Ver detalles',
    }),

  transmisionIniciada: (titulo: string, user_id: string, session_id: string) =>
    crearNotificacion({
      user_id,
      titulo: 'Transmisión en vivo',
      mensaje: `Transmisión iniciada: ${titulo}.`,
      modulo: 'Educación',
      icono: 'radio',
      accion_url: `/seguros-education/aula-virtual?session=${session_id}`,
      accion_texto: 'Ingresar ahora',
    }),

  grabacionDisponible: (titulo: string, user_id: string, lesson_id: string) =>
    crearNotificacion({
      user_id,
      titulo: 'Grabación disponible',
      mensaje: `La grabación "${titulo}" está disponible en On Demand.`,
      modulo: 'Educación',
      icono: 'video',
      accion_url: `/seguros-education/on-demand`,
      accion_texto: 'Ver curso',
    }),

  cursoCompletado: (titulo: string, user_id: string) =>
    crearNotificacion({
      user_id,
      titulo: '¡Curso completado!',
      mensaje: `Has completado el curso "${titulo}". ¡Felicidades!`,
      modulo: 'Educación',
      icono: 'award',
      accion_url: '/seguros-education',
      accion_texto: 'Ver progreso',
    }),

  // Espacio JIRO notifications
  reservaSolicitada: (area: string, fecha: string, user_id: string) =>
    crearNotificacion({
      user_id,
      titulo: 'Reserva solicitada',
      mensaje: `Has solicitado el área ${area} para ${fecha}.`,
      modulo: 'Espacio JIRO',
      icono: 'map-pin',
      accion_url: '/espacio-jiro',
      accion_texto: 'Ver reserva',
    }),

  reservaAprobada: (area: string, user_id: string) =>
    crearNotificacion({
      user_id,
      titulo: 'Reserva aprobada',
      mensaje: `Tu reserva en ${area} ha sido aprobada.`,
      modulo: 'Espacio JIRO',
      icono: 'check-circle',
      accion_url: '/espacio-jiro',
      accion_texto: 'Ver detalles',
    }),

  reservaRechazada: (area: string, user_id: string) =>
    crearNotificacion({
      user_id,
      titulo: 'Reserva rechazada',
      mensaje: `Tu reserva en ${area} fue rechazada.`,
      modulo: 'Espacio JIRO',
      icono: 'x-circle',
      accion_url: '/espacio-jiro',
      accion_texto: 'Ver detalle',
    }),

  recordatorioReserva: (area: string, user_id: string) =>
    crearNotificacion({
      user_id,
      titulo: 'Recordatorio de reserva',
      mensaje: `Tu reserva en ${area} inicia en 15 minutos.`,
      modulo: 'Espacio JIRO',
      icono: 'clock',
      accion_url: '/espacio-jiro',
      accion_texto: 'Ver detalles',
    }),

  // Publicidad notifications
  nuevaPlantilla: (categoria: string, user_id: string) =>
    crearNotificacion({
      user_id,
      titulo: 'Nueva plantilla disponible',
      mensaje: `Nueva plantilla en la categoría ${categoria}.`,
      modulo: 'Publicidad',
      icono: 'palette',
      accion_url: '/publicidad',
      accion_texto: 'Ver plantilla',
    }),

  disenoGuardado: (user_id: string) =>
    crearNotificacion({
      user_id,
      titulo: 'Diseño guardado',
      mensaje: 'Tu diseño se guardó en Diseños Personalizados.',
      modulo: 'Publicidad',
      icono: 'save',
      accion_url: '/publicidad',
      accion_texto: 'Ver diseño',
    }),

  // Accesos Nacional notifications
  nuevoAcceso: (aseguradora: string, user_id: string) =>
    crearNotificacion({
      user_id,
      titulo: 'Nuevo acceso agregado',
      mensaje: `Nuevo acceso agregado para ${aseguradora}.`,
      modulo: 'Accesos Nacional',
      icono: 'key',
      accion_url: '/accesos-nacional',
      accion_texto: 'Ver detalles',
    }),

  accesoActualizado: (usuario: string, aseguradora: string, user_id: string) =>
    crearNotificacion({
      user_id,
      titulo: 'Acceso actualizado',
      mensaje: `${usuario} actualizó los accesos de ${aseguradora}.`,
      modulo: 'Accesos Nacional',
      icono: 'refresh',
      accion_url: '/accesos-nacional',
      accion_texto: 'Ver cambios',
    }),

  // Firma Email notifications
  firmaActualizada: (user_id: string) =>
    crearNotificacion({
      user_id,
      titulo: 'Firma actualizada',
      mensaje: 'Tu firma de correo ha sido actualizada.',
      modulo: 'Firma Email',
      icono: 'edit',
      accion_url: '/firmas-email',
      accion_texto: 'Ver firma',
    }),

  nuevaPlantillaAsignada: (user_id: string) =>
    crearNotificacion({
      user_id,
      titulo: 'Nueva plantilla asignada',
      mensaje: 'Se te ha asignado una nueva plantilla de firma.',
      modulo: 'Firma Email',
      icono: 'file-text',
      accion_url: '/firmas-email',
      accion_texto: 'Ver firma',
    }),

  // Contactos notifications
  nuevoContacto: (nombre: string, email: string, user_id: string) =>
    crearNotificacion({
      user_id,
      titulo: 'Nuevo contacto agregado',
      mensaje: `Se agregó un nuevo contacto: ${nombre} (${email}).`,
      modulo: 'Contactos',
      icono: 'user-plus',
      accion_url: '/contactos',
      accion_texto: 'Ver contacto',
    }),
};
