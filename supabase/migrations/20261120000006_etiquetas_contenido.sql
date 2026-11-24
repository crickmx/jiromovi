-- ============================================================================
-- Etiquetas de contenido para Seguros Education
--
-- Tres niveles fijos (aseguradora, ramo, subramo) más etiquetas libres, para
-- clasificar clases del Aula Virtual y lecciones de On Demand, y para filtrar
-- el directorio.
-- ============================================================================

create table if not exists public.seguros_etiquetas (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('aseguradora', 'ramo', 'subramo', 'libre')),
  nombre text not null,
  slug text not null,
  padre_id uuid references public.seguros_etiquetas(id) on delete cascade,
  creado_en timestamptz not null default now()
);

create unique index if not exists seguros_etiquetas_unica
  on public.seguros_etiquetas (tipo, slug, coalesce(padre_id, '00000000-0000-0000-0000-000000000000'::uuid));

create index if not exists seguros_etiquetas_tipo on public.seguros_etiquetas (tipo);

create table if not exists public.seguros_leccion_etiquetas (
  leccion_id uuid not null references public.seguros_lessons(id) on delete cascade,
  etiqueta_id uuid not null references public.seguros_etiquetas(id) on delete cascade,
  primary key (leccion_id, etiqueta_id)
);

create table if not exists public.aula_evento_etiquetas (
  evento_id uuid not null references public.aula_eventos(id) on delete cascade,
  etiqueta_id uuid not null references public.seguros_etiquetas(id) on delete cascade,
  primary key (evento_id, etiqueta_id)
);

create index if not exists seguros_leccion_etiquetas_et on public.seguros_leccion_etiquetas (etiqueta_id);
create index if not exists aula_evento_etiquetas_et on public.aula_evento_etiquetas (etiqueta_id);

-- ── RLS: lectura para cualquier usuario con sesión, escritura para quien ya
--    puede administrar contenido (el alta de etiquetas nuevas ocurre en el
--    mismo flujo). ──────────────────────────────────────────────────────────
alter table public.seguros_etiquetas enable row level security;
alter table public.seguros_leccion_etiquetas enable row level security;
alter table public.aula_evento_etiquetas enable row level security;

drop policy if exists seguros_etiquetas_lectura on public.seguros_etiquetas;
create policy seguros_etiquetas_lectura on public.seguros_etiquetas
  for select to authenticated, anon using (true);

drop policy if exists seguros_etiquetas_altas on public.seguros_etiquetas;
create policy seguros_etiquetas_altas on public.seguros_etiquetas
  for insert to authenticated with check (true);

drop policy if exists seguros_etiquetas_cambio on public.seguros_etiquetas;
create policy seguros_etiquetas_cambio on public.seguros_etiquetas
  for update to authenticated using (true) with check (true);

drop policy if exists leccion_etiquetas_todo on public.seguros_leccion_etiquetas;
create policy leccion_etiquetas_todo on public.seguros_leccion_etiquetas
  for all to authenticated using (true) with check (true);

drop policy if exists aula_evento_etiquetas_todo on public.aula_evento_etiquetas;
create policy aula_evento_etiquetas_todo on public.aula_evento_etiquetas
  for all to authenticated using (true) with check (true);

-- ── Semilla de aseguradoras ─────────────────────────────────────────────────
insert into public.seguros_etiquetas (tipo, nombre, slug)
values
  ('aseguradora', 'GNP', 'gnp'),
  ('aseguradora', 'AXA', 'axa'),
  ('aseguradora', 'MAPFRE', 'mapfre'),
  ('aseguradora', 'Quálitas', 'qualitas'),
  ('aseguradora', 'HDI Seguros', 'hdi'),
  ('aseguradora', 'Zurich', 'zurich'),
  ('aseguradora', 'Chubb', 'chubb'),
  ('aseguradora', 'BUPA', 'bupa'),
  ('aseguradora', 'BX+', 'bx-mas'),
  ('aseguradora', 'HIR Seguros', 'hir'),
  ('aseguradora', 'Continental Assist', 'continental-assist'),
  ('aseguradora', 'Ursus', 'ursus'),
  ('aseguradora', 'Unikuz', 'unikuz'),
  ('aseguradora', 'Q Salud', 'q-salud'),
  ('aseguradora', 'Grupo JIRO', 'grupo-jiro')
on conflict do nothing;

-- ── Semilla de ramos ────────────────────────────────────────────────────────
insert into public.seguros_etiquetas (tipo, nombre, slug)
values
  ('ramo', 'Autos', 'autos'),
  ('ramo', 'Vida', 'vida'),
  ('ramo', 'Gastos Médicos Mayores', 'gastos-medicos-mayores'),
  ('ramo', 'Salud', 'salud'),
  ('ramo', 'Accidentes Personales', 'accidentes-personales'),
  ('ramo', 'Empresarial y Daños', 'empresarial-danos'),
  ('ramo', 'Responsabilidad Civil', 'responsabilidad-civil'),
  ('ramo', 'Viajes', 'viajes'),
  ('ramo', 'Hogar', 'hogar'),
  ('ramo', 'Mascotas', 'mascotas'),
  ('ramo', 'Retiro y Ahorro', 'retiro-ahorro'),
  ('ramo', 'Desarrollo Comercial', 'desarrollo-comercial'),
  ('ramo', 'Legal y Normativo', 'legal-normativo'),
  ('ramo', 'Tecnología y Marketing', 'tecnologia-marketing'),
  ('ramo', 'Cultura y Bienestar', 'cultura-bienestar')
on conflict do nothing;

-- ── Subramos ────────────────────────────────────────────────────────────────
insert into public.seguros_etiquetas (tipo, nombre, slug, padre_id)
select 'subramo', v.nombre, v.slug, p.id
from (values
  ('autos', 'Autos particulares', 'autos-particulares'),
  ('autos', 'Autos financiados', 'autos-financiados'),
  ('autos', 'Flotillas', 'flotillas'),
  ('vida', 'Vida individual', 'vida-individual'),
  ('vida', 'Vida con ahorro', 'vida-con-ahorro'),
  ('gastos-medicos-mayores', 'Individual', 'gmm-individual'),
  ('gastos-medicos-mayores', 'Colectivo', 'gmm-colectivo'),
  ('gastos-medicos-mayores', 'Personalizado', 'gmm-personalizado'),
  ('salud', 'Prevención y bienestar', 'salud-prevencion'),
  ('accidentes-personales', 'Escolares', 'accidentes-escolares'),
  ('accidentes-personales', 'Colectivo', 'accidentes-colectivo'),
  ('empresarial-danos', 'Póliza empresarial', 'poliza-empresarial'),
  ('responsabilidad-civil', 'RC general', 'rc-general'),
  ('responsabilidad-civil', 'RC profesional', 'rc-profesional'),
  ('viajes', 'Asistencia en viaje', 'asistencia-viaje'),
  ('retiro-ahorro', 'Plan de retiro', 'plan-retiro'),
  ('desarrollo-comercial', 'Técnicas de venta', 'tecnicas-venta'),
  ('desarrollo-comercial', 'Prospección', 'prospeccion'),
  ('desarrollo-comercial', 'Liderazgo', 'liderazgo'),
  ('tecnologia-marketing', 'WhatsApp Business', 'whatsapp-business'),
  ('tecnologia-marketing', 'Marketing digital', 'marketing-digital')
) as v(padre_slug, nombre, slug)
join public.seguros_etiquetas p on p.slug = v.padre_slug and p.tipo = 'ramo'
on conflict do nothing;