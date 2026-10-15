/*
  # Agregar soporte de WhatsApp a Notificaciones Globales

  1. Cambios en la tabla
    - `enviar_whatsapp` (boolean) - Indica si enviar también por WhatsApp
    - `whatsapp_enviado` (boolean) - Indica si el WhatsApp fue enviado
    - `whatsapp_fecha_envio` (timestamptz) - Fecha de envío del WhatsApp
    - `whatsapp_total_enviados` (integer) - Total de WhatsApps enviados
    - `whatsapp_total_fallidos` (integer) - Total de WhatsApps fallidos

  2. Notas
    - El campo `enviar_whatsapp` permite al admin elegir el canal
    - Si es false, solo se envía notificación push (campanita)
    - Si es true, se envía push + WhatsApp a todos los destinatarios con teléfono
*/

-- Agregar columnas para soporte de WhatsApp
ALTER TABLE notificaciones_globales
ADD COLUMN IF NOT EXISTS enviar_whatsapp boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS whatsapp_enviado boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS whatsapp_fecha_envio timestamptz,
ADD COLUMN IF NOT EXISTS whatsapp_total_enviados integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS whatsapp_total_fallidos integer DEFAULT 0;

-- Crear índice para consultas
CREATE INDEX IF NOT EXISTS idx_notificaciones_globales_enviar_whatsapp 
ON notificaciones_globales(enviar_whatsapp);
