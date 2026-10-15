alter table public.usuarios
  add column if not exists cedula_cnsf text;

comment on column public.usuarios.cedula_cnsf is
  'Número de cédula CNSF proporcionado por agentes durante su pre-registro';

create index if not exists idx_usuarios_cedula_cnsf
  on public.usuarios (cedula_cnsf)
  where cedula_cnsf is not null;
