-- ============================================================================
-- Módulos apagados para TODO el mundo (incluidos administradores)
--
-- Hasta ahora las reglas de visibilidad no aplicaban a Administrador. Se añade
-- un tipo 'global' que se evalúa antes que cualquier otro y que no admite
-- excepciones: sirve para apagar un módulo de golpe y volverlo a encender
-- cuando esté listo.
-- ============================================================================

alter table public.module_visibility
  drop constraint if exists module_visibility_target_type_check;

alter table public.module_visibility
  add constraint module_visibility_target_type_check
  check (target_type = any (array['role'::text, 'office'::text, 'user'::text, 'beta_user'::text, 'rol_id'::text, 'global'::text]));

create unique index if not exists module_visibility_global_unica
  on public.module_visibility (module_key, target_type)
  where target_type = 'global';

insert into public.module_visibility (module_key, target_type, target_value, visible)
select m.k, 'global', 'todos', false
from (values
  ('/centro-digital'),
  ('/vacaciones'),
  ('/mi-progreso'),
  ('/entrega-polizas'),
  ('/lector-qualitas'),
  ('/cotizar/multicotizador-gmm'),
  ('/cotizar/multicotizador'),
  ('/cotizar/a-la-medida'),
  ('/manuales'),
  ('/seguros-education/analytics')
) as m(k)
on conflict do nothing;