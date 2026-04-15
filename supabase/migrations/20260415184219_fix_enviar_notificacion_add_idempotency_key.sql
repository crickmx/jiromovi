/*
  # Fix enviar_notificacion_transaccional - add idempotency_key

  The notification_jobs table requires a non-null idempotency_key column.
  Generate it as: event_code + user_id + channel + timestamp truncated to minute
  This prevents duplicate notifications within the same minute for the same event+user+channel.
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
  v_idem_base text;
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

  v_idem_base := p_codigo_tipo || '_' || p_destinatario_id::text || '_' || to_char(date_trunc('minute', now()), 'YYYYMMDD_HH24MI');

  IF 'email' = ANY(v_channels) AND v_destinatario.email_laboral IS NOT NULL THEN
    INSERT INTO notification_jobs (
      event_code,
      user_id,
      channel,
      payload,
      attachments,
      status,
      idempotency_key
    ) VALUES (
      p_codigo_tipo,
      p_destinatario_id,
      'email',
      p_variables || jsonb_build_object(
        'email', v_destinatario.email_laboral,
        'nombre_completo', v_destinatario.nombre_completo
      ),
      p_adjuntos,
      'pending',
      v_idem_base || '_email'
    )
    ON CONFLICT (idempotency_key) DO NOTHING;

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
      status,
      idempotency_key
    ) VALUES (
      p_codigo_tipo,
      p_destinatario_id,
      'whatsapp',
      p_variables || jsonb_build_object(
        'phone', v_destinatario.celular_laboral,
        'nombre_completo', v_destinatario.nombre_completo
      ),
      'pending',
      v_idem_base || '_whatsapp'
    )
    ON CONFLICT (idempotency_key) DO NOTHING;

    RAISE NOTICE '[NOTIF TRANSACCIONAL] WhatsApp job creado para %', v_destinatario.celular_laboral;
  END IF;

  IF 'in_app' = ANY(v_channels) THEN
    INSERT INTO notification_jobs (
      event_code,
      user_id,
      channel,
      payload,
      status,
      idempotency_key
    ) VALUES (
      p_codigo_tipo,
      p_destinatario_id,
      'in_app',
      p_variables || jsonb_build_object(
        'nombre_completo', v_destinatario.nombre_completo
      ),
      'pending',
      v_idem_base || '_in_app'
    )
    ON CONFLICT (idempotency_key) DO NOTHING;

    RAISE NOTICE '[NOTIF TRANSACCIONAL] In-app job creado';
  END IF;

END;
$$;
