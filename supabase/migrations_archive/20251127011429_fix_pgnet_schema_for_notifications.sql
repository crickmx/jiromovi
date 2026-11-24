/*
  # Corregir schema de pg_net para notificaciones WhatsApp
  
  ## Problema
  Las funciones estaban usando `extensions.http_post` pero la función
  correcta está en el schema `net.http_post`
  
  ## Solución
  1. Actualizar enviar_notificacion_global para usar net.http_post
  2. Actualizar enviar_notificacion_individual para usar net.http_post
  
  ## Impacto
  Esto corregirá el envío de WhatsApp en:
  - Notificaciones globales (Centro de Notificaciones)
  - Notificaciones individuales (todas las notificaciones del sistema)
*/

-- =====================================================
-- 1. Corregir función enviar_notificacion_global
-- =====================================================

CREATE OR REPLACE FUNCTION enviar_notificacion_global(
  p_titulo text,
  p_mensaje text,
  p_accion_url text,
  p_destinatarios jsonb,
  p_enviado_por uuid,
  p_enviar_whatsapp boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_notif_global_id uuid;
  v_user_record record;
  v_whatsapp_enviados integer := 0;
  v_whatsapp_fallidos integer := 0;
  v_telefono text;
  v_supabase_url text := 'https://qhwvuuyjhcennqccgvse.supabase.co';
  v_anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFod3Z1dXlqaGNlbm5xY2NndnNlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE3MjA5OTAsImV4cCI6MjA3NzI5Njk5MH0.bIlGsgeAC6oxGUalODg0C5-l6KaJip0wWa9IbQ7MjTQ';
  v_request_id bigint;
BEGIN
  -- Create global notification record
  INSERT INTO notificaciones_globales (
    titulo,
    mensaje,
    accion_url,
    destinatarios,
    enviado_por,
    fecha_envio,
    tipo,
    modulo,
    enviar_whatsapp
  )
  VALUES (
    p_titulo,
    p_mensaje,
    p_accion_url,
    p_destinatarios,
    p_enviado_por,
    now(),
    'info',
    'Sistema',
    p_enviar_whatsapp
  )
  RETURNING id INTO v_notif_global_id;

  -- Distribute to individual users based on destinatarios
  IF (p_destinatarios->>'tipo') = 'todos' THEN
    -- Send to all users
    FOR v_user_record IN 
      SELECT id, nombre, apellidos, celular_laboral, celular_personal 
      FROM usuarios 
      WHERE estado = 'activo'
    LOOP
      -- Crear notificación push
      INSERT INTO notificaciones (
        usuario_id,
        titulo,
        mensaje,
        tipo,
        modulo,
        accion_url,
        leida,
        prioridad
      )
      VALUES (
        v_user_record.id,
        p_titulo,
        p_mensaje,
        'info',
        'Sistema',
        p_accion_url,
        false,
        'normal'
      );

      -- Enviar WhatsApp si está habilitado
      v_telefono := COALESCE(NULLIF(v_user_record.celular_laboral, ''), NULLIF(v_user_record.celular_personal, ''));
      
      IF p_enviar_whatsapp AND v_telefono IS NOT NULL AND LENGTH(v_telefono) >= 10 THEN
        BEGIN
          -- CORREGIDO: usar net.http_post en lugar de extensions.http_post
          SELECT INTO v_request_id net.http_post(
            url := v_supabase_url || '/functions/v1/enviar-whatsapp',
            headers := jsonb_build_object(
              'Content-Type', 'application/json',
              'Authorization', 'Bearer ' || v_anon_key
            ),
            body := jsonb_build_object(
              'tipo', 'notificacion_global',
              'numero', v_telefono,
              'datos', jsonb_build_object(
                'nombre', v_user_record.nombre,
                'apellidos', v_user_record.apellidos,
                'titulo', p_titulo,
                'mensaje', p_mensaje
              )
            )
          );
          v_whatsapp_enviados := v_whatsapp_enviados + 1;
        EXCEPTION WHEN OTHERS THEN
          v_whatsapp_fallidos := v_whatsapp_fallidos + 1;
          RAISE WARNING 'Error enviando WhatsApp a %: %', v_telefono, SQLERRM;
        END;
      END IF;
    END LOOP;

  ELSIF (p_destinatarios->>'tipo') = 'oficina' THEN
    -- Send to users in specific office
    FOR v_user_record IN 
      SELECT id, nombre, apellidos, celular_laboral, celular_personal 
      FROM usuarios 
      WHERE oficina_id = (p_destinatarios->>'oficina_id')::uuid 
      AND estado = 'activo'
    LOOP
      INSERT INTO notificaciones (
        usuario_id,
        titulo,
        mensaje,
        tipo,
        modulo,
        accion_url,
        leida,
        prioridad
      )
      VALUES (
        v_user_record.id,
        p_titulo,
        p_mensaje,
        'info',
        'Sistema',
        p_accion_url,
        false,
        'normal'
      );

      v_telefono := COALESCE(NULLIF(v_user_record.celular_laboral, ''), NULLIF(v_user_record.celular_personal, ''));

      IF p_enviar_whatsapp AND v_telefono IS NOT NULL AND LENGTH(v_telefono) >= 10 THEN
        BEGIN
          SELECT INTO v_request_id net.http_post(
            url := v_supabase_url || '/functions/v1/enviar-whatsapp',
            headers := jsonb_build_object(
              'Content-Type', 'application/json',
              'Authorization', 'Bearer ' || v_anon_key
            ),
            body := jsonb_build_object(
              'tipo', 'notificacion_global',
              'numero', v_telefono,
              'datos', jsonb_build_object(
                'nombre', v_user_record.nombre,
                'apellidos', v_user_record.apellidos,
                'titulo', p_titulo,
                'mensaje', p_mensaje
              )
            )
          );
          v_whatsapp_enviados := v_whatsapp_enviados + 1;
        EXCEPTION WHEN OTHERS THEN
          v_whatsapp_fallidos := v_whatsapp_fallidos + 1;
          RAISE WARNING 'Error enviando WhatsApp a %: %', v_telefono, SQLERRM;
        END;
      END IF;
    END LOOP;

  ELSIF (p_destinatarios->>'tipo') = 'rol' THEN
    -- Send to users with specific role
    FOR v_user_record IN 
      SELECT id, nombre, apellidos, celular_laboral, celular_personal 
      FROM usuarios 
      WHERE rol = (p_destinatarios->>'rol') 
      AND estado = 'activo'
    LOOP
      INSERT INTO notificaciones (
        usuario_id,
        titulo,
        mensaje,
        tipo,
        modulo,
        accion_url,
        leida,
        prioridad
      )
      VALUES (
        v_user_record.id,
        p_titulo,
        p_mensaje,
        'info',
        'Sistema',
        p_accion_url,
        false,
        'normal'
      );

      v_telefono := COALESCE(NULLIF(v_user_record.celular_laboral, ''), NULLIF(v_user_record.celular_personal, ''));

      IF p_enviar_whatsapp AND v_telefono IS NOT NULL AND LENGTH(v_telefono) >= 10 THEN
        BEGIN
          SELECT INTO v_request_id net.http_post(
            url := v_supabase_url || '/functions/v1/enviar-whatsapp',
            headers := jsonb_build_object(
              'Content-Type', 'application/json',
              'Authorization', 'Bearer ' || v_anon_key
            ),
            body := jsonb_build_object(
              'tipo', 'notificacion_global',
              'numero', v_telefono,
              'datos', jsonb_build_object(
                'nombre', v_user_record.nombre,
                'apellidos', v_user_record.apellidos,
                'titulo', p_titulo,
                'mensaje', p_mensaje
              )
            )
          );
          v_whatsapp_enviados := v_whatsapp_enviados + 1;
        EXCEPTION WHEN OTHERS THEN
          v_whatsapp_fallidos := v_whatsapp_fallidos + 1;
          RAISE WARNING 'Error enviando WhatsApp a %: %', v_telefono, SQLERRM;
        END;
      END IF;
    END LOOP;

  ELSIF (p_destinatarios->>'tipo') = 'usuario' THEN
    -- Send to specific user
    SELECT id, nombre, apellidos, celular_laboral, celular_personal 
    INTO v_user_record
    FROM usuarios 
    WHERE id = (p_destinatarios->>'user_id')::uuid;

    INSERT INTO notificaciones (
      usuario_id,
      titulo,
      mensaje,
      tipo,
      modulo,
      accion_url,
      leida,
      prioridad
    )
    VALUES (
      (p_destinatarios->>'user_id')::uuid,
      p_titulo,
      p_mensaje,
      'info',
      'Sistema',
      p_accion_url,
      false,
      'alta'
    );

    v_telefono := COALESCE(NULLIF(v_user_record.celular_laboral, ''), NULLIF(v_user_record.celular_personal, ''));

    IF p_enviar_whatsapp AND v_telefono IS NOT NULL AND LENGTH(v_telefono) >= 10 THEN
      BEGIN
        SELECT INTO v_request_id net.http_post(
          url := v_supabase_url || '/functions/v1/enviar-whatsapp',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || v_anon_key
          ),
          body := jsonb_build_object(
            'tipo', 'notificacion_global',
            'numero', v_telefono,
            'datos', jsonb_build_object(
              'nombre', v_user_record.nombre,
              'apellidos', v_user_record.apellidos,
              'titulo', p_titulo,
              'mensaje', p_mensaje
            )
          )
        );
        v_whatsapp_enviados := v_whatsapp_enviados + 1;
      EXCEPTION WHEN OTHERS THEN
        v_whatsapp_fallidos := v_whatsapp_fallidos + 1;
        RAISE WARNING 'Error enviando WhatsApp a %: %', v_telefono, SQLERRM;
      END;
    END IF;
  END IF;

  -- Actualizar contadores de WhatsApp
  IF p_enviar_whatsapp THEN
    UPDATE notificaciones_globales
    SET 
      whatsapp_enviado = (v_whatsapp_enviados > 0),
      whatsapp_fecha_envio = now(),
      whatsapp_total_enviados = v_whatsapp_enviados,
      whatsapp_total_fallidos = v_whatsapp_fallidos
    WHERE id = v_notif_global_id;
  END IF;

END;
$$;

-- =====================================================
-- 2. Corregir función enviar_notificacion_individual
-- =====================================================

CREATE OR REPLACE FUNCTION enviar_notificacion_individual(
  p_user_id uuid,
  p_titulo text,
  p_mensaje text,
  p_modulo text,
  p_accion_url text DEFAULT NULL,
  p_enviar_whatsapp boolean DEFAULT true
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_notif_id uuid;
  v_user_record record;
  v_telefono text;
  v_supabase_url text := 'https://qhwvuuyjhcennqccgvse.supabase.co';
  v_anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFod3Z1dXlqaGNlbm5xY2NndnNlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE3MjA5OTAsImV4cCI6MjA3NzI5Njk5MH0.bIlGsgeAC6oxGUalODg0C5-l6KaJip0wWa9IbQ7MjTQ';
  v_request_id bigint;
BEGIN
  -- Obtener información del usuario
  SELECT id, nombre, apellidos, celular_laboral, celular_personal, email_laboral
  INTO v_user_record
  FROM usuarios
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Usuario no encontrado: %', p_user_id;
  END IF;

  -- Insertar notificación (campanita)
  INSERT INTO notificaciones (
    usuario_id,
    titulo,
    mensaje,
    tipo,
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
    p_modulo,
    p_accion_url,
    false,
    'normal'
  )
  RETURNING id INTO v_notif_id;

  -- Enviar WhatsApp si está habilitado
  v_telefono := COALESCE(NULLIF(v_user_record.celular_laboral, ''), NULLIF(v_user_record.celular_personal, ''));

  IF p_enviar_whatsapp AND v_telefono IS NOT NULL AND LENGTH(v_telefono) >= 10 THEN
    BEGIN
      -- CORREGIDO: usar net.http_post en lugar de extensions.http_post
      SELECT INTO v_request_id net.http_post(
        url := v_supabase_url || '/functions/v1/enviar-whatsapp',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || v_anon_key
        ),
        body := jsonb_build_object(
          'tipo', 'notificacion_individual',
          'numero', v_telefono,
          'datos', jsonb_build_object(
            'nombre', v_user_record.nombre,
            'apellidos', v_user_record.apellidos,
            'email_laboral', v_user_record.email_laboral,
            'titulo', p_titulo,
            'mensaje', p_mensaje,
            'modulo', p_modulo
          )
        )
      );
      
      RAISE NOTICE 'WhatsApp enviado a % (request_id: %)', v_telefono, v_request_id;
    EXCEPTION WHEN OTHERS THEN
      -- No fallar la transacción si WhatsApp falla
      RAISE WARNING 'Error enviando WhatsApp a %: %', v_telefono, SQLERRM;
    END;
  END IF;

  RETURN v_notif_id;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION enviar_notificacion_global(text, text, text, jsonb, uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION enviar_notificacion_individual(uuid, text, text, text, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION enviar_notificacion_individual(uuid, text, text, text, text, boolean) TO service_role;

-- =====================================================
-- Logs
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'CORRECCIÓN SCHEMA PG_NET';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ Función enviar_notificacion_global actualizada';
  RAISE NOTICE '✅ Función enviar_notificacion_individual actualizada';
  RAISE NOTICE '✅ Ahora usa net.http_post en lugar de extensions.http_post';
  RAISE NOTICE '✅ WhatsApp funcionará correctamente en:';
  RAISE NOTICE '   - Notificaciones globales (Centro de Notificaciones)';
  RAISE NOTICE '   - Notificaciones individuales (todas las notificaciones)';
  RAISE NOTICE '========================================';
END $$;
