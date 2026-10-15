
-- 1. Cancel all pending jobs older than 3 days (May 28-29 backlog)
UPDATE notification_jobs
SET 
  status = 'cancelled',
  last_error = 'Cancelado: trabajo pendiente por más de 3 días sin procesarse',
  updated_at = NOW()
WHERE status = 'pending'
  AND created_at < NOW() - INTERVAL '3 days';

-- 2. Fix tramite_documento_cargado double-send:
--    Disable email/WhatsApp in the DB-trigger template so the DB trigger
--    only creates in-app jobs. The ticket-notification-dispatcher edge function
--    handles email+WhatsApp with actual file attachments.
UPDATE correo_plantillas p
SET 
  enviar_correo = false,
  enviar_whatsapp = false
FROM correo_tipos_notificacion t
WHERE t.id = p.tipo_notificacion_id
  AND t.codigo = 'tramite_documento_cargado'
  AND p.es_plantilla_default = true;
