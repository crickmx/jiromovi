-- 1. Enable Realtime on notificaciones table
ALTER PUBLICATION supabase_realtime ADD TABLE notificaciones;

-- 2. Fix enviar_notificacion_global: add history record + fix WhatsApp phone normalization
CREATE OR REPLACE FUNCTION public.enviar_notificacion_global(
  p_titulo text,
  p_mensaje text,
  p_accion_url text,
  p_filtros jsonb DEFAULT '{}'::jsonb,
  p_evento_id uuid DEFAULT NULL::uuid,
  p_enviar_whatsapp boolean DEFAULT true,
  p_enviado_por uuid DEFAULT NULL::uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_usuarios_ids uuid[];
  v_usuario_id uuid;
  v_notif_id uuid;
  v_usuarios_count integer := 0;
  v_notif_count integer := 0;
  v_wa_enviados integer := 0;
  v_wa_fallidos integer := 0;
  v_supabase_url text;
  v_anon_key text;
  v_user_record record;
  v_telefono text;
  v_telefono_normalizado text;
  v_request_id bigint;
  v_global_id uuid;
BEGIN
  v_supabase_url := current_setting('app.settings.supabase_url', true);
  v_anon_key := current_setting('app.settings.supabase_anon_key', true);

  IF v_supabase_url IS NULL OR v_supabase_url = '' THEN
    v_supabase_url := 'https://hiorlqynmkqejfmpkogb.supabase.co';
  END IF;

  -- Use hardcoded anon key as fallback when setting is NULL
  IF v_anon_key IS NULL OR v_anon_key = '' THEN
    v_anon_key := current_setting('request.jwt.secret', true);
  END IF;

  -- Always try to find anon key from auth.jwt_secret or use the known key
  IF v_anon_key IS NULL OR v_anon_key = '' THEN
    RAISE WARNING 'Supabase anon key no configurada. WhatsApp no se enviará.';
    p_enviar_whatsapp := false;
  END IF;

  -- Get target users
  SELECT ARRAY_AGG(DISTINCT id)
  INTO v_usuarios_ids
  FROM usuarios
  WHERE estado = 'activo'
  AND (
    (p_filtros->>'rol' IS NULL OR rol = p_filtros->>'rol')
    AND (p_filtros->>'oficina_id' IS NULL OR oficina_id::text = p_filtros->>'oficina_id')
  );

  IF v_usuarios_ids IS NULL OR array_length(v_usuarios_ids, 1) IS NULL THEN
    RAISE NOTICE 'No se encontraron usuarios que cumplan los filtros';
    RETURN json_build_object('usuarios_notificados', 0, 'notificaciones_creadas', 0);
  END IF;

  -- Insert history record in notificaciones_globales
  -- Use a system user if p_enviado_por is NULL (pick any admin)
  IF p_enviado_por IS NULL THEN
    SELECT id INTO p_enviado_por FROM usuarios WHERE rol = 'admin' AND estado = 'activo' LIMIT 1;
  END IF;

  IF p_enviado_por IS NOT NULL THEN
    INSERT INTO notificaciones_globales (
      titulo,
      mensaje,
      accion_url,
      destinatarios,
      enviado_por,
      enviar_whatsapp,
      whatsapp_enviado
    )
    VALUES (
      p_titulo,
      p_mensaje,
      p_accion_url,
      p_filtros,
      p_enviado_por,
      p_enviar_whatsapp,
      false
    )
    RETURNING id INTO v_global_id;
  END IF;

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

    IF p_enviar_whatsapp AND v_anon_key IS NOT NULL AND v_anon_key != '' THEN
      BEGIN
        SELECT
          u.nombre,
          u.apellidos,
          COALESCE(NULLIF(u.celular_laboral, ''), NULLIF(u.celular_personal, '')) as telefono
        INTO v_user_record
        FROM usuarios u
        WHERE u.id = v_usuario_id;

        v_telefono := v_user_record.telefono;

        IF v_telefono IS NOT NULL AND LENGTH(v_telefono) >= 10 THEN
          v_telefono_normalizado := regexp_replace(v_telefono, '[^0-9]', '', 'g');

          -- Normalize to 521XXXXXXXXXX format
          IF LENGTH(v_telefono_normalizado) = 10 THEN
            v_telefono_normalizado := '521' || v_telefono_normalizado;
          ELSIF LENGTH(v_telefono_normalizado) = 12 AND v_telefono_normalizado LIKE '52%' THEN
            v_telefono_normalizado := '521' || SUBSTRING(v_telefono_normalizado FROM 3);
          ELSIF LENGTH(v_telefono_normalizado) = 13 AND v_telefono_normalizado NOT LIKE '521%' THEN
            v_telefono_normalizado := '521' || SUBSTRING(v_telefono_normalizado FROM 4);
          END IF;

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

          v_wa_enviados := v_wa_enviados + 1;
        ELSE
          v_wa_fallidos := v_wa_fallidos + 1;
        END IF;

      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Error enviando WhatsApp a usuario %: %', v_usuario_id, SQLERRM;
        v_wa_fallidos := v_wa_fallidos + 1;
      END;
    END IF;

    v_usuarios_count := v_usuarios_count + 1;
  END LOOP;

  -- Update global record with WhatsApp stats
  IF v_global_id IS NOT NULL THEN
    UPDATE notificaciones_globales
    SET
      whatsapp_enviado = (v_wa_enviados > 0),
      whatsapp_fecha_envio = CASE WHEN v_wa_enviados > 0 THEN now() ELSE NULL END,
      whatsapp_total_enviados = v_wa_enviados,
      whatsapp_total_fallidos = v_wa_fallidos
    WHERE id = v_global_id;
  END IF;

  RETURN json_build_object(
    'usuarios_notificados', v_usuarios_count,
    'notificaciones_creadas', v_notif_count,
    'whatsapp_enviados', v_wa_enviados,
    'whatsapp_fallidos', v_wa_fallidos
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.enviar_notificacion_global(text, text, text, jsonb, uuid, boolean, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.enviar_notificacion_global(text, text, text, jsonb, uuid, boolean, uuid) TO service_role;

-- 3. Fix enviar_notificacion_individual: fix schema (extensions vs net), fix phone normalization
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
  v_telefono_normalizado text;
  v_supabase_url text;
  v_anon_key text;
  v_request_id bigint;
BEGIN
  v_supabase_url := current_setting('app.settings.supabase_url', true);
  v_anon_key := current_setting('app.settings.supabase_anon_key', true);

  IF v_supabase_url IS NULL OR v_supabase_url = '' THEN
    v_supabase_url := 'https://hiorlqynmkqejfmpkogb.supabase.co';
  END IF;

  SELECT id, nombre, apellidos, celular_laboral, celular_personal
  INTO v_user_record
  FROM usuarios
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Usuario no encontrado: %', p_user_id;
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

  v_telefono := COALESCE(NULLIF(v_user_record.celular_laboral, ''), NULLIF(v_user_record.celular_personal, ''));

  IF p_enviar_whatsapp AND v_telefono IS NOT NULL AND LENGTH(v_telefono) >= 10
     AND v_anon_key IS NOT NULL AND v_anon_key != '' THEN
    BEGIN
      v_telefono_normalizado := regexp_replace(v_telefono, '[^0-9]', '', 'g');

      -- Normalize to 521XXXXXXXXXX
      IF LENGTH(v_telefono_normalizado) = 10 THEN
        v_telefono_normalizado := '521' || v_telefono_normalizado;
      ELSIF LENGTH(v_telefono_normalizado) = 12 AND v_telefono_normalizado LIKE '52%' THEN
        v_telefono_normalizado := '521' || SUBSTRING(v_telefono_normalizado FROM 3);
      ELSIF LENGTH(v_telefono_normalizado) = 13 AND v_telefono_normalizado NOT LIKE '521%' THEN
        v_telefono_normalizado := '521' || SUBSTRING(v_telefono_normalizado FROM 4);
      END IF;

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
            'modulo', p_modulo
          )
        )
      );

      RAISE NOTICE 'WhatsApp enviado a % (normalizado: %, request_id: %)', v_telefono, v_telefono_normalizado, v_request_id;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Error enviando WhatsApp a %: %', v_telefono, SQLERRM;
    END;
  ELSIF p_enviar_whatsapp AND (v_anon_key IS NULL OR v_anon_key = '') THEN
    RAISE WARNING 'Anon key no configurada, WhatsApp no enviado para usuario %', p_user_id;
  END IF;

  RETURN v_notif_id;
END;
$$;

GRANT EXECUTE ON FUNCTION enviar_notificacion_individual(uuid, text, text, text, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION enviar_notificacion_individual(uuid, text, text, text, text, boolean) TO service_role;
