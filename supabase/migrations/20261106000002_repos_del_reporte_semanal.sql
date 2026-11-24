-- Qué repos entran al reporte semanal de actividad.
--
-- Va en una tabla y no en el código porque Ricardo dijo el 06/11 que se van a
-- agregar más: con la lista escrita en la edge function, cada repo nuevo
-- obligaría a un deploy. Aquí es un INSERT.
--
-- ── Lo que se midió antes de escribir esto (06/11) ────────────────────────
--
-- 🔑 El trabajo de Froilán NO se ve en los commits. Entra por PULL REQUESTS
--    desde ramas `Froi…`, así que en `main` solo quedan los merges:
--
--      commits suyos en main de lector-polizas, últimos 30 días ....  1
--      pull requests suyos, histórico ..............................  20
--
--    Un reporte que contara commits lo dejaría como si no trabajara. Por eso
--    `contar_por` existe: dice qué se mide en cada repo, y arranca en 'pr'.
--
-- 🔑 Los dos repos son PÚBLICOS, así que la API de GitHub se lee sin token.
--    Si alguno se vuelve privado, el reporte debe DECIR que no pudo leerlo —
--    nunca reportar cero en silencio, que es como un reporte miente.
--
-- ⚠️ `crickmx/lector-qualitas-bolt` NO es el repo del lector: Froilán no es
--    colaborador ahí y está parado desde junio. El bueno es
--    `medaunbrauni/lector-polizas`.

begin;

set local lock_timeout = '5s';

create table if not exists public.reportes_repos (
  id          uuid primary key default gen_random_uuid(),
  owner       text        not null,
  nombre      text        not null,
  -- 'pr' | 'commit'. Ver arriba por qué el default NO es 'commit'.
  contar_por  text        not null default 'pr'
                check (contar_por in ('pr', 'commit')),
  activo      boolean     not null default true,
  nota        text,
  creado_en   timestamptz not null default now(),
  unique (owner, nombre)
);

comment on table public.reportes_repos is
  'Repos que entran al reporte semanal de actividad. Agregar uno es un INSERT, no un deploy.';
comment on column public.reportes_repos.contar_por is
  'Qué se cuenta en este repo. Por omisión PULL REQUESTS: contar commits deja fuera a quien trabaja por ramas y PRs (medido el 06/11).';

alter table public.reportes_repos enable row level security;

-- La edge function entra con service_role y se salta la RLS. Estas políticas
-- son para que un Administrador pueda ver y mantener la lista desde una
-- pantalla, el día que la haya.
drop policy if exists reportes_repos_admin_lee on public.reportes_repos;
create policy reportes_repos_admin_lee
  on public.reportes_repos for select to authenticated
  using (public.get_my_rol() = 'Administrador');

drop policy if exists reportes_repos_admin_escribe on public.reportes_repos;
create policy reportes_repos_admin_escribe
  on public.reportes_repos for all to authenticated
  using (public.get_my_rol() = 'Administrador')
  with check (public.get_my_rol() = 'Administrador');

-- Los dos de hoy. `on conflict do nothing` para que correrla dos veces no
-- duplique ni pise una nota que alguien haya editado.
insert into public.reportes_repos (owner, nombre, nota) values
  ('crickmx',      'jiromovi',       'MOVI. Al 06/11 Froilán es colaborador con push pero no ha hecho ningún commit ni PR.'),
  ('medaunbrauni', 'lector-polizas', 'Lector de pólizas. Aquí SÍ trabaja: 20 PRs al 06/11.')
on conflict (owner, nombre) do nothing;

commit;

-- Comprobación:
--
--   select owner, nombre, contar_por, activo from reportes_repos order by owner;
--
-- Para sumar un repo más adelante:
--
--   insert into reportes_repos (owner, nombre) values ('quien', 'que-repo');
--
-- Para sacar uno sin perder el registro de que existió:
--
--   update reportes_repos set activo = false where nombre = 'que-repo';
