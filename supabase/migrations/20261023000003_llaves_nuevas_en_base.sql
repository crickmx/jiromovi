-- QA 2026-10-22 · Rotación de llaves, paso 1: la base deja de usar las llaves JWT viejas
--
-- Para poder desactivar las llaves "legacy" (anon y service_role JWT, la service_role
-- estuvo expuesta en el repo público), primero nada debe depender de ellas.
--
-- En la base quedaban usando la anon JWT vieja:
--   · enviar_notificacion_global, enviar_notificacion_individual, send_transactional_notification
--     (la traen escrita dentro del código).
--   · vault: anon_key (cron qualitas-catalog-daily-sync) y sicas_ccj_anon_key (cron SICAS, pausado).
-- Se cambian por la llave publicable nueva, que es pública por diseño (igual que la anon)
-- y funciona en apikey y en Authorization contra REST, RPC, Auth y edge functions
-- (probado el 23/10 desde el navegador).
--
-- El service_role del vault ya es la llave nueva (sb_secret_…): no se toca.
-- Las funciones se modifican leyendo su definición viva (pg_get_functiondef) y cambiando
-- solo la llave, sin reescribirlas a mano.

begin;

set local lock_timeout = '5s';

do $$
declare
  f        record;
  v_def    text;
  v_nueva  text;
  v_key    constant text := 'sb_publishable_5itESSEGFGUAODd_hizqDA_cmjONZKf';
  v_jwt    constant text := 'eyJhbGciOi[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+';
  v_cambiadas int := 0;
begin
  for f in
    select p.oid, p.proname from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.proname in ('enviar_notificacion_global', 'enviar_notificacion_individual', 'send_transactional_notification')
  loop
    v_def := pg_get_functiondef(f.oid);
    -- Solo se reemplaza si TODAS las llaves JWT dentro son anon; si apareciera otra, se aborta.
    if exists (
      select 1 from regexp_matches(v_def, v_jwt, 'g') m(x)
      where coalesce(convert_from(decode(rpad(translate(split_part(m.x[1], '.', 2), '-_', '+/'),
              ((length(split_part(m.x[1], '.', 2)) + 3) / 4) * 4, '='), 'base64'), 'utf8')::json ->> 'role', '') <> 'anon'
    ) then
      raise exception 'La función % trae una llave JWT que no es anon; no se toca', f.proname;
    end if;
    v_nueva := regexp_replace(v_def, v_jwt, v_key, 'g');
    if v_nueva <> v_def then
      execute v_nueva;
      v_cambiadas := v_cambiadas + 1;
    end if;
  end loop;
  raise notice 'Funciones actualizadas: %', v_cambiadas;
end $$;

-- Secretos del vault que guardaban la anon JWT
select vault.update_secret(s.id, 'sb_publishable_5itESSEGFGUAODd_hizqDA_cmjONZKf')
from vault.secrets s
where s.name in ('anon_key', 'sicas_ccj_anon_key');

commit;

-- Reversa: volver a poner la anon JWT (está en Supabase → API Keys → Legacy) en las tres
-- funciones y en los dos secretos del vault. Solo funciona mientras las llaves legacy sigan activas.
