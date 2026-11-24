-- QA 2026-10-22 · Datos bancarios y contraseña de correo: paso 1 de 2 (solo agrega)
--
-- Hoy cualquier usuario con sesión puede leer de la tabla usuarios las columnas banco,
-- cuenta_banco, clabe, clabe_interbancaria, numero_tarjeta y email_password de todos.
--
-- Regla (Christofer, 23/10): el perfil completo de registro, con datos de transferencia,
-- lo ven la persona misma, el Administrador y el Gerente de su oficina. La contraseña del
-- correo no la ve nadie desde el navegador: solo se sabe si está configurada.
--
-- Este paso SOLO agrega la función por la que el front va a leer esos datos. No quita
-- nada todavía: el paso 2 (20261023000005) retira esas columnas de la lectura directa,
-- y se corre cuando beta y producción ya tengan el front que usa esta función.

begin;

set local lock_timeout = '5s';

create or replace function public.get_datos_privados_usuarios(p_ids uuid[])
returns table (
  id                   uuid,
  banco                text,
  cuenta_banco         text,
  clabe                text,
  clabe_interbancaria  text,
  numero_tarjeta       text,
  tiene_email_password boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select u.id, u.banco, u.cuenta_banco, u.clabe, u.clabe_interbancaria, u.numero_tarjeta,
         coalesce(u.email_password, '') <> ''
  from public.usuarios u
  where u.id = any (p_ids)
    and (
      u.id = auth.uid()
      or public.get_my_rol() = 'Administrador'
      or (public.get_my_rol() = 'Gerente' and u.oficina_id = any (public.get_my_oficina_ids()))
    );
$$;

revoke all on function public.get_datos_privados_usuarios(uuid[]) from public, anon;
grant execute on function public.get_datos_privados_usuarios(uuid[]) to authenticated, service_role;

commit;
