/*
  # Seguwallet Notification Templates - Add Missing Types and Standardize

  ## Summary
  Ensures all Seguwallet events have:
  1. A tipo_notificacion entry (event type)
  2. A correo_plantillas row with:
     - notificacion_titulo + notificacion_cuerpo (in-app bell)
     - whatsapp_plantilla (WhatsApp text)
     - enviar_notificacion / enviar_whatsapp / enviar_correo flags
     - resend_channel_id pointing to "Resend Seguwallet"
     - wazzup24_channel_id pointing to "WhatsApp Seguwallet"

  ## New event types added
  - seguwallet_perfil_completado — customer completes their profile
  - seguwallet_terminos_aceptados — customer accepts terms
  - seguwallet_492_documento_cargado — customer uploads a 492 expediente document

  ## Modified
  - seguwallet_siniestro_click: ensure enviar_notificacion=true, wazzup24_channel_id set
  - seguwallet_poliza_externa_cargada: ensure wazzup24_channel_id set

  ## Channel IDs (fixed, from notification_channels table)
  - Resend Seguwallet:   b2305bbc-9a1e-40e7-943d-764ef56c1ebd
  - WhatsApp Seguwallet: d93020a5-3805-4409-9cda-c641e6cdfe68
*/

-- ── 1. Ensure existing siniestro_click template has notification fields set ──
UPDATE correo_plantillas SET
  enviar_notificacion = true,
  wazzup24_channel_id = 'd93020a5-3805-4409-9cda-c641e6cdfe68',
  resend_channel_id   = 'b2305bbc-9a1e-40e7-943d-764ef56c1ebd',
  variables_disponibles = ARRAY['cliente_nombre','aseguradora_nombre','tipo_contacto','telefono_siniestros','fecha_hora'],
  whatsapp_variables_disponibles = ARRAY['cliente_nombre','aseguradora_nombre','tipo_contacto','telefono_siniestros','fecha_hora'],
  notificacion_variables_disponibles = ARRAY['cliente_nombre','aseguradora_nombre','tipo_contacto','fecha_hora']
WHERE tipo_notificacion_id = (
  SELECT id FROM correo_tipos_notificacion WHERE codigo = 'seguwallet_siniestro_click'
);

-- ── 2. Ensure poliza_externa_cargada template has channel set ──
UPDATE correo_plantillas SET
  enviar_notificacion = true,
  wazzup24_channel_id = 'd93020a5-3805-4409-9cda-c641e6cdfe68',
  resend_channel_id   = 'b2305bbc-9a1e-40e7-943d-764ef56c1ebd'
WHERE tipo_notificacion_id = (
  SELECT id FROM correo_tipos_notificacion WHERE codigo = 'seguwallet_poliza_externa_cargada'
);

-- ── 3. seguwallet_perfil_completado ──
INSERT INTO correo_tipos_notificacion (codigo, nombre, descripcion, activo)
VALUES (
  'seguwallet_perfil_completado',
  'Seguwallet - Perfil completado',
  'Notifica al agente cuando su cliente completa el perfil en Seguwallet.',
  true
)
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO correo_plantillas (
  tipo_notificacion_id,
  asunto,
  html_cuerpo,
  whatsapp_plantilla,
  notificacion_titulo,
  notificacion_cuerpo,
  variables_disponibles,
  whatsapp_variables_disponibles,
  notificacion_variables_disponibles,
  enviar_correo,
  enviar_whatsapp,
  enviar_notificacion,
  es_plantilla_default,
  resend_channel_id,
  wazzup24_channel_id
)
SELECT
  t.id,
  'Tu cliente {{cliente_nombre}} completó su perfil en Seguwallet',
  '<p>Tu cliente <strong>{{cliente_nombre}}</strong> acaba de completar su perfil en <strong>Seguwallet</strong>.</p><p>Ahora tiene toda su información registrada y está listo para gestionar sus pólizas contigo.</p>',
  'Tu cliente *{{cliente_nombre}}* acaba de completar su perfil en Seguwallet. Ya puede gestionar sus pólizas contigo.',
  'Perfil completado - SeguWallet',
  'Tu cliente {{cliente_nombre}} completó su perfil',
  ARRAY['cliente_nombre','agente_nombre'],
  ARRAY['cliente_nombre','agente_nombre'],
  ARRAY['cliente_nombre'],
  false,
  true,
  true,
  true,
  'b2305bbc-9a1e-40e7-943d-764ef56c1ebd',
  'd93020a5-3805-4409-9cda-c641e6cdfe68'
FROM correo_tipos_notificacion t
WHERE t.codigo = 'seguwallet_perfil_completado'
  AND NOT EXISTS (
    SELECT 1 FROM correo_plantillas p WHERE p.tipo_notificacion_id = t.id
  );

-- ── 4. seguwallet_terminos_aceptados ──
INSERT INTO correo_tipos_notificacion (codigo, nombre, descripcion, activo)
VALUES (
  'seguwallet_terminos_aceptados',
  'Seguwallet - Términos aceptados',
  'Notifica al agente cuando su cliente acepta los términos y condiciones de Seguwallet.',
  true
)
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO correo_plantillas (
  tipo_notificacion_id,
  asunto,
  html_cuerpo,
  whatsapp_plantilla,
  notificacion_titulo,
  notificacion_cuerpo,
  variables_disponibles,
  whatsapp_variables_disponibles,
  notificacion_variables_disponibles,
  enviar_correo,
  enviar_whatsapp,
  enviar_notificacion,
  es_plantilla_default,
  resend_channel_id,
  wazzup24_channel_id
)
SELECT
  t.id,
  'Tu cliente {{cliente_nombre}} aceptó los términos en Seguwallet',
  '<p>Tu cliente <strong>{{cliente_nombre}}</strong> aceptó los términos y condiciones de Seguwallet.</p>',
  'Tu cliente *{{cliente_nombre}}* aceptó los términos y condiciones de Seguwallet.',
  'Términos aceptados - SeguWallet',
  'Tu cliente {{cliente_nombre}} aceptó los términos',
  ARRAY['cliente_nombre','agente_nombre','version_terminos'],
  ARRAY['cliente_nombre','agente_nombre'],
  ARRAY['cliente_nombre'],
  false,
  false,
  true,
  true,
  'b2305bbc-9a1e-40e7-943d-764ef56c1ebd',
  'd93020a5-3805-4409-9cda-c641e6cdfe68'
FROM correo_tipos_notificacion t
WHERE t.codigo = 'seguwallet_terminos_aceptados'
  AND NOT EXISTS (
    SELECT 1 FROM correo_plantillas p WHERE p.tipo_notificacion_id = t.id
  );

-- ── 5. seguwallet_492_documento_cargado ──
INSERT INTO correo_tipos_notificacion (codigo, nombre, descripcion, activo)
VALUES (
  'seguwallet_492_documento_cargado',
  'Seguwallet - Documento 492 cargado',
  'Notifica al agente cuando su cliente carga un documento en su Expediente 492 en Seguwallet.',
  true
)
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO correo_plantillas (
  tipo_notificacion_id,
  asunto,
  html_cuerpo,
  whatsapp_plantilla,
  notificacion_titulo,
  notificacion_cuerpo,
  variables_disponibles,
  whatsapp_variables_disponibles,
  notificacion_variables_disponibles,
  enviar_correo,
  enviar_whatsapp,
  enviar_notificacion,
  es_plantilla_default,
  resend_channel_id,
  wazzup24_channel_id
)
SELECT
  t.id,
  'Tu cliente {{cliente_nombre}} cargó un documento en su Expediente 492',
  '<p>Tu cliente <strong>{{cliente_nombre}}</strong> acaba de cargar un documento en su <strong>Expediente 492</strong> en Seguwallet.</p><p>Documento: <strong>{{nombre_documento}}</strong></p>',
  'Tu cliente *{{cliente_nombre}}* cargó un documento en su Expediente 492 en Seguwallet: {{nombre_documento}}',
  'Documento 492 cargado - SeguWallet',
  'Tu cliente {{cliente_nombre}} cargó: {{nombre_documento}}',
  ARRAY['cliente_nombre','agente_nombre','nombre_documento'],
  ARRAY['cliente_nombre','nombre_documento'],
  ARRAY['cliente_nombre','nombre_documento'],
  false,
  true,
  true,
  true,
  'b2305bbc-9a1e-40e7-943d-764ef56c1ebd',
  'd93020a5-3805-4409-9cda-c641e6cdfe68'
FROM correo_tipos_notificacion t
WHERE t.codigo = 'seguwallet_492_documento_cargado'
  AND NOT EXISTS (
    SELECT 1 FROM correo_plantillas p WHERE p.tipo_notificacion_id = t.id
  );
