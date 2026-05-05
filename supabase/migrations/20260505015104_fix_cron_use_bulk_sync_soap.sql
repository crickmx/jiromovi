/*
  # Fix Cron Job to Use SOAP Bulk Sync

  1. Changes
    - Update the cron job to call `sicas-bulk-sync` instead of `sicas-sync-orchestrator`
    - The SOAP endpoint with H03400 keycode is the one that has all 251K records
    - The REST endpoint (HWS_DOCTOS) only returns ~200 records

  2. Notes
    - Runs every 30 minutes in incremental mode (only new/modified records)
    - Falls back to full mode if no previous successful sync exists
*/

-- Remove the old cron job
DO $$
BEGIN
  PERFORM cron.unschedule('sicas-incremental-sync-30min');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- Schedule bulk-sync in incremental mode every 30 minutes
SELECT cron.schedule(
  'sicas-incremental-sync-30min',
  '*/30 * * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/sicas-bulk-sync',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
      'Content-Type', 'application/json',
      'Apikey', current_setting('app.settings.service_role_key')
    ),
    body := '{"action":"start","mode":"incremental","triggeredBy":"cron-30min"}'::jsonb
  );
  $$
);
