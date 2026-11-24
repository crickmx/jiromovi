/*
  # Add Tramite Events to notification_events_catalog

  The notification-dispatcher edge function reads from notification_events_catalog
  to find event templates. The tramite events only existed in correo_tipos_notificacion
  but NOT in notification_events_catalog, causing "Evento no encontrado" errors for
  all tramite notifications.

  ## Changes
  1. Insert 4 tramite event codes into notification_events_catalog with proper templates
  2. Reset all failed tramite notification_jobs back to 'pending' so they get retried
*/

INSERT INTO notification_events_catalog (
  event_code,
  event_name,
  module,
  description,
  enable_in_app,
  enable_email,
  enable_whatsapp,
  template_in_app,
  template_email,
  template_whatsapp,
  priority,
  active
)
VALUES
(
  'tramite_comentario_nuevo',
  'Nuevo Comentario en Trámite',
  'Trámites',
  'Se envía cuando se agrega un comentario en un trámite',
  true, true, true,
  '{"titulo": "Nuevo comentario en trámite {{folio}}", "mensaje": "{{autor_nombre}} agregó un comentario: {{comentario}}", "accion_url": "{{url}}"}',
  '{"asunto": "Nuevo comentario en tu trámite {{folio}}", "variables": ["folio", "agente_nombre", "comentario", "autor_nombre", "autor_rol", "tipo_tramite", "estatus", "url"]}',
  '{"variables": ["folio", "autor_nombre", "comentario", "url"]}',
  'normal',
  true
),
(
  'tramite_cambio_estatus',
  'Cambio de Estatus en Trámite',
  'Trámites',
  'Se envía cuando cambia el estatus de un trámite',
  true, true, true,
  '{"titulo": "Trámite {{folio}} cambió a {{estatus_nuevo}}", "mensaje": "El estatus de tu trámite cambió de {{estatus_anterior}} a {{estatus_nuevo}}.", "accion_url": "{{url}}"}',
  '{"asunto": "El estatus de tu trámite {{folio}} cambió a {{estatus_nuevo}}", "variables": ["folio", "agente_nombre", "estatus_anterior", "estatus_nuevo", "modificado_por", "rol_modificador", "tipo_tramite", "url"]}',
  '{"variables": ["folio", "estatus_anterior", "estatus_nuevo", "modificado_por", "url"]}',
  'normal',
  true
),
(
  'tramite_documento_cargado',
  'Nuevo Documento en Trámite',
  'Trámites',
  'Se envía cuando se carga un documento en un trámite',
  true, true, true,
  '{"titulo": "Nuevo documento en trámite {{folio}}", "mensaje": "{{subido_por}} cargó el archivo {{nombre_archivo}}.", "accion_url": "{{url}}"}',
  '{"asunto": "Nuevo documento en tu trámite {{folio}}", "variables": ["folio", "agente_nombre", "nombre_archivo", "subido_por", "rol_subidor", "tamano_archivo", "tipo_tramite", "estatus", "url"]}',
  '{"variables": ["folio", "nombre_archivo", "subido_por", "url"]}',
  'normal',
  true
),
(
  'tramite_actualizado',
  'Trámite Actualizado',
  'Trámites',
  'Se envía cuando se actualiza información general de un trámite',
  true, true, true,
  '{"titulo": "Trámite {{folio}} actualizado", "mensaje": "{{modificado_por}} actualizó: {{campos_modificados}}.", "accion_url": "{{url}}"}',
  '{"asunto": "Tu trámite {{folio}} ha sido actualizado", "variables": ["folio", "agente_nombre", "modificado_por", "rol_modificador", "campos_modificados", "tipo_tramite", "estatus", "url"]}',
  '{"variables": ["folio", "modificado_por", "campos_modificados", "url"]}',
  'normal',
  true
)
ON CONFLICT (event_code) DO UPDATE SET
  active = true,
  template_in_app = EXCLUDED.template_in_app,
  template_email = EXCLUDED.template_email,
  template_whatsapp = EXCLUDED.template_whatsapp,
  updated_at = now();

-- Reset failed tramite jobs to pending so they get retried
UPDATE notification_jobs
SET
  status = 'pending',
  attempt_count = 0,
  last_error = NULL,
  next_retry_at = NULL,
  updated_at = now()
WHERE
  event_code IN ('tramite_comentario_nuevo', 'tramite_cambio_estatus', 'tramite_documento_cargado', 'tramite_actualizado')
  AND status IN ('failed', 'processing');
