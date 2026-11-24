/*
  # Actualizar trigger de activación para incluir URL de página web

  1. Cambios
    - Agregar la URL de página web en las notificaciones
    - No incluir contraseña (ya que el usuario ya tiene una cuando es activado posteriormente)
    - Obtener el nombre de la oficina para mostrar en las notificaciones

  2. Notas
    - La contraseña solo se envía cuando el usuario es creado como activo directamente (desde create-user edge function)
    - Cuando un gerente activa a un usuario pendiente, no se envía la contraseña
*/

-- Recrear función con soporte para página web
DROP FUNCTION IF EXISTS send_welcome_notifications_on_activation() CASCADE;

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
  v_pagina_web text;
  v_oficina_nombre text;
BEGIN
  -- Solo proceder si el estado cambió a 'activo' y antes no lo era
  -- Este trigger solo se ejecuta cuando un gerente activa a un usuario previamente pendiente
  IF NEW.estado = 'activo' AND OLD.estado IS NOT NULL AND OLD.estado != 'activo' THEN
    RAISE LOG '[send_welcome] Usuario activado por gerente: % - %', NEW.id, NEW.email_laboral;

    -- Construir URL de página web
    IF NEW.web_slug IS NOT NULL AND NEW.web_slug != '' THEN
      v_pagina_web := 'https://agentedeseguros.online/' || NEW.web_slug;
    ELSE
      v_pagina_web := 'No configurada aún';
    END IF;

    -- Obtener nombre de oficina
    IF NEW.oficina_id IS NOT NULL THEN
      SELECT nombre INTO v_oficina_nombre
      FROM oficinas
      WHERE id = NEW.oficina_id;
    END IF;

    IF v_oficina_nombre IS NULL THEN
      v_oficina_nombre := 'No asignada';
    END IF;

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

    -- Preparar payload para correo (SIN contraseña)
    v_correo_payload := jsonb_build_object(
      'tipo', 'cuenta_activada',
      'destinatario', NEW.email_laboral,
      'datos', jsonb_build_object(
        'nombre', NEW.nombre,
        'apellidos', NEW.apellidos,
        'email_laboral', NEW.email_laboral,
        'password', 'La que configuraste al registrarte',
        'rol', NEW.rol,
        'oficina', v_oficina_nombre,
        'pagina_web', v_pagina_web,
        'puesto', COALESCE(NEW.puesto, ''),
        'nombre_plataforma', 'MOVI Digital',
        'fecha', to_char(now(), 'DD/MM/YYYY')
      )
    );

    -- Llamar a la función edge para enviar correo
    BEGIN
      RAISE LOG '[send_welcome] Enviando correo de activación...';
      
      PERFORM extensions.http_post(
        url := (SELECT current_setting('app.settings.supabase_url', true) || '/functions/v1/enviar-correo-transaccional'),
        body := v_correo_payload::text,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
        )
      );
      
      RAISE LOG '[send_welcome] Correo de activación enviado';
    EXCEPTION WHEN OTHERS THEN
      RAISE LOG '[send_welcome] Error al enviar correo: %', SQLERRM;
    END;

    -- Enviar WhatsApp si tiene número disponible
    IF (NEW.celular_personal IS NOT NULL AND NEW.celular_personal != '') 
       OR (NEW.celular_laboral IS NOT NULL AND NEW.celular_laboral != '') THEN
      
      BEGIN
        -- Construir mensaje de WhatsApp (SIN contraseña)
        v_whatsapp_message := '¡Bienvenido ' || NEW.nombre || ' ' || NEW.apellidos || ' a MOVI Digital! 🎉' || E'\n\n' ||
                             'Tu cuenta ha sido activada exitosamente.' || E'\n\n' ||
                             '📧 Usuario: ' || NEW.email_laboral || E'\n' ||
                             '👤 Rol: ' || NEW.rol || E'\n' ||
                             '🌐 Tu página web: ' || v_pagina_web || E'\n\n' ||
                             'Ingresa a la plataforma con tu contraseña registrada.';

        v_whatsapp_payload := jsonb_build_object(
          'phone', COALESCE(NEW.celular_personal, NEW.celular_laboral),
          'message', v_whatsapp_message
        );

        RAISE LOG '[send_welcome] Enviando WhatsApp de activación...';
        
        PERFORM extensions.http_post(
          url := (SELECT current_setting('app.settings.supabase_url', true) || '/functions/v1/enviar-whatsapp'),
          body := v_whatsapp_payload::text,
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
          )
        );
        
        RAISE LOG '[send_welcome] WhatsApp de activación enviado';
      EXCEPTION WHEN OTHERS THEN
        RAISE LOG '[send_welcome] Error al enviar WhatsApp: %', SQLERRM;
      END;
    END IF;

    RAISE LOG '[send_welcome] Notificaciones de activación procesadas exitosamente';
  END IF;

  RETURN NEW;
END;
$$;

-- Recrear trigger (solo para UPDATE de estado pendiente -> activo)
DROP TRIGGER IF EXISTS trigger_send_welcome_on_activation ON usuarios;

CREATE TRIGGER trigger_send_welcome_on_activation
  AFTER UPDATE ON usuarios
  FOR EACH ROW
  WHEN (NEW.estado = 'activo' AND OLD.estado IS NOT NULL AND OLD.estado != 'activo')
  EXECUTE FUNCTION send_welcome_notifications_on_activation();

-- Eliminar el trigger de INSERT (ya no lo necesitamos porque create-user lo maneja)
DROP TRIGGER IF EXISTS trigger_send_welcome_on_insert_active ON usuarios;

-- Comentarios
COMMENT ON FUNCTION send_welcome_notifications_on_activation() IS 
  'Envía notificaciones de bienvenida cuando un usuario pendiente es activado por un gerente. La contraseña no se incluye ya que el usuario ya la tiene.';
COMMENT ON TRIGGER trigger_send_welcome_on_activation ON usuarios IS 
  'Trigger que envía notificaciones cuando un usuario pendiente es activado por un gerente';
