-- ============================================================================
-- Solicitudes de eliminación de cuenta (requisito de App Store y Google Play)
-- ============================================================================
-- Apple (guía 5.1.1(v)) y Google Play (política de datos de usuario) exigen que
-- quien tiene cuenta pueda pedir que se elimine DESDE la app, y Google además
-- exige una página web pública para pedirlo sin tener la app instalada.
--
-- Cada solicitud queda aquí. La edge function `solicitar-eliminacion-cuenta`
-- es lo único que escribe (con service_role), y avisa a los Administradores.
--
-- Por qué una cola y no un DELETE directo: auth.users tiene decenas de llaves
-- foráneas, varias con ON DELETE CASCADE, y la comparten MOVI, Seguwallet y
-- Chava (ver referencias_de_cuenta()). Borrar a ciegas puede llevarse datos de
-- otro producto. En Seguwallet la cuenta se bloquea al instante (ya no se puede
-- entrar) y un Administrador completa la depuración dentro de 30 días, que es el
-- plazo que se declara en las tiendas y en el aviso de privacidad.
-- ============================================================================

create table if not exists public.solicitudes_eliminacion_cuenta (
  id              uuid primary key default gen_random_uuid(),
  auth_user_id    uuid,                         -- null si llegó por la página web sin sesión
  plataforma      text not null check (plataforma in ('movi', 'seguwallet')),
  email           text not null,
  motivo          text,
  origen          text not null check (origen in ('app', 'web')),
  estado          text not null default 'pendiente'
                    check (estado in ('pendiente', 'procesada', 'rechazada')),
  cuenta_bloqueada boolean not null default false,
  creado_en       timestamptz not null default now(),
  procesado_en    timestamptz,
  procesado_por   uuid,
  notas           text
);

create index if not exists solicitudes_eliminacion_cuenta_pendientes_idx
  on public.solicitudes_eliminacion_cuenta (creado_en)
  where estado = 'pendiente';

alter table public.solicitudes_eliminacion_cuenta enable row level security;

-- Solo Administradores leen y actualizan (para marcarlas procesadas).
-- Nadie inserta desde el navegador: lo hace la edge function con service_role.
drop policy if exists solicitudes_eliminacion_admin_select on public.solicitudes_eliminacion_cuenta;
create policy solicitudes_eliminacion_admin_select
  on public.solicitudes_eliminacion_cuenta for select to authenticated
  using (exists (select 1 from public.usuarios u where u.id = auth.uid() and u.rol = 'Administrador'));

drop policy if exists solicitudes_eliminacion_admin_update on public.solicitudes_eliminacion_cuenta;
create policy solicitudes_eliminacion_admin_update
  on public.solicitudes_eliminacion_cuenta for update to authenticated
  using (exists (select 1 from public.usuarios u where u.id = auth.uid() and u.rol = 'Administrador'))
  with check (exists (select 1 from public.usuarios u where u.id = auth.uid() and u.rol = 'Administrador'));

comment on table public.solicitudes_eliminacion_cuenta is
  'Solicitudes de eliminación de cuenta desde las apps nativas y la página pública /legal/eliminar-cuenta.html. Plazo comprometido: 30 días.';
