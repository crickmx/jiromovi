-- ============================================================================
-- Borrar una lección fallaba por un choque entre el FK y un check
--
-- seguros_education_eventos guarda el registro de actividad de On Demand y
-- exige que cada fila tenga lesson_id O class_id:
--     CHECK (lesson_id IS NOT NULL OR class_id IS NOT NULL)
-- Pero los dos FKs estaban en ON DELETE SET NULL, así que al borrar la lección
-- (o la sesión) el motor intentaba dejar la columna en NULL y el check
-- reventaba con "new row for relation ... violates check constraint".
--
-- La actividad de una lección borrada no sirve para nada: CASCADE.
-- ============================================================================

alter table public.seguros_education_eventos
  drop constraint if exists seguros_education_eventos_lesson_id_fkey;

alter table public.seguros_education_eventos
  add constraint seguros_education_eventos_lesson_id_fkey
  foreign key (lesson_id) references public.seguros_lessons(id) on delete cascade;

alter table public.seguros_education_eventos
  drop constraint if exists seguros_education_eventos_class_id_fkey;

alter table public.seguros_education_eventos
  add constraint seguros_education_eventos_class_id_fkey
  foreign key (class_id) references public.aula_virtual_sesiones(id) on delete cascade;