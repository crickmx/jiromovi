/*
  # Fix sicas-incremental-sync-30min cron

  ## Problem
  The cron job fails every 30 minutes with:
    ERROR: unrecognized configuration parameter "app.settings.supabase_url"

  The cron body uses current_setting('app.settings.supabase_url') which is not
  configured in this environment. The trigger_sicas_bulk_sync_continue function
  already has the correct pattern: hardcoded fallback URL + vault key lookup.

  ## Fix
  Replace the cron with a DB function call (same pattern as bulk-sync-continue)
  that handles the missing setting gracefully via a SECURITY DEFINER function.
*/

-- Create or replace a helper function for the incremental sync trigger
CREATE OR REPLACE FUNCTION public.trigger_sicas_incremental_sync()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  supabase_url text;
  service_key  text;
BEGIN
  supabase_url := current_setting('app.settings.supabase_url', true);
  service_key  := current_setting('app.settings.service_role_key', true);

  IF supabase_url IS NULL OR service_key IS NULL THEN
    supabase_url := 'https://qhwvuuyjhcennqccgvse.supabase.co';
    service_key  := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1);
    IF service_key IS NULL THEN
      service_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFod3Z1dXlqaGNlbm5xY2NndnNlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTcyMDk5MCwiZXhwIjoyMDc3Mjk2OTkwfQ.lmkRTcDPdTCpw4EAaljO-BFwfOA2_CO1ztFG_RWV0NE';
    END IF;
  END IF;

  PERFORM net.http_post(
    url     := supabase_url || '/functions/v1/sicas-bulk-sync',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || service_key
    ),
    body    := '{"action":"start","mode":"incremental","triggeredBy":"cron-30min"}'::jsonb
  );
END;
$$;

-- Reschedule the cron to use the new safe function
SELECT cron.unschedule('sicas-incremental-sync-30min');

SELECT cron.schedule(
  'sicas-incremental-sync-30min',
  '*/30 * * * *',
  'SELECT public.trigger_sicas_incremental_sync()'
);
