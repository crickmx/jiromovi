-- ============================================================================
-- Las capacitaciones del Aula Virtual no tienen cupo
--
-- `max_participantes` venía con valor por omisión 100 y se pintaba en las
-- tarjetas. Ahora queda en NULL ("sin tope"): el aforo real lo pone Daily en su
-- sala (200 por sala en el plan actual). El campo se conserva porque otras
-- pantallas lo leen, pero ya no se captura ni se muestra.
-- ============================================================================

alter table public.aula_eventos
  alter column max_participantes drop default;

update public.aula_eventos
   set max_participantes = null
 where max_participantes is not null;