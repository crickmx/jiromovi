/*
  # Enrutamiento de canal + branding real para transactional_notification_templates

  El motor de envío real (edge function notification-dispatcher, cron cada minuto,
  procesa notification_jobs) nunca respetaba el canal de notificación asignado por
  plantilla ni aplicaba header/footer de marca — siempre usaba el canal "default"
  (Resend Default / WhatsApp Default = identidad MOVI), sin importar si el evento
  era platform='seguwallet' (agenda_recordatorio_invitado, seguwallet_siniestro_click,
  welcome_client_seguwallet_*, login_code_seguwallet_*, etc).

  Causa: transactional_notification_templates nunca tuvo columnas resend_channel_id/
  wazzup24_channel_id (a diferencia de correo_plantillas, que sí las tiene desde el
  27 de mayo — pero esa tabla es solo de UI/edición, no la usa el dispatcher real).

  Se agregan las columnas y se retro-llenan según la columna platform (movi/seguwallet,
  ya poblada de forma consistente en todas las filas existentes) contra los canales
  reales ya configurados (Resend Default/Seguwallet, WhatsApp Default/Seguwallet).
*/

ALTER TABLE public.transactional_notification_templates
  ADD COLUMN IF NOT EXISTS resend_channel_id uuid REFERENCES public.notification_channels(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS wazzup24_channel_id uuid REFERENCES public.notification_channels(id) ON DELETE SET NULL;

DO $$
DECLARE
  v_resend_movi uuid;
  v_wa_movi uuid;
  v_resend_sw uuid;
  v_wa_sw uuid;
BEGIN
  SELECT id INTO v_resend_movi FROM notification_channels WHERE type = 'email_resend' AND is_default = true LIMIT 1;
  SELECT id INTO v_wa_movi FROM notification_channels WHERE type = 'whatsapp_wazzup24' AND is_default = true LIMIT 1;
  SELECT id INTO v_resend_sw FROM notification_channels WHERE type = 'email_resend' AND name = 'Resend Seguwallet' LIMIT 1;
  SELECT id INTO v_wa_sw FROM notification_channels WHERE type = 'whatsapp_wazzup24' AND name = 'WhatsApp Seguwallet' LIMIT 1;

  UPDATE transactional_notification_templates
     SET resend_channel_id = COALESCE(resend_channel_id, v_resend_movi),
         wazzup24_channel_id = COALESCE(wazzup24_channel_id, v_wa_movi)
   WHERE platform = 'movi';

  UPDATE transactional_notification_templates
     SET resend_channel_id = COALESCE(resend_channel_id, v_resend_sw),
         wazzup24_channel_id = COALESCE(wazzup24_channel_id, v_wa_sw)
   WHERE platform = 'seguwallet';
END $$;
