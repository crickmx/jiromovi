-- Varias cuentas de correo por usuario en el gestor.
--
-- Hasta hoy: UNA cuenta por usuario. `email_configuraciones` tenía
-- UNIQUE(usuario_id) y la credencial cifrada vivía en `email_credenciales`
-- con la clave de esa misma columna, así que no había forma de que una misma
-- persona tuviera su buzón de JIRO y, por ejemplo, su Gmail.
--
-- A partir de aquí: N cuentas por usuario, cada una con su servidor, y UNA
-- marcada como principal. La principal es la que siguen usando las pantallas
-- que no son el gestor (envío desde trámites, avisos, Roundcube SSO, firmas):
-- esas no cambian y siguen preguntando por la principal.
--
-- Comprobado antes de escribirla, contra la base viva:
--   · 9 cuentas, 9 credenciales, 0 credenciales sin cuenta.
--   · Las 9 ya traen imap.ionos.mx:993 / smtp.ionos.mx:587 y use_tls = true.
--   · Ningún usuario tiene todavía más de una cuenta.
--
-- OJO con el orden de las llaves y el servidor: `imap.ionos.mx:993` es lo que
-- hoy está hardcodeado 14 veces dentro de `ionos-webmail`. Estas columnas
-- existen desde el principio y ya tienen el valor correcto; la función todavía
-- no las lee.

-- ─── 1. Varias cuentas por usuario ──────────────────────────────────

alter table public.email_configuraciones
  drop constraint if exists email_configuraciones_usuario_id_key;

alter table public.email_configuraciones
  add column if not exists proveedor text,
  add column if not exists es_principal boolean not null default false;

-- Una sola principal por usuario. Es un índice PARCIAL a propósito: permite
-- muchas filas con es_principal = false y exactamente una con true.
create unique index if not exists email_configuraciones_una_principal
  on public.email_configuraciones (usuario_id)
  where es_principal;

-- El gestor ordena las cuentas por este índice; sin él, cada apertura del
-- selector recorre toda la tabla.
create index if not exists email_configuraciones_por_usuario_idx
  on public.email_configuraciones (usuario_id, es_principal desc);

-- ─── 2. Backfill: lo que ya existe es de MOVI y es la principal ─────
-- Una por usuario, la más vieja. (Hoy cada usuario tiene exactamente una, así
-- que el DISTINCT ON no elige nada; está para que la migración sea correcta
-- también si alguien la corre tarde, cuando ya haya varias.)

update public.email_configuraciones set proveedor = 'movi' where proveedor is null;

update public.email_configuraciones
   set imap_host = coalesce(imap_host, 'imap.ionos.mx'),
       imap_port = coalesce(imap_port, 993),
       smtp_host = coalesce(smtp_host, 'smtp.ionos.mx'),
       smtp_port = coalesce(smtp_port, 587),
       use_tls   = coalesce(use_tls, true)
 where imap_host is null or smtp_host is null;

with primera as (
  select distinct on (usuario_id) id
    from public.email_configuraciones e
   where not exists (
           select 1 from public.email_configuraciones p
            where p.usuario_id = e.usuario_id and p.es_principal)
   order by usuario_id, created_at nulls last, id
)
update public.email_configuraciones c
   set es_principal = true
  from primera
 where c.id = primera.id;

do $$
begin
  if exists (select 1 from public.email_configuraciones where proveedor is null) then
    raise exception 'Quedaron cuentas sin proveedor; revisar antes de seguir.';
  end if;
  if exists (
    select 1 from public.email_configuraciones e
     where not exists (select 1 from public.email_configuraciones p
                        where p.usuario_id = e.usuario_id and p.es_principal)) then
    raise exception 'Hay usuarios con cuentas y sin cuenta principal.';
  end if;
end $$;

alter table public.email_configuraciones alter column proveedor set not null;

comment on column public.email_configuraciones.es_principal is
  'La cuenta que usan las pantallas que no son el gestor (envío de trámites, avisos, Roundcube SSO, firmas). Una sola por usuario.';
comment on column public.email_configuraciones.proveedor is
  'Clave de email_proveedores_preset: movi, gmail, outlook, generico…';

-- ─── 3. La credencial cifrada pasa a ser POR CUENTA ─────────────────
-- Se conserva `usuario_id` como columna normal (no como llave): así las
-- funciones viejas que preguntan por usuario siguen encontrando algo mientras
-- se despliega el gestor nuevo.

alter table public.email_credenciales
  add column if not exists configuracion_id uuid
    references public.email_configuraciones(id) on delete cascade;

update public.email_credenciales c
   set configuracion_id = (
         select e.id
           from public.email_configuraciones e
          where e.usuario_id = c.usuario_id
          order by e.es_principal desc, e.created_at nulls last, e.id
          limit 1)
 where c.configuracion_id is null;

do $$
declare sobrantes integer;
begin
  select count(*) into sobrantes from public.email_credenciales where configuracion_id is null;
  if sobrantes > 0 then
    -- No se borra nada: una credencial huérfana es de alguien y hay que verla.
    raise exception
      'Hay % credenciales sin cuenta de correo asociada. Revísalas antes de correr esta migración.', sobrantes;
  end if;
end $$;

alter table public.email_credenciales drop constraint if exists email_credenciales_pkey;
alter table public.email_credenciales alter column configuracion_id set not null;
alter table public.email_credenciales
  add constraint email_credenciales_pkey primary key (configuracion_id);

create index if not exists email_credenciales_usuario_idx
  on public.email_credenciales (usuario_id);

comment on table public.email_credenciales is
  'Contraseña IMAP/SMTP cifrada, una por cuenta de correo. Nunca en texto plano.';

-- ─── 4. Los RPC de credenciales ─────────────────────────────────────
-- Los dos viejos se CONSERVAN con la misma firma (mismo tipo de retorno y
-- mismos argumentos: `create or replace` no crea sobrecarga) para que la
-- versión de `ionos-webmail` que está desplegada hoy siga funcionando. Ahora
-- resuelven la cuenta PRINCIPAL. Los nuevos son los que usa el gestor para
-- hablar de una cuenta concreta.

create or replace function public.email_cred_get(p_usuario_id uuid, p_key text)
returns text
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_result text;
begin
  select extensions.pgp_sym_decrypt(c.password_cifrada, p_key) into v_result
    from public.email_credenciales c
    join public.email_configuraciones e on e.id = c.configuracion_id
   where e.usuario_id = p_usuario_id
   order by e.es_principal desc, e.created_at nulls last, e.id
   limit 1;
  return v_result;
exception when others then
  return null;
end;
$function$;

create or replace function public.email_cred_set(p_usuario_id uuid, p_password text, p_key text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_config uuid;
begin
  select e.id into v_config
    from public.email_configuraciones e
   where e.usuario_id = p_usuario_id
   order by e.es_principal desc, e.created_at nulls last, e.id
   limit 1;

  -- Sin cuenta no hay dónde guardarla: antes esto era un INSERT suelto. Se
  -- calla a propósito, igual que antes, para no romper el guardado del cliente.
  if v_config is null then
    return;
  end if;

  insert into public.email_credenciales (configuracion_id, usuario_id, password_cifrada, updated_at)
  values (v_config, p_usuario_id, extensions.pgp_sym_encrypt(p_password, p_key), now())
  on conflict (configuracion_id) do update
    set usuario_id = excluded.usuario_id,
        password_cifrada = excluded.password_cifrada,
        updated_at = now();
end;
$function$;

create or replace function public.email_cred_get_cuenta(p_configuracion_id uuid, p_key text)
returns text
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_result text;
begin
  select extensions.pgp_sym_decrypt(password_cifrada, p_key) into v_result
    from public.email_credenciales
   where configuracion_id = p_configuracion_id;
  return v_result;
exception when others then
  return null;
end;
$function$;

create or replace function public.email_cred_set_cuenta(p_configuracion_id uuid, p_password text, p_key text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_usuario uuid;
begin
  select usuario_id into v_usuario
    from public.email_configuraciones where id = p_configuracion_id;
  if v_usuario is null then
    raise exception 'La cuenta % no existe.', p_configuracion_id;
  end if;

  insert into public.email_credenciales (configuracion_id, usuario_id, password_cifrada, updated_at)
  values (p_configuracion_id, v_usuario, extensions.pgp_sym_encrypt(p_password, p_key), now())
  on conflict (configuracion_id) do update
    set usuario_id = excluded.usuario_id,
        password_cifrada = excluded.password_cifrada,
        updated_at = now();
end;
$function$;

-- Solo la llave de servicio (igual que los viejos: la migración
-- `20260719034620_restringir_funciones_credenciales_service_role` ya dejó así
-- a los otros; se repite por si el `create or replace` de arriba los reabrió).
revoke all on function public.email_cred_get(uuid, text) from public, anon, authenticated;
revoke all on function public.email_cred_set(uuid, text, text) from public, anon, authenticated;
revoke all on function public.email_cred_get_cuenta(uuid, text) from public, anon, authenticated;
revoke all on function public.email_cred_set_cuenta(uuid, text, text) from public, anon, authenticated;
grant execute on function public.email_cred_get(uuid, text) to service_role;
grant execute on function public.email_cred_set(uuid, text, text) to service_role;
grant execute on function public.email_cred_get_cuenta(uuid, text) to service_role;
grant execute on function public.email_cred_set_cuenta(uuid, text, text) to service_role;

-- ─── 5. Catálogo de proveedores ─────────────────────────────────────
-- "Gmail y Outlook preconfigurados" es host + puerto + CÓMO SE AUTENTICA.
-- Y la forma de autenticarse no es la misma, ni la decide la pantalla:
--
--   · movi (IONOS)  → usuario y contraseña del buzón.
--   · gmail         → contraseña de aplicación de 16 caracteres, y Google
--                     solo la ofrece con verificación en 2 pasos activada.
--                     La contraseña normal de Google NO funciona por IMAP.
--   · outlook       → OAuth2. Microsoft deshabilitó la autenticación básica
--                     para las cuentas personales el 16/09/2024 y las
--                     contraseñas de aplicación tampoco sirven para correo.
--                     Por eso queda `auth_tipo = 'oauth'` y la pantalla NO
--                     puede pedir contraseña: dirá que falta conectar con
--                     Microsoft. (Ver la conversación del 19/11.)
--   · generico      → cualquier IMAP/SMTP que el usuario se sepa.
--
-- Con `auth_tipo` en la base, la pantalla no miente por su cuenta: pide lo
-- que el proveedor acepta, y el día que se haga OAuth solo cambia esta fila.

create table if not exists public.email_proveedores_preset (
  proveedor  text primary key,
  etiqueta   text not null,
  imap_host  text,
  imap_port  integer,
  smtp_host  text,
  smtp_port  integer,
  auth_tipo  text not null check (auth_tipo in ('password', 'app_password', 'oauth')),
  ayuda      text,
  orden      integer not null default 100,
  activo     boolean not null default true
);

insert into public.email_proveedores_preset
  (proveedor, etiqueta, imap_host, imap_port, smtp_host, smtp_port, auth_tipo, ayuda, orden)
values
  ('movi', 'Correo MOVI (JIRO)', 'imap.ionos.mx', 993, 'smtp.ionos.mx', 587, 'password',
   'Tu correo de JIRO. Solo el correo y tu contraseña.', 10),
  ('gmail', 'Gmail', 'imap.gmail.com', 993, 'smtp.gmail.com', 587, 'app_password',
   'Google ya no acepta tu contraseña normal. Necesitas activar la verificación en 2 pasos y generar una "contraseña de aplicación" de 16 caracteres en myaccount.google.com → Seguridad. Si es una cuenta de empresa (Google Workspace), la contraseña de aplicación tampoco funciona: hay que esperar a la conexión con Google.', 20),
  ('outlook', 'Outlook / Hotmail', 'outlook.office365.com', 993, 'smtp-mail.outlook.com', 587, 'oauth',
   'Microsoft deshabilitó la contraseña para el correo: Outlook exige conectar con tu cuenta de Microsoft. Todavía no está disponible aquí.', 30),
  ('icloud', 'iCloud', 'imap.mail.me.com', 993, 'smtp.mail.me.com', 587, 'app_password',
   'Apple pide una contraseña específica de aplicación, generada en appleid.apple.com.', 40),
  ('generico', 'Otro correo (IMAP/SMTP)', null, null, null, 587, 'password',
   'Si sabes los datos de tu servidor, captúralos aquí.', 90)
on conflict (proveedor) do update
  set etiqueta = excluded.etiqueta,
      imap_host = excluded.imap_host,
      imap_port = excluded.imap_port,
      smtp_host = excluded.smtp_host,
      smtp_port = excluded.smtp_port,
      auth_tipo = excluded.auth_tipo,
      ayuda = excluded.ayuda,
      orden = excluded.orden,
      activo = true;

alter table public.email_proveedores_preset enable row level security;

drop policy if exists email_proveedores_preset_lectura on public.email_proveedores_preset;
create policy email_proveedores_preset_lectura on public.email_proveedores_preset
  for select to authenticated using (true);

grant select on table public.email_proveedores_preset to authenticated;
revoke insert, update, delete on table public.email_proveedores_preset from anon, authenticated;

comment on column public.email_proveedores_preset.auth_tipo is
  'Qué credencial acepta el proveedor: password | app_password | oauth. La pantalla pide eso y no otra cosa.';

-- ─── 6. El tope de uso pasa a ser POR CUENTA ────────────────────────
-- El límite que importa no es el de la persona sino el del BUZÓN: IONOS (y
-- los demás) cortan por conexiones simultáneas de una misma cuenta. Con
-- varias cuentas por usuario, contar por usuario castigaría a quien tiene más.

alter table public.email_webmail_eventos
  add column if not exists configuracion_id uuid
    references public.email_configuraciones(id) on delete cascade;

create index if not exists email_webmail_eventos_cuenta_idx
  on public.email_webmail_eventos (configuracion_id, creado_en desc);

comment on column public.email_webmail_eventos.configuracion_id is
  'Cuenta contra la que se abrió la conexión. El tope se cuenta por buzón, no por persona.';
