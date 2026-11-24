/*
  # Agregar Historial de Notificaciones de Trámites

  1. Problema
    - Las notificaciones de trámites no aparecen en el historial
    - Se envían por send_transactional_notification pero no se registran

  2. Solución
    - Crear tabla de historial unificado si no existe
    - Agregar vista que incluya notificaciones de trámites
*/

-- Crear tabla de historial de notificaciones transaccionales si no existe
CREATE TABLE IF NOT EXISTS transactional_notification_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_key text NOT NULL,
  user_id uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  email_sent boolean DEFAULT false,
  email_status text,
  email_error text,
  whatsapp_sent boolean DEFAULT false,
  whatsapp_status text,
  whatsapp_error text,
  inapp_notification_id uuid,
  variables jsonb,
  created_at timestamptz DEFAULT now()
);

-- Crear índices
CREATE INDEX IF NOT EXISTS idx_transactional_history_user ON transactional_notification_history(user_id);
CREATE INDEX IF NOT EXISTS idx_transactional_history_event ON transactional_notification_history(event_key);
CREATE INDEX IF NOT EXISTS idx_transactional_history_created ON transactional_notification_history(created_at DESC);

-- Habilitar RLS
ALTER TABLE transactional_notification_history ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
DROP POLICY IF EXISTS "Admins can view all notification history" ON transactional_notification_history;
CREATE POLICY "Admins can view all notification history"
  ON transactional_notification_history
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'administrador'
    )
  );

DROP POLICY IF EXISTS "Users can view own notification history" ON transactional_notification_history;
CREATE POLICY "Users can view own notification history"
  ON transactional_notification_history
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Crear vista unificada para historial de notificaciones
CREATE OR REPLACE VIEW historial_notificaciones_unificado AS
SELECT 
  tnh.id,
  tnt.name as tipo_notificacion,
  tnh.event_key,
  u.nombre_completo as destinatario_nombre,
  u.email_laboral as destinatario_email,
  u.celular_laboral as destinatario_telefono,
  tnh.email_sent,
  tnh.email_status as estado_email,
  tnh.whatsapp_sent,
  tnh.whatsapp_status as estado_whatsapp,
  tnh.variables,
  tnh.created_at as fecha_envio
FROM transactional_notification_history tnh
LEFT JOIN usuarios u ON tnh.user_id = u.id
LEFT JOIN transactional_notification_templates tnt ON tnh.event_key = tnt.event_key
WHERE tnh.event_key LIKE 'tramite_%'
ORDER BY tnh.created_at DESC;

-- Permisos para la vista
GRANT SELECT ON historial_notificaciones_unificado TO authenticated;

-- Modificar send_transactional_notification para registrar en historial
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
  v_history_id uuid;
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
  v_email_sent boolean := false;
  v_whatsapp_sent boolean := false;
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

      v_email_sent := true;
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

      v_whatsapp_sent := true;
      RAISE NOTICE 'WhatsApp notification queued: % to %', v_request_id, v_user.celular_laboral;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Failed to queue WhatsApp notification: %', SQLERRM;
    END;
  END IF;

  -- 4. Registrar en historial
  INSERT INTO transactional_notification_history (
    event_key,
    user_id,
    email_sent,
    email_status,
    whatsapp_sent,
    whatsapp_status,
    inapp_notification_id,
    variables
  ) VALUES (
    p_event_key,
    p_user_id,
    v_email_sent,
    CASE WHEN v_email_sent THEN 'enviado' ELSE 'no_enviado' END,
    v_whatsapp_sent,
    CASE WHEN v_whatsapp_sent THEN 'enviado' ELSE 'no_enviado' END,
    v_notif_id,
    p_variables
  ) RETURNING id INTO v_history_id;

  RETURN v_notif_id;
END;
$$;

-- Comentario
COMMENT ON FUNCTION send_transactional_notification IS 'Envía notificación transaccional por todos los canales y registra en historial';
