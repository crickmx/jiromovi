/*
  # Fix notification dispatcher cron jobs

  1. Problem
    - Cron job `process-notification-jobs` sends empty body `{}` to notification-dispatcher edge function
    - The edge function requires `{"process_pending_jobs": true}` to process pending jobs
    - Without that flag, the function falls through to "direct dispatch" mode which requires event_code/user_id and returns 400
    - Additionally, the cron job used the anon key instead of the service role key
    - The `trigger_notification_dispatcher()` function also sends empty body

  2. Fix
    - Update cron job 1 to send `{"process_pending_jobs": true}` with the service role key
    - Update `trigger_notification_dispatcher()` function to send `{"process_pending_jobs": true}`
    - Use the service role key from the .env for the cron job Authorization header

  3. Impact
    - Pending email and whatsapp notification jobs will now be processed by the cron
    - Welcome messages and all other transactional notifications will be delivered
*/

-- Step 1: Unschedule the broken cron job
SELECT cron.unschedule('process-notification-jobs');

-- Step 2: Recreate with correct body and service role key
SELECT cron.schedule(
  'process-notification-jobs',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://qhwvuuyjhcennqccgvse.supabase.co/functions/v1/notification-dispatcher',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFod3Z1dXlqaGNlbm5xY2NndnNlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTcyMDk5MCwiZXhwIjoyMDc3Mjk2OTkwfQ.lmkRTcDPdTCpw4EAaljO-BFwfOA2_CO1ztFG_RWV0NE"}'::jsonb,
    body := '{"process_pending_jobs": true}'::jsonb
  ) as request_id;
  $$
);

-- Step 3: Update the trigger_notification_dispatcher function to also send correct body
CREATE OR REPLACE FUNCTION public.trigger_notification_dispatcher()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_pending_count integer;
  v_supabase_url text;
  v_service_role_key text;
BEGIN
  -- Count pending email/whatsapp jobs
  SELECT COUNT(*) INTO v_pending_count
  FROM notification_jobs
  WHERE status = 'pending'
  AND channel IN ('email', 'whatsapp');

  IF v_pending_count = 0 THEN
    RETURN;
  END IF;

  v_supabase_url := 'https://qhwvuuyjhcennqccgvse.supabase.co';
  v_service_role_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFod3Z1dXlqaGNlbm5xY2NndnNlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTcyMDk5MCwiZXhwIjoyMDc3Mjk2OTkwfQ.lmkRTcDPdTCpw4EAaljO-BFwfOA2_CO1ztFG_RWV0NE';

  -- Call the edge function with correct body
  PERFORM net.http_post(
    url := v_supabase_url || '/functions/v1/notification-dispatcher',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || v_service_role_key,
      'Content-Type', 'application/json'
    ),
    body := '{"process_pending_jobs": true}'::jsonb,
    timeout_milliseconds := 30000
  );

EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Error al invocar notification-dispatcher: %', SQLERRM;
END;
$function$;
