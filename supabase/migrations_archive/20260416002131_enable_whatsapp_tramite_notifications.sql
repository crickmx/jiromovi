/*
  # Enable WhatsApp channel for tramite notifications

  All 4 tramite notification templates had enviar_whatsapp = false,
  which prevented WhatsApp jobs from being created even when users
  have a celular_laboral configured.

  ## Changes
  - tramite_comentario_nuevo   - enviar_whatsapp = true
  - tramite_documento_cargado  - enviar_whatsapp = true
  - tramite_cambio_estatus     - enviar_whatsapp = true
  - tramite_actualizado        - enviar_whatsapp = true
*/

UPDATE correo_plantillas p
SET enviar_whatsapp = true
FROM correo_tipos_notificacion t
WHERE t.id = p.tipo_notificacion_id
  AND t.codigo IN (
    'tramite_comentario_nuevo',
    'tramite_documento_cargado',
    'tramite_cambio_estatus',
    'tramite_actualizado'
  );
