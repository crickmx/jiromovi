/*
  Seguros Education — Fase 2: correcciones críticas

  1. seguros_education_leads: la tabla que usa la edge function nunca se creó
     (todos los leads se perdían).
  2. Helper se_es_admin(): las políticas del módulo exigían rol = 'admin', pero
     los administradores reales tienen rol = 'Administrador'.
  3. Examen Cédula A:
     - Las respuestas correctas y explicaciones ya no se pueden leer desde el
       cliente (solo vía fn_evaluar_examen, después de enviar).
     - fn_evaluar_examen llamaba a fn_generar_certificado con 4 argumentos, pero
       solo existe la versión (user, intento): al aprobar el final fallaba y se
       revertía el intento completo.
     - Las funciones SECURITY DEFINER toman el usuario de auth.uid() y fijan
       search_path.
  4. Analytics:
     - registrar_evento_educacion usa auth.uid() y agrupa la sesión por
       contenido (antes todas las lecciones de una pestaña caían en una fila).
     - completo / es_reproduccion_valida ya no se revierten con eventos
       posteriores.
     - v_analytics_lecciones_stats recupera security_invoker (quedó sin RLS al
       recrearse).
*/

-- ─── 1. Leads ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.seguros_education_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL CHECK (char_length(nombre) <= 120),
  email text NOT NULL CHECK (char_length(email) <= 254),
  telefono text CHECK (char_length(telefono) <= 30),
  mensaje text CHECK (char_length(mensaje) <= 2000),
  origen text,
  pagina text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_se_leads_created_at ON public.seguros_education_leads (created_at DESC);

ALTER TABLE public.seguros_education_leads ENABLE ROW LEVEL SECURITY;

-- Solo la edge function (service role) inserta; administradores consultan.
REVOKE ALL ON public.seguros_education_leads FROM anon, authenticated;
GRANT SELECT ON public.seguros_education_leads TO authenticated;

-- ─── 2. Helper de administrador ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.se_es_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM usuarios
    WHERE id = auth.uid() AND rol IN ('Administrador', 'administrador', 'admin')
  );
$$;

REVOKE ALL ON FUNCTION public.se_es_admin() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.se_es_admin() TO authenticated;

DROP POLICY IF EXISTS "Admins can view leads" ON public.seguros_education_leads;
CREATE POLICY "Admins can view leads" ON public.seguros_education_leads
  FOR SELECT TO authenticated USING (public.se_es_admin());

-- Analytics
DROP POLICY IF EXISTS "Admins can view all events" ON public.seguros_education_eventos;
CREATE POLICY "Admins can view all events" ON public.seguros_education_eventos
  FOR SELECT TO authenticated USING (public.se_es_admin());

DROP POLICY IF EXISTS "Admins can view all sessions" ON public.seguros_education_sesiones;
CREATE POLICY "Admins can view all sessions" ON public.seguros_education_sesiones
  FOR SELECT TO authenticated USING (public.se_es_admin());

-- Cédula A: lectura para admins
DROP POLICY IF EXISTS "Admins can view all certificates" ON public.cedula_a_certificados;
CREATE POLICY "Admins can view all certificates" ON public.cedula_a_certificados
  FOR SELECT TO authenticated USING (public.se_es_admin());

DROP POLICY IF EXISTS "Admins can view all exam attempts" ON public.cedula_a_intentos_examen;
CREATE POLICY "Admins can view all exam attempts" ON public.cedula_a_intentos_examen
  FOR SELECT TO authenticated USING (public.se_es_admin());

DROP POLICY IF EXISTS "Admins can view all lesson progress" ON public.cedula_a_progreso_lecciones;
CREATE POLICY "Admins can view all lesson progress" ON public.cedula_a_progreso_lecciones
  FOR SELECT TO authenticated USING (public.se_es_admin());

DROP POLICY IF EXISTS "Admins can view all module progress" ON public.cedula_a_progreso_modulos;
CREATE POLICY "Admins can view all module progress" ON public.cedula_a_progreso_modulos
  FOR SELECT TO authenticated USING (public.se_es_admin());

-- Cédula A: gestión de contenido para admins
DROP POLICY IF EXISTS "Admins can manage exams" ON public.cedula_a_examenes;
CREATE POLICY "Admins can manage exams" ON public.cedula_a_examenes
  FOR ALL TO authenticated USING (public.se_es_admin()) WITH CHECK (public.se_es_admin());

DROP POLICY IF EXISTS "Admins can manage glossary" ON public.cedula_a_glosario;
CREATE POLICY "Admins can manage glossary" ON public.cedula_a_glosario
  FOR ALL TO authenticated USING (public.se_es_admin()) WITH CHECK (public.se_es_admin());

DROP POLICY IF EXISTS "Admins can manage lessons" ON public.cedula_a_lecciones;
CREATE POLICY "Admins can manage lessons" ON public.cedula_a_lecciones
  FOR ALL TO authenticated USING (public.se_es_admin()) WITH CHECK (public.se_es_admin());

DROP POLICY IF EXISTS "Admins can manage mental maps" ON public.cedula_a_mapas_mentales;
CREATE POLICY "Admins can manage mental maps" ON public.cedula_a_mapas_mentales
  FOR ALL TO authenticated USING (public.se_es_admin()) WITH CHECK (public.se_es_admin());

DROP POLICY IF EXISTS "Admins can manage questions" ON public.cedula_a_preguntas;
CREATE POLICY "Admins can manage questions" ON public.cedula_a_preguntas
  FOR ALL TO authenticated USING (public.se_es_admin()) WITH CHECK (public.se_es_admin());

DROP POLICY IF EXISTS "Admins can insert modules" ON public.cedula_a_modulos;
CREATE POLICY "Admins can insert modules" ON public.cedula_a_modulos
  FOR INSERT TO authenticated WITH CHECK (public.se_es_admin());

DROP POLICY IF EXISTS "Admins can update modules" ON public.cedula_a_modulos;
CREATE POLICY "Admins can update modules" ON public.cedula_a_modulos
  FOR UPDATE TO authenticated USING (public.se_es_admin()) WITH CHECK (public.se_es_admin());

DROP POLICY IF EXISTS "Admins can delete modules" ON public.cedula_a_modulos;
CREATE POLICY "Admins can delete modules" ON public.cedula_a_modulos
  FOR DELETE TO authenticated USING (public.se_es_admin());

-- ─── 3. Examen Cédula A ──────────────────────────────────────────────────────
-- Las columnas de respuesta solo se leen dentro de fn_evaluar_examen (SECURITY DEFINER).
REVOKE SELECT ON public.cedula_a_preguntas FROM anon, authenticated;
GRANT SELECT (id, examen_id, pregunta, opciones, modulo_referencia_id, dificultad, orden, created_at, updated_at)
  ON public.cedula_a_preguntas TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_generar_certificado(p_user_id uuid, p_intento_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_certificado_id uuid;
  v_examen_id uuid;
  v_puntaje integer;
BEGIN
  SELECT examen_id, puntaje INTO v_examen_id, v_puntaje
  FROM cedula_a_intentos_examen
  WHERE id = p_intento_id AND user_id = p_user_id AND aprobado = true;

  IF v_examen_id IS NULL THEN
    RAISE EXCEPTION 'Intento no válido para certificado';
  END IF;

  INSERT INTO cedula_a_certificados (user_id, examen_final_id, intento_id, puntaje_final, codigo_verificacion)
  VALUES (p_user_id, v_examen_id, p_intento_id, v_puntaje, 'CA-' || UPPER(substring(gen_random_uuid()::text, 1, 8)))
  RETURNING id INTO v_certificado_id;

  RETURN v_certificado_id;
END;
$$;

-- Solo se llama desde fn_evaluar_examen.
REVOKE EXECUTE ON FUNCTION public.fn_generar_certificado(uuid, uuid) FROM public, anon, authenticated;

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
  v_pregunta record;
  v_retroalimentacion jsonb := '[]'::jsonb;
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

  FOR v_pregunta IN
    SELECT id, respuesta_correcta, explicacion, pregunta, opciones
    FROM cedula_a_preguntas WHERE examen_id = p_examen_id ORDER BY orden
  LOOP
    v_total_preguntas := v_total_preguntas + 1;
    v_es_correcta := (p_respuestas ->> v_pregunta.id::text) = v_pregunta.respuesta_correcta;
    IF v_es_correcta THEN
      v_respuestas_correctas := v_respuestas_correctas + 1;
    END IF;

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
  END LOOP;

  v_puntaje := CASE WHEN v_total_preguntas > 0
    THEN ROUND((v_respuestas_correctas::numeric / v_total_preguntas) * 100) ELSE 0 END;
  v_aprobado := v_puntaje >= COALESCE(v_puntaje_minimo, 80);

  INSERT INTO cedula_a_intentos_examen (user_id, examen_id, respuestas, puntaje, total_preguntas, aprobado, tiempo_empleado_minutos, fecha_intento)
  VALUES (v_user, p_examen_id, p_respuestas, v_puntaje, v_total_preguntas, v_aprobado, COALESCE(p_tiempo_minutos, 0), now())
  RETURNING id INTO v_intento_id;

  IF v_aprobado AND v_tipo_examen = 'final' THEN
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
    'retroalimentacion', v_retroalimentacion
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_calcular_progreso_modulo(p_user_id uuid, p_modulo_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_total integer;
  v_completadas integer;
  v_porcentaje integer;
BEGIN
  IF v_user IS NULL OR (p_user_id IS NOT NULL AND p_user_id <> v_user) THEN
    RAISE EXCEPTION 'No autorizado' USING ERRCODE = '42501';
  END IF;

  SELECT COUNT(*) INTO v_total FROM cedula_a_lecciones WHERE modulo_id = p_modulo_id;

  SELECT COUNT(*) INTO v_completadas
  FROM cedula_a_progreso_lecciones pl
  JOIN cedula_a_lecciones l ON l.id = pl.leccion_id
  WHERE pl.user_id = v_user AND l.modulo_id = p_modulo_id AND pl.completado = true;

  v_porcentaje := CASE WHEN v_total > 0 THEN ROUND((v_completadas::numeric / v_total) * 100) ELSE 0 END;

  INSERT INTO cedula_a_progreso_modulos (user_id, modulo_id, lecciones_completadas, porcentaje_completado, updated_at)
  VALUES (v_user, p_modulo_id, v_completadas, v_porcentaje, now())
  ON CONFLICT (user_id, modulo_id) DO UPDATE SET
    lecciones_completadas = EXCLUDED.lecciones_completadas,
    porcentaje_completado = EXCLUDED.porcentaje_completado,
    updated_at = now(),
    fecha_completado = CASE WHEN EXCLUDED.porcentaje_completado = 100
      THEN COALESCE(cedula_a_progreso_modulos.fecha_completado, now())
      ELSE cedula_a_progreso_modulos.fecha_completado END;

  RETURN v_porcentaje;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_obtener_estadisticas_curso(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := COALESCE(p_user_id, auth.uid());
  v_total_lecciones integer;
  v_lecciones_completadas integer;
BEGIN
  IF auth.uid() IS NULL OR (v_user <> auth.uid() AND NOT se_es_admin()) THEN
    RAISE EXCEPTION 'No autorizado' USING ERRCODE = '42501';
  END IF;

  SELECT COUNT(*) INTO v_total_lecciones FROM cedula_a_lecciones;
  SELECT COUNT(*) INTO v_lecciones_completadas FROM cedula_a_progreso_lecciones WHERE user_id = v_user AND completado = true;

  RETURN jsonb_build_object(
    'total_lecciones', v_total_lecciones,
    'lecciones_completadas', v_lecciones_completadas,
    'total_modulos', (SELECT COUNT(*) FROM cedula_a_modulos),
    'modulos_completados', (SELECT COUNT(*) FROM cedula_a_progreso_modulos WHERE user_id = v_user AND porcentaje_completado = 100),
    'tiempo_total_segundos', (SELECT COALESCE(SUM(tiempo_estudio_segundos), 0) FROM cedula_a_progreso_lecciones WHERE user_id = v_user),
    'intentos_examenes', (SELECT COUNT(*) FROM cedula_a_intentos_examen WHERE user_id = v_user),
    'mejor_puntaje', (SELECT COALESCE(MAX(puntaje), 0) FROM cedula_a_intentos_examen WHERE user_id = v_user),
    'certificados', (SELECT COUNT(*) FROM cedula_a_certificados WHERE user_id = v_user),
    'porcentaje_global', CASE WHEN v_total_lecciones > 0
      THEN ROUND((v_lecciones_completadas::numeric / v_total_lecciones) * 100) ELSE 0 END
  );
END;
$$;

-- ─── 4. Analytics ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.registrar_evento_educacion(
  p_user_id uuid,
  p_lesson_id uuid DEFAULT NULL,
  p_class_id uuid DEFAULT NULL,
  p_session_id text DEFAULT NULL,
  p_event_type text DEFAULT 'lesson_view_start',
  p_progress_seconds integer DEFAULT 0,
  p_progress_percent numeric DEFAULT 0,
  p_duration_seconds integer DEFAULT NULL,
  p_device text DEFAULT 'web',
  p_browser text DEFAULT NULL,
  p_source text DEFAULT 'dashboard',
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_event_id uuid;
  v_oficina_id uuid;
  v_rol text;
  v_session text;
  v_valida boolean := (COALESCE(p_progress_seconds, 0) >= 10 OR COALESCE(p_progress_percent, 0) >= 5);
  v_completo boolean := (COALESCE(p_progress_percent, 0) >= 90);
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'No autenticado' USING ERRCODE = '42501';
  END IF;

  SELECT oficina_id, rol INTO v_oficina_id, v_rol FROM usuarios WHERE id = v_user;

  -- Una sesión de analytics por pestaña *y* por contenido.
  v_session := COALESCE(p_session_id, gen_random_uuid()::text)
    || ':' || COALESCE(p_lesson_id::text, p_class_id::text, 'general');

  INSERT INTO seguros_education_eventos (
    user_id, lesson_id, class_id, session_id, event_type, oficina_id, rol,
    progress_seconds, progress_percent, duration_seconds, device, browser, source, metadata
  ) VALUES (
    v_user, p_lesson_id, p_class_id, v_session, p_event_type, v_oficina_id, v_rol,
    p_progress_seconds, p_progress_percent, p_duration_seconds, p_device, p_browser, p_source, p_metadata
  )
  RETURNING id INTO v_event_id;

  INSERT INTO seguros_education_sesiones (
    session_id, user_id, lesson_id, class_id, oficina_id, rol, inicio,
    duracion_total_segundos, max_progress_percent, device, browser, es_reproduccion_valida, completo
  ) VALUES (
    v_session, v_user, p_lesson_id, p_class_id, v_oficina_id, v_rol, now(),
    p_progress_seconds, p_progress_percent, p_device, p_browser, v_valida, v_completo
  )
  ON CONFLICT (session_id) DO UPDATE SET
    duracion_total_segundos = GREATEST(seguros_education_sesiones.duracion_total_segundos, EXCLUDED.duracion_total_segundos),
    max_progress_percent = GREATEST(seguros_education_sesiones.max_progress_percent, EXCLUDED.max_progress_percent),
    es_reproduccion_valida = seguros_education_sesiones.es_reproduccion_valida OR EXCLUDED.es_reproduccion_valida,
    completo = seguros_education_sesiones.completo OR EXCLUDED.completo,
    fin = now(),
    updated_at = now();

  RETURN v_event_id;
END;
$$;

ALTER VIEW public.v_analytics_lecciones_stats SET (security_invoker = true);

-- Índices redundantes en tablas con muchas escrituras (el UNIQUE ya indexa session_id;
-- idx_eventos_user_lesson cubre user_id).
DROP INDEX IF EXISTS public.idx_sesiones_session_id;
DROP INDEX IF EXISTS public.idx_eventos_user_id;
