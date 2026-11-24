/*
  # Corregir trigger de notificaciones de bienvenida

  1. Cambios
    - Eliminar función anterior que intentaba insertar en tablas inexistentes
    - Crear nueva función que llama a las edge functions existentes
    - Usar http extension para hacer llamadas a las funciones

  2. Notificaciones que se envían
    - Correo electrónico (vía enviar-correo-transaccional)
    - WhatsApp (vía enviar-whatsapp)
    - Notificación interna (campanita)
*/

-- Eliminar función anterior
DROP FUNCTION IF EXISTS send_welcome_notifications_on_activation() CASCADE;

-- Habilitar extensión http si no está habilitada
CREATE EXTENSION IF NOT EXISTS http WITH SCHEMA extensions;

-- Crear nueva función que llama a las edge functions
CREATE OR REPLACE FUNCTION send_welcome_notifications_on_activation()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_supabase_url text;
  v_service_key text;
  v_correo_payload jsonb;
  v_whatsapp_payload jsonb;
  v_whatsapp_message text;
BEGIN
  -- Solo proceder si el estado cambió a 'activo' y antes no lo era
  IF NEW.estado = 'activo' AND (OLD.estado IS NULL OR OLD.estado != 'activo') THEN
    RAISE LOG '[send_welcome] Usuario activado: % - %', NEW.id, NEW.email_laboral;

    -- Insertar notificación interna (campanita)
    BEGIN
      INSERT INTO notificaciones_internas (
        usuario_id,
        tipo,
        titulo,
        mensaje,
        url,
        leida,
        created_at
      ) VALUES (
        NEW.id,
        'bienvenida',
        '¡Bienvenido a MOVI Digital!',
        'Tu cuenta ha sido activada exitosamente. Explora todas las funcionalidades de la plataforma.',
        '/dashboard',
        false,
        now()
      );

      RAISE LOG '[send_welcome] Notificación interna creada';
    EXCEPTION WHEN OTHERS THEN
      RAISE LOG '[send_welcome] Error al crear notificación interna: %', SQLERRM;
    END;

    -- Preparar payload para correo
    v_correo_payload := jsonb_build_object(
      'tipo', 'bienvenida',
      'destinatario', NEW.email_laboral,
      'datos', jsonb_build_object(
        'nombre', NEW.nombre,
        'apellidos', NEW.apellidos,
        'email_laboral', NEW.email_laboral,
        'rol', NEW.rol,
        'puesto', COALESCE(NEW.puesto, ''),
        'nombre_plataforma', 'MOVI Digital',
        'fecha', to_char(now(), 'DD/MM/YYYY')
      )
    );

    -- Llamar a la función edge para enviar correo
    BEGIN
      RAISE LOG '[send_welcome] Enviando correo de bienvenida...';
      
      PERFORM extensions.http_post(
        url := (SELECT current_setting('app.settings.supabase_url', true) || '/functions/v1/enviar-correo-transaccional'),
        body := v_correo_payload::text,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
        )
      );
      
      RAISE LOG '[send_welcome] Correo de bienvenida enviado';
    EXCEPTION WHEN OTHERS THEN
      RAISE LOG '[send_welcome] Error al enviar correo: %', SQLERRM;
    END;

    -- Enviar WhatsApp si tiene número disponible
    IF (NEW.celular_personal IS NOT NULL AND NEW.celular_personal != '') 
       OR (NEW.celular_laboral IS NOT NULL AND NEW.celular_laboral != '') THEN
      
      BEGIN
        -- Construir mensaje de WhatsApp
        v_whatsapp_message := '¡Bienvenido ' || NEW.nombre || ' ' || NEW.apellidos || ' a MOVI Digital! 🎉' || E'\n\n' ||
                             'Tu cuenta ha sido activada exitosamente.' || E'\n\n' ||
                             '📧 Usuario: ' || NEW.email_laboral || E'\n' ||
                             '👤 Rol: ' || NEW.rol || E'\n\n' ||
                             'Ingresa a la plataforma para comenzar.';

        v_whatsapp_payload := jsonb_build_object(
          'phone', COALESCE(NEW.celular_personal, NEW.celular_laboral),
          'message', v_whatsapp_message
        );

        RAISE LOG '[send_welcome] Enviando WhatsApp de bienvenida...';
        
        PERFORM extensions.http_post(
          url := (SELECT current_setting('app.settings.supabase_url', true) || '/functions/v1/enviar-whatsapp'),
          body := v_whatsapp_payload::text,
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
          )
        );
        
        RAISE LOG '[send_welcome] WhatsApp de bienvenida enviado';
      EXCEPTION WHEN OTHERS THEN
        RAISE LOG '[send_welcome] Error al enviar WhatsApp: %', SQLERRM;
      END;
    END IF;

    RAISE LOG '[send_welcome] Notificaciones de bienvenida procesadas exitosamente';
  END IF;

  RETURN NEW;
END;
$$;

-- Eliminar trigger si existe
DROP TRIGGER IF EXISTS trigger_send_welcome_on_activation ON usuarios;

-- Crear trigger que se ejecuta DESPUÉS de actualizar un usuario
CREATE TRIGGER trigger_send_welcome_on_activation
  AFTER UPDATE ON usuarios
  FOR EACH ROW
  WHEN (NEW.estado = 'activo' AND (OLD.estado IS NULL OR OLD.estado != 'activo'))
  EXECUTE FUNCTION send_welcome_notifications_on_activation();

-- También crear trigger para usuarios creados directamente como activos
CREATE TRIGGER trigger_send_welcome_on_insert_active
  AFTER INSERT ON usuarios
  FOR EACH ROW
  WHEN (NEW.estado = 'activo')
  EXECUTE FUNCTION send_welcome_notifications_on_activation();

-- Comentarios
COMMENT ON FUNCTION send_welcome_notifications_on_activation() IS 
  'Envía notificaciones de bienvenida cuando un usuario es activado por primera vez o creado como activo';
COMMENT ON TRIGGER trigger_send_welcome_on_activation ON usuarios IS 
  'Trigger que envía notificaciones de bienvenida cuando el estado del usuario cambia a activo';
COMMENT ON TRIGGER trigger_send_welcome_on_insert_active ON usuarios IS 
  'Trigger que envía notificaciones de bienvenida cuando un usuario se crea directamente como activo';
