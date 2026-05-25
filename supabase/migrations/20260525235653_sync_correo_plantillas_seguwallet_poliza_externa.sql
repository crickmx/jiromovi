/*
  # Sync seguwallet_poliza_externa_cargada to correo_tipos_notificacion + correo_plantillas

  ## Problem
  The notification event seguwallet_poliza_externa_cargada exists in the delivery engine
  (notification_events_catalog + transactional_notification_templates) but is NOT visible
  in the admin UI because TiposNotificaciones.tsx reads from correo_tipos_notificacion
  and correo_plantillas.

  ## Fix
  1. Insert seguwallet_poliza_externa_cargada into correo_tipos_notificacion
  2. Insert default editable template into correo_plantillas
  3. Ensure seguwallet_siniestro_click also has a proper correo_plantillas entry (already exists, no-op)
*/

-- ─── Insert tipo de notificacion ─────────────────────────────────────────────
INSERT INTO correo_tipos_notificacion (
  codigo, nombre, descripcion, activo,
  enviar_correo, enviar_whatsapp, enviar_notificacion,
  permite_destinatarios_custom, modulo
)
VALUES (
  'seguwallet_poliza_externa_cargada',
  'SeguWallet - Nueva poliza externa cargada',
  'Notifica al agente cuando su cliente carga una nueva poliza externa en Seguwallet. Incluye campanita y WhatsApp.',
  true,
  false,
  true,
  true,
  false,
  'SEGUWALLET'
)
ON CONFLICT (codigo) DO UPDATE SET
  nombre       = EXCLUDED.nombre,
  descripcion  = EXCLUDED.descripcion,
  activo       = true,
  enviar_whatsapp     = true,
  enviar_notificacion = true,
  modulo       = 'SEGUWALLET',
  updated_at   = now();

-- ─── Insert default editable template ────────────────────────────────────────
INSERT INTO correo_plantillas (
  tipo_notificacion_id,
  asunto,
  html_cuerpo,
  variables_disponibles,
  es_plantilla_default,
  whatsapp_plantilla,
  whatsapp_variables_disponibles,
  notificacion_titulo,
  notificacion_cuerpo,
  notificacion_variables_disponibles,
  enviar_correo,
  enviar_whatsapp,
  enviar_notificacion
)
SELECT
  ctn.id,
  'Tu cliente {{cliente_nombre}} cargo una nueva poliza externa',
  '<p>Hola <strong>{{agente_nombre}}</strong>,</p><p>Tu cliente <strong>{{cliente_nombre}}</strong> acabo de cargar una poliza externa en SeguWallet.</p><ul><li>Aseguradora: {{aseguradora}}</li><li>Tipo de seguro: {{ramo}}</li><li>Poliza: {{numero_poliza}}</li><li>Fecha: {{fecha_carga}}</li></ul><p>Puedes revisarla desde tu panel de Seguwallet.</p>',
  ARRAY['agente_nombre','cliente_nombre','aseguradora','ramo','numero_poliza','fecha_carga'],
  true,
  E'Hola {{agente_nombre}}, tu cliente *{{cliente_nombre}}* acabo de cargar una poliza externa en SeguWallet.\n\nAseguradora: {{aseguradora}}\nTipo de seguro: {{ramo}}\nPoliza: {{numero_poliza}}\n\nPuedes revisarla desde tu panel de Seguwallet.',
  ARRAY['agente_nombre','cliente_nombre','aseguradora','ramo','numero_poliza','fecha_carga'],
  'Nueva poliza externa cargada',
  'Tu cliente {{cliente_nombre}} cargo una poliza de {{aseguradora}} ({{ramo}})',
  ARRAY['agente_nombre','cliente_nombre','aseguradora','ramo','numero_poliza','fecha_carga'],
  false,
  true,
  true
FROM correo_tipos_notificacion ctn
WHERE ctn.codigo = 'seguwallet_poliza_externa_cargada'
ON CONFLICT DO NOTHING;
