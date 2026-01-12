/*
  # Arreglar envío de notificaciones departamentales vs generales

  1. Cambios
    - Actualizar función enviar_notificacion_completa para manejar ambos tipos:
      * Notificaciones generales (permite_destinatarios_custom = false):
        Se envían al usuario especificado (p_user_id)
      * Notificaciones departamentales (permite_destinatarios_custom = true):
        Se envían a los destinatarios configurados en correo_destinatarios_notificacion

  2. Validaciones
    - Si es departamental y no tiene destinatarios, no enviar y registrar warning
    - Si es general, enviar siempre al usuario especificado
*/

-- Eliminar función existente
DROP FUNCTION IF EXISTS enviar_notificacion_completa(text, uuid, text, text, text, jsonb, text);

-- Crear función actualizada para manejar notificaciones departamentales
CREATE OR REPLACE FUNCTION enviar_notificacion_completa(
  p_tipo_codigo text,
  p_user_id uuid,
  p_titulo text,
  p_mensaje text,
  p_modulo text,
  p_datos_adicionales jsonb DEFAULT '{}'::jsonb,
  p_accion_url text DEFAULT NULL
)
RETURNS uuid[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_notif_ids uuid[] := ARRAY[]::uuid[];
  v_notif_id uuid;
  v_user_record record;
  v_tipo_notif record;
  v_destinatarios record;
  v_telefono text;
  v_correo text;
  v_datos jsonb;
  v_supabase_url text := current_setting('app.settings.supabase_url', true);
  v_anon_key text := current_setting('app.settings.supabase_anon_key', true);
  v_request_id bigint;
  v_permite_custom boolean;
BEGIN
  IF v_supabase_url IS NULL OR v_supabase_url = '' THEN
    v_supabase_url := 'https://qhwvuuyjhcennqccgvse.supabase.co';
  END IF;

  IF v_anon_key IS NULL OR v_anon_key = '' THEN
    v_anon_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFod3Z1dXlqaGNlbm5xY2NndnNlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE3MjA5OTAsImV4cCI6MjA3NzI5Njk5MH0.bIlGsgeAC6oxGUalODg0C5-l6KaJip0wWa9IbQ7MjTQ';
  END IF;

  -- Obtener configuración del tipo de notificación
  SELECT
    id,
    codigo,
    nombre,
    activo,
    enviar_correo as enviar_por_correo,
    enviar_whatsapp as enviar_por_whatsapp,
    enviar_notificacion,
    permite_destinatarios_custom
  INTO v_tipo_notif
  FROM correo_tipos_notificacion
  WHERE codigo = p_tipo_codigo;

  IF NOT FOUND THEN
    RAISE WARNING '[notif] Tipo de notificación no encontrado: %', p_tipo_codigo;
    RETURN v_notif_ids;
  END IF;

  IF v_tipo_notif.activo = false THEN
    RAISE WARNING '[notif] Tipo de notificación inactivo: %', p_tipo_codigo;
    RETURN v_notif_ids;
  END IF;

  v_permite_custom := v_tipo_notif.permite_destinatarios_custom;

  -- Si es notificación DEPARTAMENTAL (permite_destinatarios_custom = true)
  IF v_permite_custom THEN
    RAISE LOG '[notif] Notificación DEPARTAMENTAL: % - buscando destinatarios configurados', p_tipo_codigo;

    -- Buscar destinatarios configurados para este tipo
    FOR v_destinatarios IN
      SELECT
        u.id,
        u.nombre,
        u.apellidos,
        u.nombre_completo,
        u.celular_laboral,
        u.celular_personal,
        u.email_laboral,
        u.email_personal
      FROM correo_destinatarios_notificacion cdn
      JOIN usuarios u ON u.id = cdn.usuario_id
      WHERE cdn.tipo_notificacion_id = v_tipo_notif.id
        AND u.estado = 'activo'
    LOOP
      RAISE LOG '[notif] Enviando a destinatario departamental: % (ID: %)', v_destinatarios.email_laboral, v_destinatarios.id;

      -- Insertar notificación campanita si está habilitada
      IF v_tipo_notif.enviar_notificacion THEN
        INSERT INTO notificaciones (
          usuario_id,
          titulo,
          mensaje,
          tipo,
          tipo_codigo,
          modulo,
          accion_url,
          leida,
          prioridad
        )
        VALUES (
          v_destinatarios.id,
          p_titulo,
          p_mensaje,
          'info',
          p_tipo_codigo,
          p_modulo,
          p_accion_url,
          false,
          'normal'
        )
        RETURNING id INTO v_notif_id;

        v_notif_ids := array_append(v_notif_ids, v_notif_id);
      END IF;

      -- Preparar datos para envío
      v_telefono := COALESCE(v_destinatarios.celular_laboral, v_destinatarios.celular_personal);
      v_correo := v_destinatarios.email_laboral;

      IF v_correo IS NULL OR v_correo = '' THEN
        RAISE WARNING '[notif] Destinatario % no tiene email_laboral', v_destinatarios.id;
        CONTINUE;
      END IF;

      v_datos := p_datos_adicionales || jsonb_build_object(
        'nombre', COALESCE(v_destinatarios.nombre_completo, v_destinatarios.nombre, 'Usuario'),
        'email_laboral', v_correo,
        'telefono_movil', COALESCE(v_telefono, ''),
        'nombre_plataforma', 'MOVI Digital',
        'fecha', to_char(CURRENT_DATE, 'DD/MM/YYYY')
      );

      -- Enviar correo si está habilitado
      IF v_tipo_notif.enviar_por_correo THEN
        BEGIN
          SELECT net.http_post(
            url := v_supabase_url || '/functions/v1/notification-dispatcher',
            headers := jsonb_build_object(
              'Content-Type', 'application/json',
              'Authorization', 'Bearer ' || v_anon_key
            ),
            body := jsonb_build_object(
              'canal', 'correo',
              'tipo_codigo', p_tipo_codigo,
              'destinatario_email', v_correo,
              'destinatario_nombre', v_destinatarios.nombre_completo,
              'datos', v_datos
            ),
            timeout_milliseconds := 5000
          ) INTO v_request_id;

          RAISE LOG '[notif] Correo enviado a destinatario departamental: %', v_correo;
        EXCEPTION WHEN OTHERS THEN
          RAISE WARNING '[notif] Error al enviar correo a %: %', v_correo, SQLERRM;
        END;
      END IF;

      -- Enviar WhatsApp si está habilitado y hay teléfono
      IF v_tipo_notif.enviar_por_whatsapp AND v_telefono IS NOT NULL AND v_telefono != '' THEN
        BEGIN
          SELECT net.http_post(
            url := v_supabase_url || '/functions/v1/notification-dispatcher',
            headers := jsonb_build_object(
              'Content-Type', 'application/json',
              'Authorization', 'Bearer ' || v_anon_key
            ),
            body := jsonb_build_object(
              'canal', 'whatsapp',
              'tipo_codigo', p_tipo_codigo,
              'destinatario_telefono', v_telefono,
              'destinatario_nombre', v_destinatarios.nombre_completo,
              'datos', v_datos
            ),
            timeout_milliseconds := 5000
          ) INTO v_request_id;

          RAISE LOG '[notif] WhatsApp enviado a destinatario departamental: %', v_telefono;
        EXCEPTION WHEN OTHERS THEN
          RAISE WARNING '[notif] Error al enviar WhatsApp a %: %', v_telefono, SQLERRM;
        END;
      END IF;
    END LOOP;

    -- Si no hay destinatarios configurados, advertir
    IF array_length(v_notif_ids, 1) IS NULL THEN
      RAISE WARNING '[notif] Notificación departamental % no tiene destinatarios configurados. No se enviará.', p_tipo_codigo;
    END IF;

  -- Si es notificación GENERAL (permite_destinatarios_custom = false)
  ELSE
    RAISE LOG '[notif] Notificación GENERAL: % - enviando al usuario afectado (ID: %)', p_tipo_codigo, p_user_id;

    -- Obtener datos del usuario afectado
    SELECT
      id,
      nombre,
      apellidos,
      nombre_completo,
      celular_laboral,
      celular_personal,
      email_laboral,
      email_personal
    INTO v_user_record
    FROM usuarios
    WHERE id = p_user_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION '[notif] Usuario no encontrado: %', p_user_id;
    END IF;

    -- Insertar notificación campanita si está habilitada
    IF v_tipo_notif.enviar_notificacion THEN
      INSERT INTO notificaciones (
        usuario_id,
        titulo,
        mensaje,
        tipo,
        tipo_codigo,
        modulo,
        accion_url,
        leida,
        prioridad
      )
      VALUES (
        p_user_id,
        p_titulo,
        p_mensaje,
        'info',
        p_tipo_codigo,
        p_modulo,
        p_accion_url,
        false,
        'normal'
      )
      RETURNING id INTO v_notif_id;

      v_notif_ids := array_append(v_notif_ids, v_notif_id);
    END IF;

    -- Preparar datos para envío
    v_telefono := COALESCE(v_user_record.celular_laboral, v_user_record.celular_personal);
    v_correo := v_user_record.email_laboral;

    IF v_correo IS NULL OR v_correo = '' THEN
      RAISE WARNING '[notif] Usuario % no tiene email_laboral', p_user_id;
      RETURN v_notif_ids;
    END IF;

    v_datos := p_datos_adicionales || jsonb_build_object(
      'nombre', COALESCE(v_user_record.nombre_completo, v_user_record.nombre, 'Usuario'),
      'email_laboral', v_correo,
      'telefono_movil', COALESCE(v_telefono, ''),
      'nombre_plataforma', 'MOVI Digital',
      'fecha', to_char(CURRENT_DATE, 'DD/MM/YYYY')
    );

    RAISE LOG '[notif] Enviando notificación general tipo % a %', p_tipo_codigo, v_correo;

    -- Enviar correo si está habilitado
    IF v_tipo_notif.enviar_por_correo THEN
      BEGIN
        SELECT net.http_post(
          url := v_supabase_url || '/functions/v1/notification-dispatcher',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || v_anon_key
          ),
          body := jsonb_build_object(
            'canal', 'correo',
            'tipo_codigo', p_tipo_codigo,
            'destinatario_email', v_correo,
            'destinatario_nombre', v_user_record.nombre_completo,
            'datos', v_datos
          ),
          timeout_milliseconds := 5000
        ) INTO v_request_id;

        RAISE LOG '[notif] Correo enviado vía notification-dispatcher';
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING '[notif] Error al enviar correo: %', SQLERRM;
      END;
    END IF;

    -- Enviar WhatsApp si está habilitado y hay teléfono
    IF v_tipo_notif.enviar_por_whatsapp AND v_telefono IS NOT NULL AND v_telefono != '' THEN
      BEGIN
        SELECT net.http_post(
          url := v_supabase_url || '/functions/v1/notification-dispatcher',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || v_anon_key
          ),
          body := jsonb_build_object(
            'canal', 'whatsapp',
            'tipo_codigo', p_tipo_codigo,
            'destinatario_telefono', v_telefono,
            'destinatario_nombre', v_user_record.nombre_completo,
            'datos', v_datos
          ),
          timeout_milliseconds := 5000
        ) INTO v_request_id;

        RAISE LOG '[notif] WhatsApp enviado vía notification-dispatcher';
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING '[notif] Error al enviar WhatsApp: %', SQLERRM;
      END;
    END IF;
  END IF;

  RETURN v_notif_ids;
END;
$$;

COMMENT ON FUNCTION enviar_notificacion_completa IS
  'Envía notificación completa usando el sistema de notificaciones transaccionales.
  Para notificaciones generales (permite_destinatarios_custom=false): envía al usuario especificado.
  Para notificaciones departamentales (permite_destinatarios_custom=true): envía a destinatarios configurados.';