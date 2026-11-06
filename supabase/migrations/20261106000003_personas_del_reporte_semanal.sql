-- A quién sigue el reporte semanal, y con qué cuenta de GitHub se le liga.
--
-- El reporte tiene que poder decir "Froilán: 3 PRs y 42 acciones en MOVI", y
-- para eso hay que unir dos identidades que hoy no se conocen: su usuario de
-- MOVI (`usuarios.id`) y su cuenta de GitHub (`Froilan-Perez-Garcia`).
--
-- ── Por qué una tabla y no una columna en `usuarios` ──────────────────────
--
-- `usuarios` da permisos **columna por columna** (ver `usuarioColumnas.ts`).
-- Agregarle un campo obliga a tocar cuatro lugares —migración, GRANT, la lista
-- de columnas, y el modal para editarlo— y olvidar uno no da error: el dato
-- llega vacío y la pantalla miente. Eso pasó el 06/11 con `rol_id`, que estaba
-- en el tipo y faltaba en el `.select()` del Directorio.
--
-- Aquí es una tabla chica que pertenece al reporte, igual que `reportes_repos`.
-- Sumar a alguien es un INSERT.
--
-- ⚠️ Esto NO es un permiso ni cambia lo que alguien ve. Es solo decir "esta
--    persona de MOVI es esta cuenta de GitHub", para poder sumar sus dos
--    mitades en el mismo renglón del reporte.

begin;

set local lock_timeout = '5s';

create table if not exists public.reportes_personas (
  id              uuid primary key default gen_random_uuid(),
  usuario_id      uuid        not null references public.usuarios(id) on delete cascade,
  -- El login de GitHub, tal cual: distingue mayúsculas al mostrarse pero la
  -- API no, así que se compara en minúsculas al armar el reporte.
  github_usuario  text,
  activo          boolean     not null default true,
  nota            text,
  creado_en       timestamptz not null default now(),
  unique (usuario_id)
);

comment on table public.reportes_personas is
  'A quién sigue el reporte semanal y con qué cuenta de GitHub se le liga. No otorga permisos.';
comment on column public.reportes_personas.github_usuario is
  'Login de GitHub. Si va en null, esa persona sale en el reporte solo con su actividad dentro de MOVI.';

alter table public.reportes_personas enable row level security;

-- La edge function entra con service_role y se salta la RLS. Estas políticas
-- son para mantener la lista desde una pantalla, el día que la haya.
drop policy if exists reportes_personas_admin_lee on public.reportes_personas;
create policy reportes_personas_admin_lee
  on public.reportes_personas for select to authenticated
  using (public.get_my_rol() = 'Administrador');

drop policy if exists reportes_personas_admin_escribe on public.reportes_personas;
create policy reportes_personas_admin_escribe
  on public.reportes_personas for all to authenticated
  using (public.get_my_rol() = 'Administrador')
  with check (public.get_my_rol() = 'Administrador');

-- Froilán. Se resuelve por correo y no por un id escrito a mano: si alguna vez
-- se recrea su cuenta, esta migración sigue apuntando a la persona correcta.
insert into public.reportes_personas (usuario_id, github_usuario, nota)
select u.id, 'Froilan-Perez-Garcia', 'Desarrollador. Al 06/11: 20 PRs en medaunbrauni/lector-polizas, 0 en jiromovi.'
  from public.usuarios u
 where lower(u.email_laboral) = 'desarrollo@jiro-operacion.mx'
on conflict (usuario_id) do nothing;

commit;

-- Comprobación — debe devolver una fila, con el nombre de Froilán:
--
--   select u.nombre_completo, p.github_usuario, p.activo
--     from reportes_personas p
--     join usuarios u on u.id = p.usuario_id;
--
-- Si devuelve CERO filas, su correo cambió: ajusta el `where` de arriba y
-- vuelve a correr solo ese INSERT.
--
-- Para sumar a alguien más:
--
--   insert into reportes_personas (usuario_id, github_usuario)
--   select id, 'su-login-de-github' from usuarios
--    where lower(email_laboral) = 'su-correo@…';
