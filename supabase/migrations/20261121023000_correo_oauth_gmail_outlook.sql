-- OAuth2 para Gmail y Outlook.
--
-- Outlook no tiene otra puerta: Microsoft deshabilitó la autenticación básica
-- para las cuentas personales el 16/09/2024 y las contraseñas de aplicación
-- tampoco sirven para correo. Gmail sí acepta contraseña de aplicación (con
-- verificación en 2 pasos), pero las cuentas de Google Workspace ya no, así
-- que necesita OAuth igual.
--
-- De la migración anterior (`20261119160000`) ya están `proveedor`,
-- `es_principal` y `email_credenciales.configuracion_id`.

-- ─── 1. La credencial sabe lo que es ────────────────────────────────
-- Una contraseña y un refresh token de OAuth no se guardan igual ni se usan
-- igual. Con `tipo` explícito, la función sabe qué mandar al servidor sin
-- adivinar por la forma del texto.

alter table public.email_credenciales
  add column if not exists tipo text not null default 'password';

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.email_credenciales'::regclass
       and conname = 'email_credenciales_tipo_check') then
    alter table public.email_credenciales
      add constraint email_credenciales_tipo_check
      check (tipo in ('password', 'oauth'));
  end if;
end $$;

comment on column public.email_credenciales.tipo is
  'password = contraseña del buzón (o de aplicación). oauth = el blob cifrado es un JSON con refresh_token/access_token/expires_at.';

comment on column public.email_credenciales.password_cifrada is
  'Cifrado con pgp_sym_encrypt y la llave maestra del proyecto. Con tipo=oauth contiene el JSON de tokens, nunca la contraseña de la persona.';

-- ─── 2. El "state" del ida y vuelta con el proveedor ────────────────
-- Es lo que impide que alguien nos devuelva un código que no pedimos. Se
-- guarda el HASH, nunca el valor: si alguien lee la tabla no puede usarlo.

create table if not exists public.email_oauth_estados (
  estado_hash      text primary key,
  usuario_id       uuid not null references public.usuarios(id) on delete cascade,
  configuracion_id uuid references public.email_configuraciones(id) on delete cascade,
  proveedor        text not null,
  email_esperado   text not null,
  volver_a         text,
  expira_en        timestamptz not null,
  usado_en         timestamptz,
  creado_en        timestamptz not null default now()
);

create index if not exists email_oauth_estados_limpieza_idx
  on public.email_oauth_estados (expira_en);

-- Solo la toca la edge function, que entra con la llave de servicio y no pasa
-- por RLS. Encendida y sin políticas: nadie más la lee ni la escribe.
alter table public.email_oauth_estados enable row level security;
revoke all on table public.email_oauth_estados from anon, authenticated;

comment on table public.email_oauth_estados is
  'Un renglón por intento de conectar una cuenta por OAuth. Guarda el hash del state, no el state.';

-- ─── 3. Leer el tipo de credencial de una cuenta ────────────────────
-- El blob cifrado lo entrega `email_cred_get_cuenta`; esto dice cómo leerlo.

create or replace function public.email_cred_tipo_cuenta(p_configuracion_id uuid)
returns text
language sql
security definer
set search_path to 'public'
as $function$
  select coalesce(
    (select tipo from public.email_credenciales where configuracion_id = p_configuracion_id),
    'password');
$function$;

revoke all on function public.email_cred_tipo_cuenta(uuid) from public, anon, authenticated;
grant execute on function public.email_cred_tipo_cuenta(uuid) to service_role;

-- Marcar una credencial como OAuth (o devolverla a contraseña). Va aparte de
-- `email_cred_set_cuenta` a propósito: cambiar la firma de esa función —aunque
-- fuera para agregarle un parámetro con valor por omisión— dejaría dos
-- versiones vivas y Postgres elegiría la vieja según cómo se llame.
create or replace function public.email_cred_set_tipo_cuenta(p_configuracion_id uuid, p_tipo text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if p_tipo not in ('password', 'oauth') then
    raise exception 'Tipo de credencial desconocido: %', p_tipo;
  end if;
  update public.email_credenciales
     set tipo = p_tipo, updated_at = now()
   where configuracion_id = p_configuracion_id;
end;
$function$;

revoke all on function public.email_cred_set_tipo_cuenta(uuid, text) from public, anon, authenticated;
grant execute on function public.email_cred_set_tipo_cuenta(uuid, text) to service_role;

-- ─── 4. Qué proveedores entran por OAuth ────────────────────────────
-- El catálogo ya dice `auth_tipo`; esto agrega de dónde sacar el cliente
-- OAuth. No lleva las llaves: viven en los secretos de la edge function
-- (GOOGLE_OAUTH_CLIENT_ID / SECRET, MICROSOFT_OAUTH_CLIENT_ID / SECRET),
-- igual que la llave maestra de las credenciales.

alter table public.email_proveedores_preset
  add column if not exists oauth_variables text;

update public.email_proveedores_preset
   set oauth_variables = case proveedor
     when 'gmail'   then 'GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET'
     when 'outlook' then 'MICROSOFT_OAUTH_CLIENT_ID / MICROSOFT_OAUTH_CLIENT_SECRET'
   end
 where proveedor in ('gmail', 'outlook') and oauth_variables is null;

-- Gmail entra por los dos caminos: contraseña de aplicación (que es lo que
-- funciona hoy para una cuenta personal) o OAuth (lo único que funciona en
-- Google Workspace). La pantalla ofrece el que el usuario pueda usar.
update public.email_proveedores_preset
   set ayuda = 'Google ya no acepta tu contraseña normal. Dos caminos: (1) contraseña de aplicación de 16 caracteres, y para eso hay que activar antes la verificación en 2 pasos en myaccount.google.com → Seguridad; (2) conectar con Google, que es obligatorio si tu correo es de empresa (Google Workspace). Si el administrador de tu dominio bloqueó las contraseñas de aplicación, solo queda el segundo.'
 where proveedor = 'gmail';

comment on column public.email_proveedores_preset.oauth_variables is
  'Nombres de las variables de entorno (secretos de la edge function) que traen el cliente OAuth. Nunca los valores.';
