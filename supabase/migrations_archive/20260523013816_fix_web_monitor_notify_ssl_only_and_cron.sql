/*
  # Fix Web Monitor: SSL-only WhatsApp notifications + 12h cron

  1. Changes
    - Modified trigger function to only send notifications for SSL changes (change_type = 'ssl')
    - Status/speed changes are ignored (no notification)
    - Created a 12-hour recurring cron job that calls the monitor-sites edge function

  2. Security
    - Trigger function uses SECURITY DEFINER with explicit search_path
    - Cron job uses service role key for authentication

  3. Important Notes
    - Only SSL certificate changes trigger WhatsApp notifications to ccjimenez@jiro.com.mx
    - The cron runs at 06:00 and 18:00 UTC daily (every 12 hours)
*/

-- 1. Replace the trigger function to only notify on SSL changes
CREATE OR REPLACE FUNCTION notify_web_monitor_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target_user_id uuid;
BEGIN
  -- Only notify on SSL changes, ignore status/speed changes
  IF NEW.change_type <> 'ssl' THEN
    RETURN NEW;
  END IF;

  SELECT id INTO v_target_user_id
  FROM usuarios
  WHERE email_laboral = 'ccjimenez@jiro.com.mx'
  AND deleted_at IS NULL
  LIMIT 1;

  IF v_target_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM enviar_notificacion_transaccional(
    'web_monitor_status_change',
    v_target_user_id,
    jsonb_build_object(
      'url', NEW.url,
      'change_type', NEW.change_type,
      'old_status', COALESCE(NEW.old_value, 'N/A'),
      'new_status', COALESCE(NEW.new_value, 'N/A')
    )
  );

  RETURN NEW;
END;
$$;

-- 2. Create 12-hour cron job for site scanning
-- First enable pg_cron if not already
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Remove existing cron job if any
SELECT cron.unschedule('web-monitor-scan-12h')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'web-monitor-scan-12h'
);

-- Schedule every 12 hours (6:00 and 18:00 UTC)
SELECT cron.schedule(
  'web-monitor-scan-12h',
  '0 6,18 * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url', true) || '/functions/v1/monitor-sites',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
