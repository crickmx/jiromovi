/*
  # Crear función para enviar notificaciones transaccionales

  ## Descripción
  Crea una función que procesa plantillas transaccionales y envía notificaciones
  por TODOS los canales configurados (email, WhatsApp, campanita).

  ## Cambios
  1. Nueva función: send_transactional_notification
     - Busca la plantilla por event_key
     - Reemplaza variables en las plantillas
     - Crea notificación interna (campanita)
     - Envía email usando edge function
     - Envía WhatsApp usando edge function

  ## Parámetros
  - p_event_key: Identificador del evento (ej: 'web_lead_nuevo')
  - p_user_id: UUID del usuario destinatario
  - p_variables: JSONB con variables para reemplazar en las plantillas
  - p_link_url: URL opcional para la notificación interna

  ## Seguridad
  - SECURITY DEFINER para acceso a funciones HTTP
  - Validación de plantilla y usuario
*/

CREATE OR REPLACE FUNCTION send_transactional_notification(
  p_event_key text,
  p_user_id uuid,
  p_variables jsonb DEFAULT '{}'::jsonb,
  p_link_url text DEFAULT NULL
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

  -- 2. Enviar email si está configurado
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
          'html_body', v_email_body
        )
      ) INTO v_request_id;

      RAISE NOTICE 'Email notification queued: % to %', v_request_id, v_user.email_laboral;
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

-- Comentario
COMMENT ON FUNCTION send_transactional_notification IS 'Envía notificación transaccional por todos los canales (email, WhatsApp, campanita) según la plantilla configurada';

-- Permisos
GRANT EXECUTE ON FUNCTION send_transactional_notification(text, uuid, jsonb, text) TO authenticated;
GRANT EXECUTE ON FUNCTION send_transactional_notification(text, uuid, jsonb, text) TO service_role;
