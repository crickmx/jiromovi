-- Cron diario que llama a la edge function generar-instancias-tareas
-- Se ejecuta todos los días a las 07:00 UTC (02:00 CDT / 01:00 CST México).
--
-- IMPORTANTE: el JWT service_role no se versiona (secret-scan).
-- Defínelo como GUC antes de correr esta migración:
--
--   set local app.tareas_cron_service_key = '<JWT_service_role>';
--   -- luego corre esta migración
--
-- Si la GUC no está definida el cron NO se programa (no-op con NOTICE).

DO $$
DECLARE
  v_key text := current_setting('app.tareas_cron_service_key', true);
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'generar-instancias-tareas') THEN
    PERFORM cron.unschedule('generar-instancias-tareas');
  END IF;

  IF v_key IS NULL OR v_key = '' THEN
    RAISE NOTICE 'app.tareas_cron_service_key no definida; el cron generar-instancias-tareas NO se programó. Para (re)programarlo: set local app.tareas_cron_service_key = ''<JWT_service_role>''; y re-corre este archivo.';
    RETURN;
  END IF;

  PERFORM cron.schedule(
    'generar-instancias-tareas',
    '0 7 * * *',
    format(
      $q$SELECT net.http_post(
        url := 'https://qhwvuuyjhcennqccgvse.supabase.co/functions/v1/generar-instancias-tareas',
        headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || %L),
        body := '{"source": "cron"}'::jsonb
      ) as request_id;$q$,
      v_key
    )
  );
END;
$$;
