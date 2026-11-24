-- Rediseño del módulo de correo (10/11/2026). Solo tablas nuevas; no toca nada existente.
-- Corrida en producción el 10/11/2026 vía MCP (versión 20261110191059).

-- Reglas básicas por persona: se aplican al abrir el correo (decisión de Ricardo).
create table if not exists public.correo_reglas (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nombre text not null,
  campo text not null check (campo in ('remitente', 'asunto')),
  operador text not null default 'contiene' check (operador in ('contiene', 'es', 'empieza')),
  valor text not null check (length(trim(valor)) > 0),
  accion text not null check (accion in ('mover', 'marcar_leido')),
  carpeta_destino text,
  activa boolean not null default true,
  orden integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint correo_reglas_mover_requiere_carpeta check (accion <> 'mover' or nullif(trim(carpeta_destino), '') is not null)
);
create index if not exists idx_correo_reglas_usuario on public.correo_reglas (usuario_id, orden);

alter table public.correo_reglas enable row level security;
create policy "correo_reglas_propias" on public.correo_reglas
  for all to authenticated
  using (usuario_id = (select auth.uid()))
  with check (usuario_id = (select auth.uid()));

-- Plantillas de respuesta personales. Las corporativas siguen en email_templates.
create table if not exists public.correo_plantillas_respuesta (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nombre text not null check (length(trim(nombre)) > 0),
  asunto text,
  cuerpo_html text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_correo_plantillas_respuesta_usuario on public.correo_plantillas_respuesta (usuario_id);

alter table public.correo_plantillas_respuesta enable row level security;
create policy "correo_plantillas_respuesta_propias" on public.correo_plantillas_respuesta
  for all to authenticated
  using (usuario_id = (select auth.uid()))
  with check (usuario_id = (select auth.uid()));

grant select, insert, update, delete on public.correo_reglas, public.correo_plantillas_respuesta to authenticated;

create trigger trigger_correo_reglas_updated_at before update on public.correo_reglas
  for each row execute function actualizar_updated_at();
create trigger trigger_correo_plantillas_respuesta_updated_at before update on public.correo_plantillas_respuesta
  for each row execute function actualizar_updated_at();
