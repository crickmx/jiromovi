/*
  # Fix enviar_notificacion_transaccional set-returning function error

  ## Problem
  The function uses `unnest()` (a set-returning function) inside a WHERE clause:
  
    ARRAY(
      SELECT unnest(ARRAY['email', 'whatsapp', 'in_app'])
      WHERE (unnest(...) = 'email' AND ...)
    )
  
  PostgreSQL raises "0A000: set-returning functions are not allowed in WHERE"
  when this function is called from a trigger on ticket_comentarios INSERT.

  ## Fix
  Replace the ARRAY(...unnest...WHERE...) pattern with a simple ARRAY[] constructor
  using CASE/IF logic to build the channels array correctly.
*/

CREATE OR REPLACE FUNCTION enviar_notificacion_transaccional(
  p_codigo_tipo text,
  p_destinatario_id uuid,
  p_variables jsonb DEFAULT '{}',
  p_adjuntos jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_template record;
  v_destinatario record;
  v_channels text[];
BEGIN
  SELECT 
    id,
    nombre_completo,
    email_laboral,
    celular_laboral
  INTO v_destinatario
  FROM usuarios
  WHERE id = p_destinatario_id
  AND deleted_at IS NULL
  AND estado != 'eliminado';

  IF NOT FOUND THEN
    RAISE WARNING '[NOTIF TRANSACCIONAL] Destinatario no encontrado o inactivo: %', p_destinatario_id;
    RETURN;
  END IF;

  SELECT
    t.codigo,
    t.nombre as tipo_nombre,
    p.asunto,
    p.html_cuerpo,
    p.whatsapp_plantilla,
    COALESCE(p.enviar_correo, true) as enviar_correo,
    COALESCE(p.enviar_whatsapp, true) as enviar_whatsapp,
    COALESCE(p.enviar_notificacion, true) as enviar_notificacion
  INTO v_template
  FROM correo_tipos_notificacion t
  LEFT JOIN correo_plantillas p ON p.tipo_notificacion_id = t.id AND p.es_plantilla_default = true
  WHERE t.codigo = p_codigo_tipo
  AND t.activo = true;

  IF NOT FOUND THEN
    RAISE WARNING '[NOTIF TRANSACCIONAL] Tipo de notificación no encontrado o inactivo: %', p_codigo_tipo;
    RETURN;
  END IF;

  v_channels := ARRAY[]::text[];
  IF v_template.enviar_correo THEN
    v_channels := v_channels || ARRAY['email'];
  END IF;
  IF v_template.enviar_whatsapp THEN
    v_channels := v_channels || ARRAY['whatsapp'];
  END IF;
  IF v_template.enviar_notificacion THEN
    v_channels := v_channels || ARRAY['in_app'];
  END IF;

  IF array_length(v_channels, 1) IS NULL THEN
    v_channels := ARRAY['email', 'whatsapp', 'in_app'];
  END IF;

  IF 'email' = ANY(v_channels) AND v_destinatario.email_laboral IS NOT NULL THEN
    INSERT INTO notification_jobs (
      event_code,
      user_id,
      channel,
      payload,
      attachments,
      status
    ) VALUES (
      p_codigo_tipo,
      p_destinatario_id,
      'email',
      p_variables || jsonb_build_object(
        'email', v_destinatario.email_laboral,
        'nombre_completo', v_destinatario.nombre_completo
      ),
      p_adjuntos,
      'pending'
    );
    RAISE NOTICE '[NOTIF TRANSACCIONAL] Email job creado para % (adjuntos: %)', 
      v_destinatario.email_laboral, 
      CASE WHEN p_adjuntos IS NOT NULL THEN jsonb_array_length(p_adjuntos) ELSE 0 END;
  END IF;

  IF 'whatsapp' = ANY(v_channels) AND v_destinatario.celular_laboral IS NOT NULL THEN
    INSERT INTO notification_jobs (
      event_code,
      user_id,
      channel,
      payload,
      status
    ) VALUES (
      p_codigo_tipo,
      p_destinatario_id,
      'whatsapp',
      p_variables || jsonb_build_object(
        'phone', v_destinatario.celular_laboral,
        'nombre_completo', v_destinatario.nombre_completo
      ),
      'pending'
    );
    RAISE NOTICE '[NOTIF TRANSACCIONAL] WhatsApp job creado para %', v_destinatario.celular_laboral;
  END IF;

  IF 'in_app' = ANY(v_channels) THEN
    INSERT INTO notification_jobs (
      event_code,
      user_id,
      channel,
      payload,
      status
    ) VALUES (
      p_codigo_tipo,
      p_destinatario_id,
      'in_app',
      p_variables || jsonb_build_object(
        'nombre_completo', v_destinatario.nombre_completo
      ),
      'pending'
    );
    RAISE NOTICE '[NOTIF TRANSACCIONAL] In-app job creado';
  END IF;

END;
$$;
