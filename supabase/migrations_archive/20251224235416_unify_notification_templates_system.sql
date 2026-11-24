/*
  # Unificación del sistema de plantillas de notificaciones
  
  1. Cambios
    - Agregar campos de notificación interna (campanita) a correo_plantillas
    - Todos los canales (email, whatsapp, campanita) en una sola tabla
  
  2. Estructura
    - notificacion_titulo: Título para notificación interna
    - notificacion_cuerpo: Cuerpo para notificación interna
    - notificacion_variables_disponibles: Variables para notificación interna
*/

-- Agregar campos de notificación interna a correo_plantillas
ALTER TABLE correo_plantillas
  ADD COLUMN IF NOT EXISTS notificacion_titulo text,
  ADD COLUMN IF NOT EXISTS notificacion_cuerpo text,
  ADD COLUMN IF NOT EXISTS notificacion_variables_disponibles text[];

-- Actualizar plantillas existentes con valores por defecto basados en email
UPDATE correo_plantillas 
SET 
  notificacion_titulo = asunto,
  notificacion_cuerpo = 
    CASE 
      WHEN html_cuerpo LIKE '%<p>%' THEN 
        regexp_replace(html_cuerpo, '<[^>]+>', '', 'g')
      ELSE 
        html_cuerpo
    END,
  notificacion_variables_disponibles = variables_disponibles
WHERE notificacion_titulo IS NULL;

-- Comentario sobre la unificación
COMMENT ON COLUMN correo_plantillas.notificacion_titulo IS 'Título para notificaciones internas (campanita)';
COMMENT ON COLUMN correo_plantillas.notificacion_cuerpo IS 'Cuerpo para notificaciones internas (campanita)';
COMMENT ON COLUMN correo_plantillas.notificacion_variables_disponibles IS 'Variables disponibles para notificaciones internas';

COMMENT ON TABLE correo_plantillas IS 'Plantillas unificadas para todos los canales de notificación: Email, WhatsApp y Notificaciones Internas';
