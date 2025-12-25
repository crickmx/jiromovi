import { supabase } from './supabase';

/**
 * Envía una notificación transaccional usando el sistema de correo_tipos_notificacion
 *
 * @param tipo - Código del tipo de notificación (ej: 'bienvenida', 'cuenta_activada')
 * @param destinatario - Información del destinatario
 * @param datos - Variables para reemplazar en la plantilla
 */
export async function enviarNotificacionTransaccional(
  tipo: string,
  destinatario: {
    nombre: string;
    apellidos?: string;
    email: string;
    telefono?: string;
  },
  datos: Record<string, any> = {}
) {
  try {
    console.log(`📧 Enviando notificación transaccional: ${tipo}`);
    console.log('Destinatario:', destinatario);
    console.log('Datos adicionales:', datos);

    // Verificar que el tipo de notificación esté activo
    const { data: tipoNotif, error: tipoError } = await supabase
      .from('correo_tipos_notificacion')
      .select('id, codigo, nombre, activo, enviar_correo, enviar_whatsapp, enviar_notificacion')
      .eq('codigo', tipo)
      .maybeSingle();

    if (tipoError || !tipoNotif) {
      console.error(`❌ Tipo de notificación '${tipo}' no encontrado:`, tipoError);
      return { success: false, error: 'Tipo de notificación no encontrado' };
    }

    if (!tipoNotif.activo) {
      console.warn(`⚠️ Tipo de notificación '${tipo}' está desactivado`);
      return { success: false, error: 'Tipo de notificación desactivado' };
    }

    // Preparar datos para el envío
    const datosCompletos = {
      ...datos,
      nombre: destinatario.nombre,
      apellidos: destinatario.apellidos || '',
      email_laboral: destinatario.email,
      telefono_movil: destinatario.telefono || '',
      nombre_plataforma: 'MOVI Digital',
      fecha: new Date().toLocaleDateString('es-MX'),
    };

    let enviado = false;

    // Enviar notificación interna (campanita) si está habilitado
    if (tipoNotif.enviar_notificacion) {
      try {
        // Buscar el usuario por email para obtener su ID
        const { data: usuarioData } = await supabase
          .from('usuarios')
          .select('id')
          .eq('email_laboral', destinatario.email)
          .maybeSingle();

        if (usuarioData) {
          const { error: notifError } = await supabase
            .from('notificaciones_globales')
            .insert({
              tipo: tipo,
              titulo: tipoNotif.nombre,
              mensaje: `${datosCompletos.titulo_evento || datosCompletos.asunto || 'Nueva notificación'}`,
              destinatario_id: usuarioData.id,
              leido: false,
            });

          if (!notifError) {
            console.log(`🔔 Notificación interna enviada exitosamente a ${destinatario.nombre}`);
            enviado = true;
          } else {
            console.error(`❌ Error al enviar notificación interna:`, notifError);
          }
        }
      } catch (error) {
        console.error('❌ Error en envío de notificación interna:', error);
      }
    }

    // Enviar por correo si está habilitado
    if (tipoNotif.enviar_correo) {
      try {
        const emailUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/enviar-correo-transaccional`;

        const { data: { session } } = await supabase.auth.getSession();

        const response = await fetch(emailUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            tipo,
            destinatario: destinatario.email,
            datos: datosCompletos,
          }),
        });

        if (response.ok) {
          console.log(`✅ Correo enviado exitosamente a ${destinatario.email}`);
          enviado = true;
        } else {
          const errorText = await response.text();
          console.error(`❌ Error al enviar correo:`, errorText);
        }
      } catch (error) {
        console.error('❌ Error en envío de correo:', error);
      }
    }

    // Enviar por WhatsApp si está habilitado y hay teléfono
    if (tipoNotif.enviar_whatsapp && destinatario.telefono) {
      try {
        const whatsappUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/enviar-whatsapp`;

        const { data: { session } } = await supabase.auth.getSession();

        const response = await fetch(whatsappUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            tipo,
            numero: destinatario.telefono,
            datos: datosCompletos,
          }),
        });

        if (response.ok) {
          console.log(`✅ WhatsApp enviado exitosamente a ${destinatario.telefono}`);
          enviado = true;
        } else {
          const errorText = await response.text();
          console.error(`❌ Error al enviar WhatsApp:`, errorText);
        }
      } catch (error) {
        console.error('❌ Error en envío de WhatsApp:', error);
      }
    }

    return { success: enviado };
  } catch (error) {
    console.error('❌ Error general en enviarNotificacionTransaccional:', error);
    return { success: false, error };
  }
}

// Funciones específicas para cada tipo de notificación

/**
 * ❌ OBSOLETO: No usar enviarBienvenida
 * Se debe usar enviarCuentaActivada cuando se aprueba un usuario
 */

export async function enviarCuentaActivada(usuario: {
  nombre: string;
  apellidos: string;
  email: string;
  telefono?: string;
}) {
  return enviarNotificacionTransaccional('cuenta_activada', {
    nombre: usuario.nombre,
    apellidos: usuario.apellidos,
    email: usuario.email,
    telefono: usuario.telefono,
  });
}

export async function enviarRecuperacionPassword(usuario: {
  nombre: string;
  apellidos: string;
  email: string;
  telefono?: string;
}, resetUrl: string) {
  return enviarNotificacionTransaccional('recuperacion_password', {
    nombre: usuario.nombre,
    apellidos: usuario.apellidos,
    email: usuario.email,
    telefono: usuario.telefono,
  }, {
    reset_url: resetUrl,
  });
}

export async function enviarNuevoEvento(usuario: {
  nombre: string;
  apellidos: string;
  email: string;
  telefono?: string;
}, evento: {
  titulo: string;
  descripcion: string;
  fecha: string;
  hora: string;
  instructor?: string;
  obligatorio?: boolean;
}) {
  return enviarNotificacionTransaccional(
    evento.obligatorio ? 'capacitacion_obligatoria' : 'nuevo_evento',
    {
      nombre: usuario.nombre,
      apellidos: usuario.apellidos,
      email: usuario.email,
      telefono: usuario.telefono,
    },
    {
      titulo_evento: evento.titulo,
      descripcion_evento: evento.descripcion,
      fecha_evento: evento.fecha,
      hora_evento: evento.hora,
      instructor: evento.instructor || '',
    }
  );
}

export async function enviarRecordatorioEvento(usuario: {
  nombre: string;
  apellidos: string;
  email: string;
  telefono?: string;
}, evento: {
  titulo: string;
  fecha: string;
  hora: string;
}) {
  return enviarNotificacionTransaccional('recordatorio_evento', {
    nombre: usuario.nombre,
    apellidos: usuario.apellidos,
    email: usuario.email,
    telefono: usuario.telefono,
  }, {
    titulo_evento: evento.titulo,
    fecha_evento: evento.fecha,
    hora_evento: evento.hora,
  });
}

export async function enviarCancelacionEvento(usuario: {
  nombre: string;
  apellidos: string;
  email: string;
  telefono?: string;
}, evento: {
  titulo: string;
  motivo?: string;
}) {
  return enviarNotificacionTransaccional('cancelacion_evento', {
    nombre: usuario.nombre,
    apellidos: usuario.apellidos,
    email: usuario.email,
    telefono: usuario.telefono,
  }, {
    titulo_evento: evento.titulo,
    motivo_cancelacion: evento.motivo || 'No especificado',
  });
}
