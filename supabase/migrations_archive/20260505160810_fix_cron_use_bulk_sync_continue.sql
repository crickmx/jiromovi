/*
  # Fix SICAS sync to auto-continue via cron job

  1. Changes
    - Creates/updates a cron job that calls the sicas-bulk-sync edge function with action=continue every 60 seconds
    - This ensures sync progresses even when the user closes the browser
    - The cron only triggers if there's an active running job

  2. Notes
    - Uses pg_cron + pg_net (net.http_post) to call the edge function
    - The edge function itself checks if there's an active job before doing any work
*/

-- Remove any old cron jobs for this
SELECT cron.unschedule('sicas-bulk-sync-continue')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sicas-bulk-sync-continue');

-- Create a function that calls the edge function if there's a running job
CREATE OR REPLACE FUNCTION public.trigger_sicas_bulk_sync_continue()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  running_job_id uuid;
  project_url text := current_setting('app.settings.supabase_url', true);
  service_key text := current_setting('app.settings.service_role_key', true);
BEGIN
  -- Check if there's an active job
  SELECT id INTO running_job_id
  FROM sicas_sync_jobs
  WHERE status = 'running'
  ORDER BY created_at DESC
  LIMIT 1;

  IF running_job_id IS NULL THEN
    RETURN;
  END IF;

  -- Use vault secrets or env vars for the URL
  IF project_url IS NULL OR project_url = '' THEN
    project_url := 'https://qhwvuuyjhcennqccgvse.supabase.co';
  END IF;

  IF service_key IS NULL OR service_key = '' THEN
    -- Fallback: read from vault if available
    SELECT decrypted_secret INTO service_key
    FROM vault.decrypted_secrets
    WHERE name = 'service_role_key'
    LIMIT 1;
  END IF;

  -- Call the edge function
  PERFORM net.http_post(
    url := project_url || '/functions/v1/sicas-bulk-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || COALESCE(service_key, '')
    ),
    body := jsonb_build_object(
      'action', 'continue',
      'jobId', running_job_id::text
    )
  );
END;
$$;

-- Schedule cron job to run every minute
SELECT cron.schedule(
  'sicas-bulk-sync-continue',
  '* * * * *',
  $$SELECT public.trigger_sicas_bulk_sync_continue()$$
);
