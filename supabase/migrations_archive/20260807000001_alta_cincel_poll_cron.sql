/*
  # Cron de reconciliación para alta de agentes

  Programa `alta-cincel-poll` cada 3 minutos usando pg_cron + pg_net.
  La edge function requiere un Authorization con el JWT de service_role o con
  `ALTA_INTERNAL_SECRET`. Para no versionar secretos, la migración toma el JWT
  desde la GUC de sesión `app.alta_cron_service_key`.

  Para recrearlo en un ambiente nuevo:

      set local app.alta_cron_service_key = '<JWT_service_role>';
      -- luego ejecutar esta migración

  Si la GUC no está definida, la migración no programa el cron y deja un NOTICE.
*/

DO $$
DECLARE
  v_key text := current_setting('app.alta_cron_service_key', true);
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'alta-cincel-poll-cada-3min') THEN
    PERFORM cron.unschedule('alta-cincel-poll-cada-3min');
  END IF;

  IF v_key IS NULL OR v_key = '' THEN
    RAISE NOTICE 'app.alta_cron_service_key no definida; el cron alta-cincel-poll-cada-3min NO se programó desde esta migración. Para (re)programarlo: set local app.alta_cron_service_key = ''<JWT_service_role>''; y re-corre este archivo.';
    RETURN;
  END IF;

  PERFORM cron.schedule(
    'alta-cincel-poll-cada-3min',
    '*/3 * * * *',
    format(
      $q$SELECT net.http_post(
        url := 'https://qhwvuuyjhcennqccgvse.supabase.co/functions/v1/alta-cincel-poll',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || %L
        ),
        body := '{}'::jsonb
      ) as request_id;$q$,
      v_key
    )
  );
END;
$$;
