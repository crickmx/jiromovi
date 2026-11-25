-- ============================================================================
-- Aforo fijo de 200 en todas las capacitaciones
--
-- El campo no se captura ni se muestra: lo pone la aplicación. 200 es el tope
-- que Daily acepta por sala sin contratarlo aparte, así que se deja como valor
-- por omisión para que cualquier alta (formulario, script o función) lo herede.
-- ============================================================================

alter table public.aula_eventos
  alter column max_participantes set default 200;

update public.aula_eventos
   set max_participantes = 200
 where max_participantes is distinct from 200;