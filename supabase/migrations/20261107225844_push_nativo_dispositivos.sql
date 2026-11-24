-- ============================================================================
-- Push nativo (apps de iOS y Android de MOVI y Seguwallet)
-- ============================================================================
-- Dentro de la app no funciona el Web Push (VAPID) que usa el navegador. Aquí se
-- guardan los tokens de cada teléfono, y cada aviso que entra a la campanita
-- (notificaciones de MOVI y notifications del motor transaccional) se manda
-- también como push al teléfono, por la edge function `enviar-push-nativo`.
--
-- - Android: Firebase Cloud Messaging (token FCM).
-- - iPhone: APNs directo (token del dispositivo), sin SDK de Firebase.
--
-- El trigger SOLO llama a la función si ese usuario tiene al menos un teléfono
-- registrado, así que para quien no instaló la app no cambia nada. Un fallo
-- del push nunca impide que se guarde la notificación.
-- ============================================================================

create table if not exists public.push_dispositivos (
  id            uuid primary key default gen_random_uuid(),
  auth_user_id  uuid not null,
  token         text not null unique,      -- un teléfono, un dueño a la vez
  plataforma    text not null check (plataforma in ('ios', 'android')),
  app           text not null check (app in ('movi', 'seguwallet')),
  app_id        text,                       -- bundle / package, para APNs (topic)
  creado_en     timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
create index if not exists push_dispositivos_usuario_idx on public.push_dispositivos (auth_user_id);

alter table public.push_dispositivos enable row level security;

-- Cada quien administra solo sus teléfonos. El upsert por `token` reasigna el
-- teléfono al usuario que inicia sesión en él (la política de UPDATE lo permite
-- porque el nuevo dueño queda como auth.uid()).
drop policy if exists push_dispositivos_propios_select on public.push_dispositivos;
create policy push_dispositivos_propios_select on public.push_dispositivos
  for select to authenticated using (auth_user_id = auth.uid());
drop policy if exists push_dispositivos_propios_insert on public.push_dispositivos;
create policy push_dispositivos_propios_insert on public.push_dispositivos
  for insert to authenticated with check (auth_user_id = auth.uid());
drop policy if exists push_dispositivos_propios_delete on public.push_dispositivos;
create policy push_dispositivos_propios_delete on public.push_dispositivos
  for delete to authenticated using (auth_user_id = auth.uid());

-- Reasignar un teléfono que antes era de otra cuenta: no se puede con RLS
-- (no ves la fila ajena), así que va por una función acotada a TU token.
create or replace function public.registrar_push_dispositivo(
  p_token text, p_plataforma text, p_app text, p_app_id text
) returns void
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'sin sesión'; end if;
  if p_token is null or length(p_token) < 20 then raise exception 'token inválido'; end if;
  insert into public.push_dispositivos (auth_user_id, token, plataforma, app, app_id)
  values (auth.uid(), p_token, p_plataforma, p_app, p_app_id)
  on conflict (token) do update
    set auth_user_id = excluded.auth_user_id, plataforma = excluded.plataforma,
        app = excluded.app, app_id = excluded.app_id, actualizado_en = now();
end;
$$;
revoke all on function public.registrar_push_dispositivo(text, text, text, text) from public, anon;
grant execute on function public.registrar_push_dispositivo(text, text, text, text) to authenticated;

-- Dispara el push. Pasa solo la tabla y el id: la función lee la fila con
-- service_role y solo manda si se creó hace menos de 2 minutos, así que la URL
-- no sirve para mandar avisos arbitrarios ni para repetir viejos.
create or replace function public.push_nativo_por_notificacion()
returns trigger
language plpgsql security definer set search_path = public, extensions
as $$
declare
  v_usuario uuid := case when tg_table_name = 'notificaciones' then new.usuario_id else new.user_id end;
begin
  if not exists (select 1 from public.push_dispositivos d where d.auth_user_id = v_usuario) then
    return new;
  end if;
  begin
    perform net.http_post(
      url := 'https://qhwvuuyjhcennqccgvse.supabase.co/functions/v1/enviar-push-nativo',
      headers := jsonb_build_object('Content-Type', 'application/json'),
      body := jsonb_build_object('tabla', tg_table_name, 'id', new.id)
    );
  exception when others then
    raise warning 'push nativo no enviado: %', sqlerrm;
  end;
  return new;
end;
$$;

drop trigger if exists trg_push_nativo_notificaciones on public.notificaciones;
create trigger trg_push_nativo_notificaciones
  after insert on public.notificaciones
  for each row execute function public.push_nativo_por_notificacion();

drop trigger if exists trg_push_nativo_notifications on public.notifications;
create trigger trg_push_nativo_notifications
  after insert on public.notifications
  for each row execute function public.push_nativo_por_notificacion();

comment on table public.push_dispositivos is
  'Tokens de push de las apps nativas (FCM en Android, APNs en iOS). Los escribe la app; los lee enviar-push-nativo.';
