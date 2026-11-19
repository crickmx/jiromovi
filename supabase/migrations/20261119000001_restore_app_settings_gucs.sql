-- 20261119000001_restore_app_settings_gucs.sql
--
-- Problema: public.send_email_with_attachments lee
--   current_setting('app.settings.supabase_url')     -- SIN missing_ok
--   current_setting('app.settings.supabase_anon_key')-- SIN missing_ok
-- y esos parámetros ya no existen, así que CADA llamada falla con
--   42704: unrecognized configuration parameter "app.settings.supabase_url".
-- Consecuencia: todo envío de correo con adjuntos aborta.
--
-- Evidencia (18 nov 2026, 23:03 UTC, rol supabase_read_only_user):
--   select p.proname, (regexp_matches(p.prosrc, 'current_setting\(''app\.settings\.[a-z_]+''\)', 'g'))[1]
--   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--   where n.nspname = 'public' and p.prosrc ~ 'current_setting\(''app\.settings\.[a-z_]+''\)';
--   -> send_email_with_attachments | current_setting('app.settings.supabase_url')
--   -> send_email_with_attachments | current_setting('app.settings.supabase_anon_key')
--
-- Alcance: SOLO parámetros públicos (URL del proyecto, llave publishable y URL de storage).
-- service_role_key NO se toca: sigue únicamente en Vault y esos 6 call sites ya lo leen de ahí.
-- No se modifica ningún cuerpo de función, ni RLS, ni permisos, ni datos.

begin;

alter database postgres set "app.settings.supabase_url" =
  'https://qhwvuuyjhcennqccgvse.supabase.co';

alter database postgres set "app.settings.supabase_anon_key" =
  'sb_publishable_5itESSEGFGUAODd_hizqDA_cmjONZKf';

-- Complementa la lectura muerta de get_public_web_page (no cambia su comportamiento).
alter database postgres set "app.settings.storage_url" =
  'https://qhwvuuyjhcennqccgvse.supabase.co/storage/v1';

commit;

-- Verificación posterior (no ejecutar aquí; el agente lo comprueba después del despliegue):
--   1. web-monitor-scan-12h (06:00 y 18:00 UTC) -> dos corridas 'succeeded'.
--   2. bug-reports-daily-digest (06:00) y create-renewal-tasks-daily (07:00) -> 'succeeded'.
--   3. Prueba de send_email_with_attachments con un adjunto interno -> sin 42704.
--   4. select count(*) from cron.job_run_details
--      where status = 'failed' and start_time > now() - interval '24 hours'  -- 0 para esos tres.
--
-- Rollback:
--   alter database postgres reset "app.settings.supabase_url";
--   alter database postgres reset "app.settings.supabase_anon_key";
--   alter database postgres reset "app.settings.storage_url";
--
-- Nota de despliegue: alter database ... set aplica a las conexiones NUEVAS. Las conexiones ya
-- abiertas (pooler incluido) siguen sin ver el parámetro hasta reciclarse; para efecto inmediato
-- hace falta reiniciar el proyecto o esperar el reciclado del pool (~minutos).
