/*
  # Ajustar función de notificaciones para priorizar celular_laboral

  1. Cambios
    - Priorizar celular_laboral sobre celular_personal
    - Asegurar envío inmediato de WhatsApp
    - Optimizar llamada HTTP a edge function

  2. Notas
    - Se invierte la prioridad: celular_laboral primero
    - Envío inmediato sin esperas
*/

-- Recrear función con prioridad invertida
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

      -- Enviar WhatsApp si está habilitado y el usuario tiene teléfono
      -- PRIORIZAR celular_laboral, si no existe usar celular_personal
      v_telefono := COALESCE(NULLIF(v_user_record.celular_laboral, ''), NULLIF(v_user_record.celular_personal, ''));
      
      IF p_enviar_whatsapp AND v_telefono IS NOT NULL AND LENGTH(v_telefono) >= 10 THEN
        BEGIN
          PERFORM net.http_post(
            url := current_setting('app.supabase_url') || '/functions/v1/enviar-whatsapp',
            headers := jsonb_build_object(
              'Authorization', 'Bearer ' || current_setting('app.service_role_key'),
              'Content-Type', 'application/json'
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
          PERFORM net.http_post(
            url := current_setting('app.supabase_url') || '/functions/v1/enviar-whatsapp',
            headers := jsonb_build_object(
              'Authorization', 'Bearer ' || current_setting('app.service_role_key'),
              'Content-Type', 'application/json'
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
          PERFORM net.http_post(
            url := current_setting('app.supabase_url') || '/functions/v1/enviar-whatsapp',
            headers := jsonb_build_object(
              'Authorization', 'Bearer ' || current_setting('app.service_role_key'),
              'Content-Type', 'application/json'
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
        PERFORM net.http_post(
          url := current_setting('app.supabase_url') || '/functions/v1/enviar-whatsapp',
          headers := jsonb_build_object(
            'Authorization', 'Bearer ' || current_setting('app.service_role_key'),
            'Content-Type', 'application/json'
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

-- Grant execute permission
GRANT EXECUTE ON FUNCTION enviar_notificacion_global(text, text, text, jsonb, uuid, boolean) TO authenticated;
