/*
  Cédula A: el simulador final solo devuelve la calificación.

  Antes indicaba qué preguntas se fallaron, y con reintentos ilimitados se
  aprobaba por descarte en ~3 intentos. Ahora, en el examen final,
  `retroalimentacion` va vacía y se agrega `desglose`: aciertos por módulo,
  solo para preguntas con modulo_referencia_id. Las prácticas no cambian.
*/
CREATE OR REPLACE FUNCTION public.fn_evaluar_examen(p_user_id uuid, p_examen_id uuid, p_respuestas jsonb, p_tiempo_minutos integer DEFAULT 0)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_intento_id uuid;
  v_certificado_id uuid;
  v_total_preguntas integer := 0;
  v_respuestas_correctas integer := 0;
  v_puntaje integer;
  v_aprobado boolean;
  v_puntaje_minimo integer;
  v_tipo_examen text;
  v_es_final boolean;
  v_pregunta record;
  v_retroalimentacion jsonb := '[]'::jsonb;
  v_desglose jsonb;
  v_es_correcta boolean;
BEGIN
  IF v_user IS NULL OR (p_user_id IS NOT NULL AND p_user_id <> v_user) THEN
    RAISE EXCEPTION 'No autorizado' USING ERRCODE = '42501';
  END IF;

  SELECT tipo, puntaje_minimo_aprobacion INTO v_tipo_examen, v_puntaje_minimo
  FROM cedula_a_examenes WHERE id = p_examen_id;

  IF v_tipo_examen IS NULL THEN
    RAISE EXCEPTION 'Examen no encontrado';
  END IF;

  v_es_final := v_tipo_examen = 'final';

  FOR v_pregunta IN
    SELECT id, respuesta_correcta, explicacion, pregunta, opciones
    FROM cedula_a_preguntas WHERE examen_id = p_examen_id ORDER BY orden
  LOOP
    v_total_preguntas := v_total_preguntas + 1;
    v_es_correcta := (p_respuestas ->> v_pregunta.id::text) = v_pregunta.respuesta_correcta;
    IF v_es_correcta THEN
      v_respuestas_correctas := v_respuestas_correctas + 1;
    END IF;

    -- El simulador final no devuelve retroalimentación por pregunta.
    IF NOT v_es_final THEN
      v_retroalimentacion := v_retroalimentacion || jsonb_build_object(
        'pregunta_id', v_pregunta.id,
        'pregunta', v_pregunta.pregunta,
        'opciones', (
          SELECT COALESCE(jsonb_agg(jsonb_build_object('letra', chr(64 + o.idx::int), 'texto', o.texto) ORDER BY o.idx), '[]'::jsonb)
          FROM jsonb_array_elements_text(v_pregunta.opciones) WITH ORDINALITY AS o(texto, idx)
        ),
        'respuesta_usuario', p_respuestas -> v_pregunta.id::text,
        'respuesta_correcta', v_pregunta.respuesta_correcta,
        'es_correcta', COALESCE(v_es_correcta, false),
        'explicacion', v_pregunta.explicacion
      );
    END IF;
  END LOOP;

  IF v_es_final THEN
    SELECT COALESCE(jsonb_agg(d ORDER BY (d->>'orden')::int), '[]'::jsonb) INTO v_desglose
    FROM (
      SELECT jsonb_build_object(
        'modulo', m.titulo,
        'orden', m.orden,
        'correctas', COUNT(*) FILTER (WHERE (p_respuestas ->> q.id::text) = q.respuesta_correcta),
        'total', COUNT(*)
      ) AS d
      FROM cedula_a_preguntas q
      JOIN cedula_a_modulos m ON m.id = q.modulo_referencia_id
      WHERE q.examen_id = p_examen_id
      GROUP BY m.id, m.titulo, m.orden
    ) s;
  END IF;

  v_puntaje := CASE WHEN v_total_preguntas > 0
    THEN ROUND((v_respuestas_correctas::numeric / v_total_preguntas) * 100) ELSE 0 END;
  v_aprobado := v_puntaje >= COALESCE(v_puntaje_minimo, 80);

  INSERT INTO cedula_a_intentos_examen (user_id, examen_id, respuestas, puntaje, total_preguntas, aprobado, tiempo_empleado_minutos, fecha_intento)
  VALUES (v_user, p_examen_id, p_respuestas, v_puntaje, v_total_preguntas, v_aprobado, COALESCE(p_tiempo_minutos, 0), now())
  RETURNING id INTO v_intento_id;

  IF v_aprobado AND v_es_final THEN
    v_certificado_id := fn_generar_certificado(v_user, v_intento_id);
  END IF;

  RETURN jsonb_build_object(
    'intento_id', v_intento_id,
    'certificado_id', v_certificado_id,
    'puntaje', v_puntaje,
    'total_preguntas', v_total_preguntas,
    'respuestas_correctas', v_respuestas_correctas,
    'respuestas_incorrectas', v_total_preguntas - v_respuestas_correctas,
    'aprobado', v_aprobado,
    'retroalimentacion', v_retroalimentacion,
    'desglose', v_desglose
  );
END;
$$;
