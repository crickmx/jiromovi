/*
  # seguros.express — Cron de escalamiento (Parte D.2)

  Programa la edge function `escalar-express-leads` cada 1 minuto (pg_cron +
  pg_net). La edge function lee express_leads_config y sólo expande el anillo de
  los leads cuyo intervalo ya venció, re-notifica a los agentes nuevos que entran
  al anillo ampliado, avisa a Admin al llegar al tope sin match, y expira los que
  agotan el tiempo extra.

  IMPORTANTE — el JWT service_role NO se versiona (lo detecta gitleaks/secret-scan).
  Esta migración lo toma de una GUC de sesión que debes definir ANTES de correrla:

      set local app.express_cron_service_key = '<JWT_service_role>';
      -- luego corre esta migración

  Si la GUC no está definida, la migración NO programa el cron (no-op con NOTICE)
  para no dejar un cron con token inválido. El cron ya quedó programado en
  producción el 2026-07-21 (vía MCP), así que este archivo sólo es necesario para
  recrearlo en un ambiente nuevo.
*/

DO $$
DECLARE
  v_key text := current_setting('app.express_cron_service_key', true);
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'escalar-express-leads') THEN
    PERFORM cron.unschedule('escalar-express-leads');
  END IF;

  IF v_key IS NULL OR v_key = '' THEN
    RAISE NOTICE 'app.express_cron_service_key no definida; el cron escalar-express-leads NO se programó desde esta migración. Para (re)programarlo: set local app.express_cron_service_key = ''<JWT_service_role>''; y re-corre este archivo.';
    RETURN;
  END IF;

  PERFORM cron.schedule(
    'escalar-express-leads',
    '* * * * *',
    format(
      $q$SELECT net.http_post(
        url := 'https://qhwvuuyjhcennqccgvse.supabase.co/functions/v1/escalar-express-leads',
        headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || %L),
        body := '{"source": "cron"}'::jsonb
      ) as request_id;$q$,
      v_key
    )
  );
END;
$$;
