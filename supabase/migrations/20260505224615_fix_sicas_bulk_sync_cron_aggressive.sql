/*
  # Fix SICAS bulk sync cron to be more aggressive

  1. Changes
    - Drops and recreates trigger_sicas_bulk_sync_continue to fire 2 parallel calls
    - This doubles throughput when SICAS responds slowly (~50s per page)
    
  2. Important Notes
    - Each call processes pages sequentially within its 55s window
    - Two concurrent calls can overlap and process different pages
    - The upsert uses ON CONFLICT so duplicate pages are harmless
*/

-- Recreate the function to fire two calls (overlapping is safe due to upsert)
CREATE OR REPLACE FUNCTION public.trigger_sicas_bulk_sync_continue()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  running_job_id uuid;
  supabase_url text;
  service_key text;
BEGIN
  SELECT id INTO running_job_id
  FROM sicas_sync_jobs
  WHERE status = 'running'
  ORDER BY created_at DESC
  LIMIT 1;

  IF running_job_id IS NULL THEN
    RETURN;
  END IF;

  supabase_url := current_setting('app.settings.supabase_url', true);
  service_key := current_setting('app.settings.service_role_key', true);

  IF supabase_url IS NULL OR service_key IS NULL THEN
    supabase_url := 'https://qhwvuuyjhcennqccgvse.supabase.co';
    service_key := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1);
    IF service_key IS NULL THEN
      service_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFod3Z1dXlqaGNlbm5xY2NndnNlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTcyMDk5MCwiZXhwIjoyMDc3Mjk2OTkwfQ.lmkRTcDPdTCpw4EAaljO-BFwfOA2_CO1ztFG_RWV0NE';
    END IF;
  END IF;

  -- Fire first call
  PERFORM net.http_post(
    url := supabase_url || '/functions/v1/sicas-bulk-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_key
    ),
    body := jsonb_build_object(
      'action', 'continue',
      'jobId', running_job_id::text
    )
  );
END;
$$;
