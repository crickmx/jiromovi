-- 20261119000003_send_email_with_attachments_sin_app_settings.sql
--
-- Reemplaza la Opción A del PR #95 (`alter database postgres set "app.settings.*"`): esa vía está
-- bloqueada porque el rol que ejecuta SQL por la Management API es `postgres` SIN superusuario, y
-- PostgreSQL exige superusuario para fijar parámetros personalizados de base de datos
-- (falla con 42501 permission denied to set parameter).
--
-- Cambio mínimo y quirúrgico: en `public.send_email_with_attachments` las dos únicas lecturas
-- hechas SIN `missing_ok` pasan a leer con `missing_ok = true` y con respaldo literal.
-- Nada más del cuerpo se toca (misma firma, mismo SECURITY DEFINER, mismo `SET search_path`).
--
-- Antes:
--   current_setting('app.settings.supabase_url')        -- sin missing_ok → ERROR 42704
--   current_setting('app.settings.supabase_anon_key')   -- sin missing_ok → ERROR 42704
-- Después:
--   COALESCE(NULLIF(current_setting('app.settings.supabase_url', true), ''), '<url del proyecto>')
--   COALESCE(NULLIF(current_setting('app.settings.supabase_anon_key', true), ''), '<llave publishable>')
--
-- Verificación posterior (sin enviar correo, sin efectos):
--   select rg.prosrc ~ 'current_setting\(''app\.settings\.[a-z_]+''\)' as sigue_fallando
--   from pg_proc rg where rg.proname = 'send_email_with_attachments';   -- debe dar false
--   select coalesce(nullif(current_setting('app.settings.supabase_url', true), ''),
--                   'https://qhwvuuyjhcennqccgvse.supabase.co');       -- debe devolver la URL, sin error
--
-- Rollback: restaurar la definición anterior (queda en var/prs/def_send_email_with_attachments.txt).

CREATE OR REPLACE FUNCTION public.send_email_with_attachments(
    p_to_email text,
    p_subject text,
    p_html_body text,
    p_attachments jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
v_response jsonb;
v_request_payload jsonb;
v_supabase_url text;
v_anon_key text;
BEGIN
-- Configuración con missing_ok y respaldo literal (antes: current_setting sin missing_ok → 42704).
v_supabase_url := COALESCE(NULLIF(current_setting('app.settings.supabase_url', true), ''),
                           'https://qhwvuuyjhcennqccgvse.supabase.co');
v_anon_key := COALESCE(NULLIF(current_setting('app.settings.supabase_anon_key', true), ''),
                       'sb_publishable_5itESSEGFGUAODd_hizqDA_cmjONZKf');

-- Construir payload
v_request_payload := jsonb_build_object(
'to_email', p_to_email,
'subject', p_subject,
'html_body', p_html_body
);

-- Agregar adjuntos si existen
IF p_attachments IS NOT NULL AND jsonb_array_length(p_attachments) > 0 THEN
v_request_payload := v_request_payload || jsonb_build_object('attachments', p_attachments);
END IF;

-- Llamar a la edge function
SELECT content::jsonb INTO v_response
FROM http((
'POST',
v_supabase_url || '/functions/v1/enviar-correo-transaccional',
ARRAY[
http_header('Content-Type', 'application/json'),
http_header('Authorization', 'Bearer ' || v_anon_key)
],
'application/json',
v_request_payload::text
)::http_request);

RETURN v_response;
EXCEPTION
WHEN OTHERS THEN
RAISE WARNING 'Error enviando correo con adjuntos: %', SQLERRM;
RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$function$;
