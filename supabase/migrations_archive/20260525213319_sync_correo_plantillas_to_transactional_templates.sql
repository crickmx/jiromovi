/*
  # Sync correo_plantillas edits to transactional_notification_templates

  When an admin edits a SeguWallet notification template via the UI (correo_plantillas),
  this trigger syncs the changes to transactional_notification_templates which is what
  the notification-dispatcher actually uses for delivery.

  Only syncs for event codes that exist in both tables (seguwallet_siniestro_click).
*/

CREATE OR REPLACE FUNCTION sync_seguwallet_template_to_transactional()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_codigo text;
BEGIN
  -- Get the notification type code
  SELECT codigo INTO v_codigo
  FROM correo_tipos_notificacion
  WHERE id = NEW.tipo_notificacion_id;

  -- Only sync seguwallet templates that exist in transactional_notification_templates
  IF v_codigo IS NOT NULL AND EXISTS (
    SELECT 1 FROM transactional_notification_templates WHERE event_key = v_codigo
  ) THEN
    UPDATE transactional_notification_templates
    SET
      whatsapp_body_template = COALESCE(NEW.whatsapp_plantilla, whatsapp_body_template),
      inapp_title_template   = COALESCE(NEW.notificacion_titulo, inapp_title_template),
      inapp_body_template    = COALESCE(NEW.notificacion_cuerpo, inapp_body_template),
      updated_at             = now()
    WHERE event_key = v_codigo;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_seguwallet_template ON correo_plantillas;

CREATE TRIGGER trg_sync_seguwallet_template
  AFTER INSERT OR UPDATE ON correo_plantillas
  FOR EACH ROW
  EXECUTE FUNCTION sync_seguwallet_template_to_transactional();
