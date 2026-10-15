/*
  # Corrección formato teléfono WhatsApp a 521 + 10 dígitos

  ## Cambios
  
  1. Actualizar función enviar_notificacion_global
     - Normalizar teléfono a formato 521 + 10 dígitos (en lugar de 52 + 10)
  
  2. Actualizar función enviar_notificacion_individual
     - Normalizar teléfono a formato 521 + 10 dígitos (en lugar de 52 + 10)
  
  ## Impacto
  
  Esto corregirá el envío de WhatsApp en:
  - Comunicados (Centro de Notificaciones)
  - Notificaciones individuales
  - Todas las notificaciones transaccionales
  
  ## Formato correcto
  
  México móvil: 521 + 10 dígitos
  Ejemplo: 5215512345678
*/

-- =====================================================
-- DROP funciones existentes
-- =====================================================

DROP FUNCTION IF EXISTS enviar_notificacion_global(text, text, text, jsonb, uuid, boolean);
DROP FUNCTION IF EXISTS enviar_notificacion_individual(uuid, text, text, text, text, boolean);

-- =====================================================
-- Recrear función enviar_notificacion_global
-- =====================================================

CREATE OR REPLACE FUNCTION enviar_notificacion_global(
  p_titulo text,
  p_mensaje text,
  p_accion_url text,
  p_filtros jsonb DEFAULT '{}'::jsonb,
  p_evento_id uuid DEFAULT NULL,
  p_enviar_whatsapp boolean DEFAULT true
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_usuarios_ids uuid[];
  v_usuario_id uuid;
  v_notif_id uuid;
  v_usuarios_count integer := 0;
  v_notif_count integer := 0;
  v_supabase_url text;
  v_anon_key text;
  v_user_record record;
  v_telefono text;
  v_telefono_normalizado text;
  v_request_id bigint;
BEGIN
  v_supabase_url := current_setting('app.settings.supabase_url', true);
  v_anon_key := current_setting('app.settings.supabase_anon_key', true);

  IF v_supabase_url IS NULL THEN
    v_supabase_url := 'https://hiorlqynmkqejfmpkogb.supabase.co';
  END IF;
  
  IF v_anon_key IS NULL THEN
    RAISE WARNING 'Supabase anon key no configurada. WhatsApp no se enviará.';
    p_enviar_whatsapp := false;
  END IF;

  SELECT ARRAY_AGG(DISTINCT id)
  INTO v_usuarios_ids
  FROM usuarios
  WHERE estado = 'activo'
    AND (
      (p_filtros->>'rol' IS NULL OR rol = p_filtros->>'rol')
      AND (p_filtros->>'oficina_id' IS NULL OR oficina_id::text = p_filtros->>'oficina_id')
      AND (p_filtros->>'area_id' IS NULL OR area_id::text = p_filtros->>'area_id')
    );

  IF v_usuarios_ids IS NULL OR array_length(v_usuarios_ids, 1) IS NULL THEN
    RAISE NOTICE 'No se encontraron usuarios que cumplan los filtros';
    RETURN json_build_object('usuarios_notificados', 0, 'notificaciones_creadas', 0);
  END IF;

  RAISE NOTICE 'Usuarios encontrados: %', array_length(v_usuarios_ids, 1);

  FOREACH v_usuario_id IN ARRAY v_usuarios_ids
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
      v_usuario_id,
      p_titulo,
      p_mensaje,
      'info',
      'Comunicados',
      p_accion_url,
      false,
      'normal'
    )
    RETURNING id INTO v_notif_id;

    v_notif_count := v_notif_count + 1;

    IF p_enviar_whatsapp THEN
      BEGIN
        SELECT 
          u.*,
          COALESCE(NULLIF(u.celular_laboral, ''), NULLIF(u.celular_personal, '')) as telefono
        INTO v_user_record
        FROM usuarios u
        WHERE u.id = v_usuario_id;

        v_telefono := v_user_record.telefono;

        IF v_telefono IS NOT NULL AND LENGTH(v_telefono) >= 10 THEN
          -- Normalizar teléfono: eliminar caracteres no numéricos
          v_telefono_normalizado := regexp_replace(v_telefono, '[^0-9]', '', 'g');
          
          -- Si tiene 10 dígitos, agregar 521 al inicio
          IF LENGTH(v_telefono_normalizado) = 10 THEN
            v_telefono_normalizado := '521' || v_telefono_normalizado;
          END IF;

          RAISE NOTICE 'Enviando WhatsApp a: % (normalizado: %)', v_telefono, v_telefono_normalizado;

          SELECT INTO v_request_id net.http_post(
            url := v_supabase_url || '/functions/v1/enviar-whatsapp',
            headers := jsonb_build_object(
              'Content-Type', 'application/json',
              'Authorization', 'Bearer ' || v_anon_key
            ),
            body := jsonb_build_object(
              'tipo', 'notificacion_global',
              'numero', v_telefono_normalizado,
              'datos', jsonb_build_object(
                'nombre', v_user_record.nombre,
                'apellidos', v_user_record.apellidos,
                'titulo', p_titulo,
                'mensaje', p_mensaje,
                'accion_url', p_accion_url
              ),
              'evento_id', p_evento_id
            )
          );

          RAISE NOTICE 'WhatsApp enviado (request_id: %)', v_request_id;
        ELSE
          RAISE NOTICE 'Usuario % no tiene teléfono válido', v_usuario_id;
        END IF;

      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Error enviando WhatsApp a usuario %: %', v_usuario_id, SQLERRM;
      END;
    END IF;

    v_usuarios_count := v_usuarios_count + 1;
  END LOOP;

  RAISE NOTICE 'Proceso completado: % usuarios, % notificaciones', v_usuarios_count, v_notif_count;

  RETURN json_build_object('usuarios_notificados', v_usuarios_count, 'notificaciones_creadas', v_notif_count);
END;
$$;

-- =====================================================
-- Recrear función enviar_notificacion_individual
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
AS $$
DECLARE
  v_notif_id uuid;
  v_supabase_url text;
  v_anon_key text;
  v_user_record record;
  v_telefono text;
  v_telefono_normalizado text;
  v_request_id bigint;
BEGIN
  v_supabase_url := current_setting('app.settings.supabase_url', true);
  v_anon_key := current_setting('app.settings.supabase_anon_key', true);

  IF v_supabase_url IS NULL THEN
    v_supabase_url := 'https://hiorlqynmkqejfmpkogb.supabase.co';
  END IF;

  IF v_anon_key IS NULL THEN
    RAISE WARNING 'Supabase anon key no configurada. WhatsApp no se enviará.';
    p_enviar_whatsapp := false;
  END IF;

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

  RAISE NOTICE 'Notificación creada: %', v_notif_id;

  IF p_enviar_whatsapp THEN
    BEGIN
      SELECT 
        u.*,
        COALESCE(NULLIF(u.celular_laboral, ''), NULLIF(u.celular_personal, '')) as telefono
      INTO v_user_record
      FROM usuarios u
      WHERE u.id = p_user_id;

      IF NOT FOUND THEN
        RAISE WARNING 'Usuario no encontrado: %', p_user_id;
        RETURN v_notif_id;
      END IF;

      v_telefono := v_user_record.telefono;

      IF v_telefono IS NOT NULL AND LENGTH(v_telefono) >= 10 THEN
        -- Normalizar teléfono: eliminar caracteres no numéricos
        v_telefono_normalizado := regexp_replace(v_telefono, '[^0-9]', '', 'g');
        
        -- Si tiene 10 dígitos, agregar 521 al inicio
        IF LENGTH(v_telefono_normalizado) = 10 THEN
          v_telefono_normalizado := '521' || v_telefono_normalizado;
        END IF;

        RAISE NOTICE 'Enviando WhatsApp a: % (normalizado: %)', v_telefono, v_telefono_normalizado;

        SELECT INTO v_request_id net.http_post(
          url := v_supabase_url || '/functions/v1/enviar-whatsapp',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || v_anon_key
          ),
          body := jsonb_build_object(
            'tipo', 'notificacion_individual',
            'numero', v_telefono_normalizado,
            'datos', jsonb_build_object(
              'nombre', v_user_record.nombre,
              'apellidos', v_user_record.apellidos,
              'titulo', p_titulo,
              'mensaje', p_mensaje,
              'accion_url', p_accion_url
            )
          )
        );

        RAISE NOTICE 'WhatsApp enviado (request_id: %)', v_request_id;
      ELSE
        RAISE NOTICE 'Usuario no tiene teléfono válido';
      END IF;

    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Error enviando WhatsApp: %', SQLERRM;
    END;
  END IF;

  RETURN v_notif_id;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION enviar_notificacion_global(text, text, text, jsonb, uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION enviar_notificacion_individual(uuid, text, text, text, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION enviar_notificacion_individual(uuid, text, text, text, text, boolean) TO service_role;

-- Logs
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'CORRECCIÓN FORMATO WHATSAPP 521';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ Función enviar_notificacion_global actualizada';
  RAISE NOTICE '✅ Función enviar_notificacion_individual actualizada';
  RAISE NOTICE '✅ Ahora usa formato 521 + 10 dígitos';
  RAISE NOTICE '✅ Ejemplo: 5215512345678';
  RAISE NOTICE '========================================';
END $$;