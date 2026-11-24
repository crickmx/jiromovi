/*
  # Agregar soporte de adjuntos a notificaciones de trámites

  1. Cambios
    - Actualizar función send_transactional_notification para soportar adjuntos
    - Actualizar función notificar_documento_tramite para enviar el archivo como adjunto
    - Los adjuntos se descargan de Supabase Storage y se envían por correo

  2. Estructura de adjuntos
    - filename: Nombre del archivo
    - content_type: Tipo MIME (opcional)
    - storage_path: Ruta en storage (ej: 'tickets/archivo.pdf')
    - url: URL completa del archivo (opcional, alternativa a storage_path)
*/

-- ============================================
-- Eliminar función anterior
-- ============================================
DROP FUNCTION IF EXISTS send_transactional_notification(text, uuid, jsonb, text);

-- ============================================
-- Crear nueva función send_transactional_notification
-- con soporte para adjuntos
-- ============================================
CREATE OR REPLACE FUNCTION send_transactional_notification(
  p_event_key text,
  p_user_id uuid,
  p_variables jsonb DEFAULT '{}'::jsonb,
  p_link_url text DEFAULT NULL,
  p_attachments jsonb DEFAULT '[]'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_template record;
  v_user record;
  v_notif_id uuid;
  v_email_subject text;
  v_email_body text;
  v_whatsapp_body text;
  v_inapp_title text;
  v_inapp_body text;
  v_variable_key text;
  v_variable_value text;
  v_supabase_url text;
  v_anon_key text;
  v_request_id bigint;
BEGIN
  -- Obtener la plantilla
  SELECT * INTO v_template
  FROM transactional_notification_templates
  WHERE event_key = p_event_key
    AND is_active = true;

  IF NOT FOUND THEN
    RAISE WARNING 'Template not found or inactive: %', p_event_key;
    RETURN NULL;
  END IF;

  -- Obtener datos del usuario
  SELECT
    id,
    nombre_completo,
    email_laboral,
    celular_laboral
  INTO v_user
  FROM usuarios
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE WARNING 'User not found: %', p_user_id;
    RETURN NULL;
  END IF;

  -- Inicializar las plantillas
  v_email_subject := v_template.email_subject_template;
  v_email_body := v_template.email_body_template;
  v_whatsapp_body := v_template.whatsapp_body_template;
  v_inapp_title := v_template.inapp_title_template;
  v_inapp_body := v_template.inapp_body_template;

  -- Reemplazar variables en las plantillas
  FOR v_variable_key, v_variable_value IN SELECT * FROM jsonb_each_text(p_variables)
  LOOP
    v_email_subject := replace(v_email_subject, '{{' || v_variable_key || '}}', v_variable_value);
    v_email_body := replace(v_email_body, '{{' || v_variable_key || '}}', v_variable_value);
    v_whatsapp_body := replace(v_whatsapp_body, '{{' || v_variable_key || '}}', v_variable_value);
    v_inapp_title := replace(v_inapp_title, '{{' || v_variable_key || '}}', v_variable_value);
    v_inapp_body := replace(v_inapp_body, '{{' || v_variable_key || '}}', v_variable_value);
  END LOOP;

  -- 1. Crear notificación interna (campanita)
  IF v_inapp_title IS NOT NULL AND v_inapp_body IS NOT NULL THEN
    INSERT INTO notifications (user_id, title, body, link_url)
    VALUES (p_user_id, v_inapp_title, v_inapp_body, p_link_url)
    RETURNING id INTO v_notif_id;

    RAISE NOTICE 'Created in-app notification: %', v_notif_id;
  END IF;

  -- Obtener configuración de Supabase
  v_supabase_url := COALESCE(
    current_setting('app.settings.supabase_url', true),
    'https://qhwvuuyjhcennqccgvse.supabase.co'
  );

  v_anon_key := COALESCE(
    current_setting('app.settings.supabase_anon_key', true),
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFod3Z1dXlqaGNlbm5xY2NndnNlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE3MjA5OTAsImV4cCI6MjA3NzI5Njk5MH0.bIlGsgeAC6oxGUalODg0C5-l6KaJip0wWa9IbQ7MjTQ'
  );

  -- 2. Enviar email si está configurado (con adjuntos)
  IF v_email_subject IS NOT NULL AND v_email_body IS NOT NULL AND v_user.email_laboral IS NOT NULL THEN
    BEGIN
      SELECT net.http_post(
        url := v_supabase_url || '/functions/v1/enviar-correo-transaccional',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || v_anon_key
        ),
        body := jsonb_build_object(
          'to_email', v_user.email_laboral,
          'to_name', v_user.nombre_completo,
          'subject', v_email_subject,
          'html_body', v_email_body,
          'attachments', p_attachments
        )
      ) INTO v_request_id;

      RAISE NOTICE 'Email notification queued: % to % with % attachments', v_request_id, v_user.email_laboral, jsonb_array_length(p_attachments);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Failed to queue email notification: %', SQLERRM;
    END;
  END IF;

  -- 3. Enviar WhatsApp si está configurado
  IF v_whatsapp_body IS NOT NULL AND v_user.celular_laboral IS NOT NULL THEN
    BEGIN
      SELECT net.http_post(
        url := v_supabase_url || '/functions/v1/enviar-whatsapp',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || v_anon_key
        ),
        body := jsonb_build_object(
          'phone', v_user.celular_laboral,
          'message', v_whatsapp_body
        )
      ) INTO v_request_id;

      RAISE NOTICE 'WhatsApp notification queued: % to %', v_request_id, v_user.celular_laboral;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Failed to queue WhatsApp notification: %', SQLERRM;
    END;
  END IF;

  RETURN v_notif_id;
END;
$$;

COMMENT ON FUNCTION send_transactional_notification IS 'Envía notificación transaccional por todos los canales (email con adjuntos, WhatsApp, campanita) según la plantilla configurada';

GRANT EXECUTE ON FUNCTION send_transactional_notification(text, uuid, jsonb, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION send_transactional_notification(text, uuid, jsonb, text, jsonb) TO service_role;

-- ============================================
-- Actualizar función notificar_documento_tramite
-- para enviar el archivo como adjunto
-- ============================================
CREATE OR REPLACE FUNCTION notificar_documento_tramite()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_tramite RECORD;
  v_agente RECORD;
  v_subidor RECORD;
  v_tamano_texto TEXT;
  v_url TEXT;
  v_archivo_url TEXT;
  v_attachments jsonb;
BEGIN
  SELECT t.*, te.nombre as estatus_nombre
  INTO v_tramite
  FROM tickets t
  LEFT JOIN ticket_estatus te ON t.estatus_id = te.id
  WHERE t.id = NEW.ticket_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  SELECT id, nombre_completo, email_laboral, celular_laboral
  INTO v_agente
  FROM usuarios
  WHERE id = v_tramite.agente_id;

  IF NOT FOUND OR v_agente.id = NEW.usuario_id THEN
    RETURN NEW;
  END IF;

  SELECT nombre_completo, rol
  INTO v_subidor
  FROM usuarios
  WHERE id = NEW.usuario_id;

  IF NEW.tamano IS NOT NULL THEN
    IF NEW.tamano < 1024 THEN
      v_tamano_texto := NEW.tamano || ' bytes';
    ELSIF NEW.tamano < 1048576 THEN
      v_tamano_texto := ROUND(NEW.tamano / 1024.0, 2) || ' KB';
    ELSE
      v_tamano_texto := ROUND(NEW.tamano / 1048576.0, 2) || ' MB';
    END IF;
  ELSE
    v_tamano_texto := 'Desconocido';
  END IF;

  v_url := 'https://app.movi.digital/tramites/' || v_tramite.id;

  -- Construir URL del archivo desde storage
  -- NEW.ruta_archivo contiene algo como 'tickets/uuid/archivo.pdf'
  v_archivo_url := COALESCE(
    current_setting('app.settings.supabase_url', true),
    'https://qhwvuuyjhcennqccgvse.supabase.co'
  ) || '/storage/v1/object/public/' || NEW.ruta_archivo;

  -- Construir JSON de adjuntos
  v_attachments := jsonb_build_array(
    jsonb_build_object(
      'filename', NEW.nombre,
      'content_type', NEW.tipo_archivo,
      'url', v_archivo_url
    )
  );

  RAISE NOTICE 'Enviando notificación con adjunto: % (%) desde %', NEW.nombre, v_tamano_texto, v_archivo_url;

  PERFORM send_transactional_notification(
    p_event_key := 'tramite_documento_cargado',
    p_user_id := v_agente.id,
    p_variables := jsonb_build_object(
      'folio', v_tramite.folio,
      'agente_nombre', v_agente.nombre_completo,
      'nombre_archivo', NEW.nombre,
      'subido_por', v_subidor.nombre_completo,
      'rol_subidor', v_subidor.rol,
      'tamano_archivo', v_tamano_texto,
      'tipo_tramite', v_tramite.tipo_tramite,
      'estatus', COALESCE(v_tramite.estatus_nombre, 'Sin estatus'),
      'url', v_url
    ),
    p_link_url := v_url,
    p_attachments := v_attachments
  );

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION notificar_documento_tramite IS 'Notifica al agente cuando se carga un documento en su trámite, adjuntando el archivo al correo';
