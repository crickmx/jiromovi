/*
  # Update Web Monitor notification template for SSL focus

  1. Changes
    - Updated WhatsApp template to focus on SSL certificate changes
    - Updated email subject to reflect SSL-specific alerts
    - Ensures WhatsApp is enabled for this notification type

  2. Important Notes
    - Template now says "Alerta SSL" instead of generic "Alerta Monitor Web"
    - The trigger already filters to only SSL changes, this just makes the message clearer
*/

UPDATE correo_plantillas
SET
  asunto = 'Alerta SSL: {{url}} certificado cambio a {{new_status}}',
  whatsapp_plantilla = 'Alerta SSL Monitor Web: El sitio {{url}} cambio su certificado SSL de {{old_status}} a {{new_status}}. Revisar de inmediato si el estado es critico.',
  enviar_whatsapp = true
WHERE id = '70812838-7878-4ebf-99b8-c4bce379be5d';
