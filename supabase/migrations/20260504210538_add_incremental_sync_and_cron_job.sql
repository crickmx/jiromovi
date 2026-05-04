/*
  # Add Incremental Sync Support and Cron Job

  1. Schema Changes
    - Add `incremental_since` column to `sicas_sync_cursors` for tracking incremental date filter

  2. Cron Job
    - Create a pg_cron job that triggers SICAS sync every 30 minutes automatically
    - Uses pg_net to call the sicas-sync-orchestrator edge function in incremental mode

  3. Notes
    - Incremental sync only fetches documents modified since last successful sync (with 3-day buffer)
    - Falls back to full sync if no previous successful sync exists
    - Cron job runs as service_role so no auth issues
*/

-- Add incremental_since column to track date filter for incremental syncs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sicas_sync_cursors' AND column_name = 'incremental_since'
  ) THEN
    ALTER TABLE sicas_sync_cursors ADD COLUMN incremental_since text DEFAULT NULL;
  END IF;
END $$;

-- Create the cron job for automatic sync every 30 minutes
-- Uses pg_net to call the edge function directly
DO $$
BEGIN
  -- Remove existing job if any
  PERFORM cron.unschedule('sicas-incremental-sync-30min')
  WHERE EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'sicas-incremental-sync-30min'
  );
EXCEPTION WHEN OTHERS THEN
  -- cron extension might not have the job yet, ignore
  NULL;
END $$;

-- Schedule the incremental sync every 30 minutes
SELECT cron.schedule(
  'sicas-incremental-sync-30min',
  '*/30 * * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/sicas-sync-orchestrator',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
      'Content-Type', 'application/json',
      'Apikey', current_setting('app.settings.service_role_key')
    ),
    body := '{"action":"start","mode":"incremental","triggeredBy":"cron-30min"}'::jsonb
  );
  $$
);
