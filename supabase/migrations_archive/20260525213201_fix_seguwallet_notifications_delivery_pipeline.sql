/*
  # Fix SeguWallet Notifications - Register in Delivery Pipeline

  The project uses TWO notification systems:
  1. correo_tipos_notificacion + correo_plantillas → UI display/editing only
  2. notification_events_catalog + transactional_notification_templates → actual delivery engine

  This migration registers seguwallet_siniestro_click in the delivery pipeline so
  WhatsApp and in-app notifications are actually sent via the notification-dispatcher.

  Changes:
  - Inserts seguwallet_siniestro_click into notification_events_catalog (enable_whatsapp + enable_in_app)
  - Inserts editable template into transactional_notification_templates
  - The template content matches what was defined in correo_plantillas
*/

-- ─── Register in notification_events_catalog ─────────────────────────────────
INSERT INTO notification_events_catalog (
  event_code, event_name, module, description,
  enable_in_app, enable_email, enable_whatsapp,
  template_in_app, template_whatsapp,
  priority, active
) VALUES (
  'seguwallet_siniestro_click',
  'SeguWallet - Alerta siniestro cliente',
  'seguwallet',
  'Notifica al agente MOVI cuando su cliente de SeguWallet hace clic en el boton de reportar siniestro.',
  true,   -- in-app bell
  false,  -- no email
  true,   -- whatsapp
  jsonb_build_object(
    'titulo', 'Alerta de siniestro - SeguWallet',
    'mensaje', 'Tu cliente {{cliente_nombre}} contacto siniestros de {{aseguradora_nombre}} ({{tipo_contacto}})',
    'accion_url', '/seguwallet'
  ),
  jsonb_build_object(
    'variables', ARRAY['cliente_nombre', 'aseguradora_nombre', 'telefono_siniestros', 'tipo_contacto', 'fecha_hora']
  ),
  'normal',
  true
)
ON CONFLICT (event_code) DO UPDATE SET
  enable_in_app = true,
  enable_whatsapp = true,
  active = true,
  updated_at = now();

-- ─── Register editable template in transactional_notification_templates ──────
INSERT INTO transactional_notification_templates (
  event_key, name,
  email_subject_template, email_body_template,
  whatsapp_body_template,
  inapp_title_template, inapp_body_template,
  is_active
) VALUES (
  'seguwallet_siniestro_click',
  'SeguWallet - Alerta siniestro cliente',
  'Tu cliente {{cliente_nombre}} contacto siniestros de {{aseguradora_nombre}}',
  '',  -- email disabled, body unused
  'Tu cliente *{{cliente_nombre}}* contacto siniestros de *{{aseguradora_nombre}}* ({{tipo_contacto}}) al {{telefono_siniestros}} el {{fecha_hora}}. Puedes dar seguimiento desde SeguWallet.',
  'Alerta de siniestro - SeguWallet',
  'Tu cliente {{cliente_nombre}} contacto siniestros de {{aseguradora_nombre}} ({{tipo_contacto}})',
  true
)
ON CONFLICT (event_key) DO UPDATE SET
  whatsapp_body_template = EXCLUDED.whatsapp_body_template,
  inapp_title_template = EXCLUDED.inapp_title_template,
  inapp_body_template = EXCLUDED.inapp_body_template,
  is_active = true,
  updated_at = now();
