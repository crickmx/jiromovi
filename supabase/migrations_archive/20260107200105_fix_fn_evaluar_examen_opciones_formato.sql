/*
  # Corregir función fn_evaluar_examen para formato de opciones

  1. Actualizar fn_evaluar_examen para transformar opciones a formato {letra, texto}
  2. Asegurar compatibilidad con frontend que espera array de objetos
*/

CREATE OR REPLACE FUNCTION fn_evaluar_examen(
  p_user_id uuid,
  p_examen_id uuid,
  p_respuestas jsonb,
  p_tiempo_minutos integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_intento_id uuid;
  v_total_preguntas integer;
  v_respuestas_correctas integer := 0;
  v_puntaje integer;
  v_aprobado boolean;
  v_puntaje_minimo integer;
  v_tipo_examen text;
  v_pregunta record;
  v_retroalimentacion jsonb := '[]'::jsonb;
  v_opciones_transformadas jsonb;
  v_opcion text;
  v_index integer;
BEGIN
  SELECT tipo, puntaje_minimo_aprobacion
  INTO v_tipo_examen, v_puntaje_minimo
  FROM cedula_a_examenes
  WHERE id = p_examen_id;

  SELECT COUNT(*) INTO v_total_preguntas
  FROM cedula_a_preguntas
  WHERE examen_id = p_examen_id;

  FOR v_pregunta IN
    SELECT id, respuesta_correcta, explicacion, pregunta, opciones
    FROM cedula_a_preguntas
    WHERE examen_id = p_examen_id
  LOOP
    IF (p_respuestas->v_pregunta.id::text)::text = v_pregunta.respuesta_correcta THEN
      v_respuestas_correctas := v_respuestas_correctas + 1;
    END IF;

    -- Transformar opciones de array simple a array de objetos {letra, texto}
    v_opciones_transformadas := '[]'::jsonb;
    v_index := 0;
    
    FOR v_opcion IN SELECT jsonb_array_elements_text(v_pregunta.opciones)
    LOOP
      v_opciones_transformadas := v_opciones_transformadas || jsonb_build_object(
        'letra', chr(65 + v_index), -- A, B, C, D
        'texto', v_opcion
      );
      v_index := v_index + 1;
    END LOOP;

    v_retroalimentacion := v_retroalimentacion || jsonb_build_object(
      'pregunta_id', v_pregunta.id,
      'pregunta', v_pregunta.pregunta,
      'opciones', v_opciones_transformadas,
      'respuesta_usuario', p_respuestas->v_pregunta.id::text,
      'respuesta_correcta', v_pregunta.respuesta_correcta,
      'es_correcta', (p_respuestas->v_pregunta.id::text)::text = v_pregunta.respuesta_correcta,
      'explicacion', v_pregunta.explicacion
    );
  END LOOP;

  IF v_total_preguntas > 0 THEN
    v_puntaje := ROUND((v_respuestas_correctas::numeric / v_total_preguntas::numeric) * 100);
  ELSE
    v_puntaje := 0;
  END IF;

  v_aprobado := v_puntaje >= v_puntaje_minimo;

  INSERT INTO cedula_a_intentos_examen (
    user_id,
    examen_id,
    respuestas,
    puntaje,
    total_preguntas,
    aprobado,
    tiempo_empleado_minutos,
    fecha_intento
  ) VALUES (
    p_user_id,
    p_examen_id,
    p_respuestas,
    v_puntaje,
    v_total_preguntas,
    v_aprobado,
    p_tiempo_minutos,
    now()
  )
  RETURNING id INTO v_intento_id;

  IF v_aprobado AND v_tipo_examen = 'final' THEN
    PERFORM fn_generar_certificado(p_user_id, p_examen_id, v_intento_id, v_puntaje);
  END IF;

  RETURN jsonb_build_object(
    'intento_id', v_intento_id,
    'puntaje', v_puntaje,
    'total_preguntas', v_total_preguntas,
    'respuestas_correctas', v_respuestas_correctas,
    'respuestas_incorrectas', v_total_preguntas - v_respuestas_correctas,
    'aprobado', v_aprobado,
    'retroalimentacion', v_retroalimentacion
  );
END;
$$;