/*
  Cédula A: las respuestas correctas ya no se pueden leer desde el navegador.

  Pendiente de la Fase 2 (opción B): se aplica ahora que producción
  (f6f21cfa) y beta ya piden solo columnas explícitas de cedula_a_preguntas.
  respuesta_correcta y explicacion solo se leen dentro de fn_evaluar_examen
  (SECURITY DEFINER).
*/
REVOKE SELECT ON public.cedula_a_preguntas FROM anon, authenticated;
GRANT SELECT (id, examen_id, pregunta, opciones, modulo_referencia_id, dificultad, orden, created_at, updated_at)
  ON public.cedula_a_preguntas TO authenticated;
