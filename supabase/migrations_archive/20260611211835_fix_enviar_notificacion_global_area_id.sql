CREATE OR REPLACE FUNCTION public.enviar_notificacion_global(
  p_titulo text,
  p_mensaje text,
  p_accion_url text,
  p_filtros jsonb DEFAULT '{}'::jsonb,
  p_evento_id uuid DEFAULT NULL::uuid,
  p_enviar_whatsapp boolean DEFAULT true
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
          v_telefono_normalizado := regexp_replace(v_telefono, '[^0-9]', '', 'g');

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
$function$;
