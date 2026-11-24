/*
  # Fix SICAS cron commands to use current_setting pattern

  The previous migration used app_settings table which doesn't exist.
  The correct pattern (used by all other crons) is current_setting().
  This migration replaces both new cron jobs with the correct command format.
*/

SELECT cron.unschedule('sicas-bulk-sync-continue');
SELECT cron.unschedule('sicas-incremental-sync-2h');

SELECT cron.schedule(
  'sicas-bulk-sync-continue',
  '*/10 * * * *',
  $$
    SELECT net.http_post(
      url := current_setting('app.settings.supabase_url', true) || '/functions/v1/sicas-bulk-sync',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
      ),
      body := '{"action":"start","triggeredBy":"cron-10min","mode":"incremental"}'::jsonb
    ) AS request_id;
  $$
);

SELECT cron.schedule(
  'sicas-incremental-sync-2h',
  '0 */2 * * *',
  $$
    SELECT net.http_post(
      url := current_setting('app.settings.supabase_url', true) || '/functions/v1/sicas-bulk-sync',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
      ),
      body := '{"action":"start","triggeredBy":"cron-2h","mode":"incremental"}'::jsonb
    ) AS request_id;
  $$
);
