/*
  # Fix: Corregir URLs de notificaciones a app.movi.digital

  1. Cambios
    - Agregar columna attachments a notification_jobs para adjuntos en correos
    - Actualizar todas las plantillas que usen moviapp.com a app.movi.digital
    
  2. Seguridad
    - Solo actualizaciones de datos, sin cambios de permisos
*/

-- Agregar soporte para adjuntos en notification_jobs
ALTER TABLE notification_jobs 
ADD COLUMN IF NOT EXISTS attachments jsonb DEFAULT '[]'::jsonb;

COMMENT ON COLUMN notification_jobs.attachments IS 
  'Array de adjuntos para correos: [{ filename: string, content_type: string, storage_path: string, url: string }]';

-- Actualizar plantillas de correo que usen moviapp.com
UPDATE correo_plantillas
SET 
  html_cuerpo = REPLACE(html_cuerpo, 'https://moviapp.com', 'https://app.movi.digital'),
  whatsapp_plantilla = REPLACE(whatsapp_plantilla, 'https://moviapp.com', 'https://app.movi.digital')
WHERE 
  html_cuerpo LIKE '%moviapp.com%' 
  OR whatsapp_plantilla LIKE '%moviapp.com%';

-- Actualizar catálogo de eventos de notificación
UPDATE notification_events_catalog
SET 
  template_in_app = jsonb_set(
    template_in_app,
    '{accion_url}',
    to_jsonb(REPLACE(template_in_app->>'accion_url', 'https://moviapp.com', 'https://app.movi.digital'))
  )
WHERE template_in_app->>'accion_url' LIKE '%moviapp.com%';

UPDATE notification_events_catalog
SET 
  template_email = jsonb_set(
    template_email,
    '{url}',
    to_jsonb(REPLACE(template_email->>'url', 'https://moviapp.com', 'https://app.movi.digital'))
  )
WHERE template_email->>'url' LIKE '%moviapp.com%';

-- Comentario para documentar el cambio
COMMENT ON COLUMN notification_events_catalog.template_in_app IS 
  'Plantilla JSON para notificaciones in-app. URLs deben usar https://app.movi.digital';

COMMENT ON COLUMN notification_events_catalog.template_email IS 
  'Plantilla JSON para correos. URLs deben usar https://app.movi.digital';
