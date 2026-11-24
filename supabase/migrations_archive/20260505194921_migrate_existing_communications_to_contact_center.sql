/*
  # Migrate existing communications to Contact Center

  1. Data Migration
    - Copies all records from `correo_historial_envios` into `contact_center_messages`
    - Maps usuario_id directly when available
    - Falls back to email matching against usuarios.email_laboral
    - Maps canal_envio to channel (whatsapp/email)
    - Maps estado to status (enviado->sent, fallido->failed, pendiente->pending)
    - All migrated records marked as message_type='automatic' since they came from system
    - Sets provider based on channel (wazzup for whatsapp, resend for email)

  2. Important Notes
    - Records without a matchable agent user are skipped (they have no valid recipient)
    - This is a one-time backfill to populate the Contact Center with existing history
    - Does not affect the original correo_historial_envios table
*/

-- Insert records that have usuario_id directly
INSERT INTO contact_center_messages (
  agent_user_id,
  sender_user_id,
  sender_type,
  channel,
  message_type,
  direction,
  subject,
  body,
  html_body,
  status,
  provider,
  provider_message_id,
  provider_response,
  error_message,
  source_module,
  source_event,
  created_at,
  updated_at,
  metadata
)
SELECT
  h.usuario_id AS agent_user_id,
  h.enviado_por AS sender_user_id,
  CASE WHEN h.enviado_por IS NOT NULL THEN 'user' ELSE 'system' END AS sender_type,
  CASE
    WHEN h.canal_envio = 'whatsapp' THEN 'whatsapp'
    WHEN h.canal_envio = 'correo' THEN 'email'
    ELSE 'system'
  END AS channel,
  'automatic' AS message_type,
  'outbound' AS direction,
  h.asunto AS subject,
  COALESCE(
    CASE WHEN h.canal_envio = 'whatsapp' THEN h.cuerpo_html ELSE LEFT(h.cuerpo_html, 500) END,
    ''
  ) AS body,
  CASE WHEN h.canal_envio = 'correo' THEN h.cuerpo_html ELSE NULL END AS html_body,
  CASE
    WHEN h.estado = 'enviado' THEN 'sent'
    WHEN h.estado = 'fallido' THEN 'failed'
    WHEN h.estado = 'pendiente' THEN 'pending'
    ELSE 'sent'
  END AS status,
  CASE
    WHEN h.canal_envio = 'whatsapp' THEN 'wazzup'
    WHEN h.canal_envio = 'correo' THEN 'resend'
    ELSE 'internal'
  END AS provider,
  NULL AS provider_message_id,
  h.whatsapp_respuesta AS provider_response,
  h.error_mensaje AS error_message,
  COALESCE(
    CASE 
      WHEN h.tipo_notificacion_codigo LIKE 'tramite_%' THEN 'tramites'
      WHEN h.tipo_notificacion_codigo LIKE 'comision%' THEN 'comisiones'
      WHEN h.tipo_notificacion_codigo LIKE 'bienvenida%' OR h.tipo_notificacion_codigo LIKE 'cuenta_%' THEN 'usuarios'
      WHEN h.tipo_notificacion_codigo LIKE 'comunicado%' THEN 'comunicados'
      ELSE 'sistema'
    END, 'sistema'
  ) AS source_module,
  h.tipo_notificacion_codigo AS source_event,
  COALESCE(h.fecha_envio, h.created_at) AS created_at,
  COALESCE(h.fecha_envio, h.created_at) AS updated_at,
  jsonb_build_object(
    'migrated_from', 'correo_historial_envios',
    'original_id', h.id,
    'destinatario_email', h.destinatario_email,
    'destinatario_nombre', h.destinatario_nombre,
    'numero_destino', h.numero_destino
  ) AS metadata
FROM correo_historial_envios h
WHERE h.usuario_id IS NOT NULL
  AND EXISTS (SELECT 1 FROM usuarios u WHERE u.id = h.usuario_id);

-- Insert records without usuario_id but matchable by email
INSERT INTO contact_center_messages (
  agent_user_id,
  sender_user_id,
  sender_type,
  channel,
  message_type,
  direction,
  subject,
  body,
  html_body,
  status,
  provider,
  provider_message_id,
  provider_response,
  error_message,
  source_module,
  source_event,
  created_at,
  updated_at,
  metadata
)
SELECT
  u.id AS agent_user_id,
  h.enviado_por AS sender_user_id,
  CASE WHEN h.enviado_por IS NOT NULL THEN 'user' ELSE 'system' END AS sender_type,
  CASE
    WHEN h.canal_envio = 'whatsapp' THEN 'whatsapp'
    WHEN h.canal_envio = 'correo' THEN 'email'
    ELSE 'system'
  END AS channel,
  'automatic' AS message_type,
  'outbound' AS direction,
  h.asunto AS subject,
  COALESCE(
    CASE WHEN h.canal_envio = 'whatsapp' THEN h.cuerpo_html ELSE LEFT(h.cuerpo_html, 500) END,
    ''
  ) AS body,
  CASE WHEN h.canal_envio = 'correo' THEN h.cuerpo_html ELSE NULL END AS html_body,
  CASE
    WHEN h.estado = 'enviado' THEN 'sent'
    WHEN h.estado = 'fallido' THEN 'failed'
    WHEN h.estado = 'pendiente' THEN 'pending'
    ELSE 'sent'
  END AS status,
  CASE
    WHEN h.canal_envio = 'whatsapp' THEN 'wazzup'
    WHEN h.canal_envio = 'correo' THEN 'resend'
    ELSE 'internal'
  END AS provider,
  NULL AS provider_message_id,
  h.whatsapp_respuesta AS provider_response,
  h.error_mensaje AS error_message,
  COALESCE(
    CASE 
      WHEN h.tipo_notificacion_codigo LIKE 'tramite_%' THEN 'tramites'
      WHEN h.tipo_notificacion_codigo LIKE 'comision%' THEN 'comisiones'
      WHEN h.tipo_notificacion_codigo LIKE 'bienvenida%' OR h.tipo_notificacion_codigo LIKE 'cuenta_%' THEN 'usuarios'
      WHEN h.tipo_notificacion_codigo LIKE 'comunicado%' THEN 'comunicados'
      ELSE 'sistema'
    END, 'sistema'
  ) AS source_module,
  h.tipo_notificacion_codigo AS source_event,
  COALESCE(h.fecha_envio, h.created_at) AS created_at,
  COALESCE(h.fecha_envio, h.created_at) AS updated_at,
  jsonb_build_object(
    'migrated_from', 'correo_historial_envios',
    'original_id', h.id,
    'destinatario_email', h.destinatario_email,
    'destinatario_nombre', h.destinatario_nombre,
    'numero_destino', h.numero_destino
  ) AS metadata
FROM correo_historial_envios h
JOIN usuarios u ON u.email_laboral = h.destinatario_email
WHERE h.usuario_id IS NULL;
