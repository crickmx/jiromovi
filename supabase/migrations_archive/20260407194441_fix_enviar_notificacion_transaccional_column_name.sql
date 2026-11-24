/*
  # Arreglar función enviar_notificacion_transaccional
  
  El problema es que la función busca la columna p.whatsapp_template
  pero la columna real se llama p.whatsapp_plantilla
*/

CREATE OR REPLACE FUNCTION enviar_notificacion_transaccional(
  p_codigo_tipo text,
  p_destinatario_id uuid,
  p_variables jsonb DEFAULT '{}'::jsonb,
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
  -- Obtener información del destinatario
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
  
  -- Obtener plantilla y canales configurados (columna correcta: whatsapp_plantilla)
  SELECT 
    t.codigo,
    t.nombre as tipo_nombre,
    p.asunto,
    p.html_cuerpo,
    p.whatsapp_plantilla,
    CASE 
      WHEN p.enviar_correo OR p.enviar_whatsapp OR p.enviar_notificacion THEN
        ARRAY(
          SELECT unnest(ARRAY['email', 'whatsapp', 'in_app']) 
          WHERE (unnest(ARRAY['email', 'whatsapp', 'in_app']) = 'email' AND p.enviar_correo)
             OR (unnest(ARRAY['email', 'whatsapp', 'in_app']) = 'whatsapp' AND p.enviar_whatsapp)
             OR (unnest(ARRAY['email', 'whatsapp', 'in_app']) = 'in_app' AND p.enviar_notificacion)
        )
      ELSE ARRAY['email', 'whatsapp', 'in_app']
    END as canales_activos
  INTO v_template
  FROM correo_tipos_notificacion t
  LEFT JOIN correo_plantillas p ON p.tipo_notificacion_id = t.id AND p.es_plantilla_default = true
  WHERE t.codigo = p_codigo_tipo
    AND t.activo = true;
  
  IF NOT FOUND THEN
    RAISE WARNING '[NOTIF TRANSACCIONAL] Tipo de notificación no encontrado o inactivo: %', p_codigo_tipo;
    RETURN;
  END IF;
  
  -- Obtener canales activos
  v_channels := COALESCE(v_template.canales_activos, ARRAY['email', 'whatsapp', 'in_app']);
  
  -- Crear jobs de notificación para cada canal activo
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
    
    RAISE NOTICE '[NOTIF TRANSACCIONAL] ✅ Email job creado para % (adjuntos: %)', 
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
    
    RAISE NOTICE '[NOTIF TRANSACCIONAL] ✅ WhatsApp job creado para %', v_destinatario.celular_laboral;
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
    
    RAISE NOTICE '[NOTIF TRANSACCIONAL] ✅ In-app job creado';
  END IF;
  
END;
$$;

COMMENT ON FUNCTION enviar_notificacion_transaccional IS 
  'Envía notificaciones transaccionales con soporte para adjuntos. Usa la columna correcta whatsapp_plantilla.';
