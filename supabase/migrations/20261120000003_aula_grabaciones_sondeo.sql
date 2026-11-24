-- ============================================================================
-- Aula Virtual: rescate de grabaciones en la nube por sondeo
--
-- Los webhooks de Daily son de plan de pago. Este job cada 5 minutos pregunta
-- por las salas que ya grabaron y, si Daily tiene una grabación terminada,
-- dispara el mismo camino que usaría el webhook: descarga, copia a Supabase,
-- publica en On Demand y borra la copia en Daily.
--
-- Así el respaldo no depende ni de la PC del anfitrión ni del plan de Daily.
-- ============================================================================

do $do$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if not exists (select 1 from cron.job where jobname = 'aula-grabaciones-pendientes') then
      perform cron.schedule(
        'aula-grabaciones-pendientes',
        '*/5 * * * *',
        $job$
        SELECT net.http_post(
          url := 'https://qhwvuuyjhcennqccgvse.supabase.co/functions/v1/aula-daily',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1)
          ),
          body := '{"action": "recoger-grabaciones"}'::jsonb,
          timeout_milliseconds := 55000
        );
        $job$
      );
    end if;
  end if;
end $do$;