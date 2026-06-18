/*
  # Reduce SICAS cron frequency to avoid throttling

  ## Summary
  The SICAS bulk sync cron was running every minute, creating a constant
  stream of requests to the SICAS SOAP server. Combined with 45s timeouts
  this meant overlapping requests — likely the cause of persistent throttling.

  ## Changes
  1. `sicas-bulk-sync-continue`: every 1 min → every 10 min
  2. `sicas-incremental-sync-30min`: every 30 min → every 2 hours
  3. `sicas-stale-sync-alert` (if exists): keep as-is — it's read-only

  ## Notes
  - Uses `cron.alter_job` if available, else unschedule + reschedule pattern
  - Both crons reference the same edge function (sicas-bulk-sync)
  - The adaptive backoff in the edge function handles further spacing within each run
*/

-- Safely update bulk-sync-continue: 1 min → 10 min
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'sicas-bulk-sync-continue'
  ) THEN
    PERFORM cron.unschedule('sicas-bulk-sync-continue');
  END IF;
END $$;

-- Safely update incremental sync: 30 min → 2 hours
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'sicas-incremental-sync-30min'
  ) THEN
    PERFORM cron.unschedule('sicas-incremental-sync-30min');
  END IF;
END $$;

-- Reschedule bulk-sync-continue every 10 minutes
SELECT cron.schedule(
  'sicas-bulk-sync-continue',
  '*/10 * * * *',
  $$
    SELECT net.http_post(
      url := (SELECT value FROM app_settings WHERE key = 'supabase_url' LIMIT 1)
              || '/functions/v1/sicas-bulk-sync',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (SELECT value FROM app_settings WHERE key = 'service_role_key' LIMIT 1)
      ),
      body := '{"action":"start","triggeredBy":"cron-10min","mode":"incremental"}'::jsonb
    ) AS request_id;
  $$
);

-- Reschedule incremental sync every 2 hours
SELECT cron.schedule(
  'sicas-incremental-sync-2h',
  '0 */2 * * *',
  $$
    SELECT net.http_post(
      url := (SELECT value FROM app_settings WHERE key = 'supabase_url' LIMIT 1)
              || '/functions/v1/sicas-bulk-sync',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (SELECT value FROM app_settings WHERE key = 'service_role_key' LIMIT 1)
      ),
      body := '{"action":"start","triggeredBy":"cron-2h","mode":"incremental"}'::jsonb
    ) AS request_id;
  $$
);
