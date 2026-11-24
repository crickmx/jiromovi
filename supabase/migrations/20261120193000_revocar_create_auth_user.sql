-- Cerrar la creación de cuentas por RPC: cualquiera con sesión podía crear un
-- Administrador.
--
-- `create_auth_user` y `create_user_with_password` son `SECURITY DEFINER` e
-- insertan en `auth.users` (con `crypt()`) y en `public.usuarios` con el rol que
-- reciban como parámetro. Con el GRANT que traía el baseline, cualquier usuario
-- autenticado —un Empleado, un Agente, una cuenta de prueba— podía llamarlas
-- desde la consola del navegador con la llave anónima de su sesión y crearse una
-- cuenta con rol 'Administrador'. No hace falta explotar nada más: el insert va
-- como el dueño de la función.
--
-- Ninguna función del repositorio ni del esquema las llama (verificado con
-- `grep` en el repo y buscando en `pg_proc.prosrc`), así que el único llamador
-- legítimo posible es una tarea administrativa con la llave de servicio. Se
-- revocan también de `PUBLIC`, porque PostgreSQL concede EXECUTE a PUBLIC por
-- defecto y ese grant implícito no aparece como `authenticated` en el catálogo.
revoke all on function public.create_auth_user(text, text, text, text, text, uuid, text)
  from public, anon, authenticated;
revoke all on function public.create_user_with_password(text, text, text, text, text, uuid, text)
  from public, anon, authenticated;

grant execute on function public.create_auth_user(text, text, text, text, text, uuid, text)
  to service_role;
grant execute on function public.create_user_with_password(text, text, text, text, text, uuid, text)
  to service_role;
