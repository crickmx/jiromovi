-- QA 2026-10-22 · Datos bancarios y contraseña de correo: paso 2 de 2
--
-- CORRER SOLO cuando beta y producción ya tengan el front que lee esos datos con
-- get_datos_privados_usuarios (PR de esta misma rama). Con el front viejo, el login
-- truena: pide select=* sobre usuarios y ya no tendría permiso sobre estas columnas.
--
-- Quita a los usuarios con sesión la lectura directa de banco, cuenta_banco, clabe,
-- clabe_interbancaria, numero_tarjeta y email_password. Se siguen pudiendo ESCRIBIR
-- (el perfil, el alta y la edición de usuario no cambian), y las edge functions con
-- service_role siguen leyéndolas igual.
--
-- ⚠️ Desde esta migración la lectura de usuarios es por columna. Una columna NUEVA en
-- usuarios no se puede leer desde el navegador hasta darle grant:
--     grant select (columna_nueva) on public.usuarios to authenticated;
-- Y un select('*') sobre usuarios truena: hay que pedir columnas
-- (src/lib/usuarioColumnas.ts).

begin;

set local lock_timeout = '5s';

revoke select on public.usuarios from authenticated;
revoke select on public.usuarios from anon;

do $$
declare
  v_cols text;
begin
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position)
    into v_cols
  from information_schema.columns
  where table_schema = 'public' and table_name = 'usuarios'
    and column_name not in ('banco', 'cuenta_banco', 'clabe', 'clabe_interbancaria',
                            'numero_tarjeta', 'email_password');
  execute format('grant select (%s) on public.usuarios to authenticated', v_cols);
end $$;

commit;

-- Reversa (inmediata, por si algo truena):
-- grant select on public.usuarios to authenticated;
