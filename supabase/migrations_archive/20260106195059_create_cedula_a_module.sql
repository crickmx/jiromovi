/*
  # Create Cédula A Course Module

  ## Overview
  Complete interactive course system for CNSF Cédula A preparation with modules,
  lessons, exams, progress tracking, certificates, mental maps, and glossary.

  ## New Tables

  ### Content Tables
  - `cedula_a_modulos` - Course modules (e.g., "Teoría General del Seguro")
  - `cedula_a_lecciones` - Lessons within each module with structured content
  - `cedula_a_examenes` - Exams (practice, module-specific, and final)
  - `cedula_a_preguntas` - Exam questions with multiple choice options
  - `cedula_a_mapas_mentales` - Mental maps for visual learning
  - `cedula_a_glosario` - Glossary of insurance terms

  ### Progress Tracking Tables
  - `cedula_a_progreso_modulos` - User progress per module
  - `cedula_a_progreso_lecciones` - User progress per lesson with notes
  - `cedula_a_intentos_examen` - Exam attempts with scores
  - `cedula_a_certificados` - Certificates issued for course completion

  ## Security
  - RLS enabled on all tables
  - Content tables: all users can read, only admins can modify
  - Progress tables: users can only see/modify their own data
  - Exam attempts: immutable after creation
  - Certificates: generated via database function only

  ## Functions
  - `fn_calcular_progreso_modulo` - Calculate module completion percentage
  - `fn_evaluar_examen` - Evaluate exam and generate results
  - `fn_generar_certificado` - Generate certificate for approved final exam
  - `fn_obtener_estadisticas_curso` - Get complete user statistics
*/

-- ============================================================================
-- CONTENT TABLES
-- ============================================================================

-- Modules table
CREATE TABLE IF NOT EXISTS cedula_a_modulos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  descripcion text NOT NULL,
  orden integer NOT NULL,
  icono text NOT NULL DEFAULT 'BookOpen',
  contenido_intro text,
  duracion_estimada_minutos integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Lessons table
CREATE TABLE IF NOT EXISTS cedula_a_lecciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  modulo_id uuid NOT NULL REFERENCES cedula_a_modulos(id) ON DELETE CASCADE,
  titulo text NOT NULL,
  contenido jsonb NOT NULL DEFAULT '{"sections": []}',
  orden integer NOT NULL,
  duracion_estimada_minutos integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Exams table
CREATE TABLE IF NOT EXISTS cedula_a_examenes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  descripcion text NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('practica', 'modulo', 'final')),
  modulo_id uuid REFERENCES cedula_a_modulos(id) ON DELETE SET NULL,
  duracion_referencia_minutos integer DEFAULT 60,
  puntaje_minimo_aprobacion integer DEFAULT 70,
  orden integer NOT NULL,
  instrucciones text,
  activo boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Questions table
CREATE TABLE IF NOT EXISTS cedula_a_preguntas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  examen_id uuid NOT NULL REFERENCES cedula_a_examenes(id) ON DELETE CASCADE,
  pregunta text NOT NULL,
  opciones jsonb NOT NULL DEFAULT '[]',
  respuesta_correcta text NOT NULL,
  explicacion text NOT NULL,
  modulo_referencia_id uuid REFERENCES cedula_a_modulos(id) ON DELETE SET NULL,
  dificultad text DEFAULT 'intermedia' CHECK (dificultad IN ('basica', 'intermedia', 'avanzada', 'trampa')),
  orden integer NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Mental maps table
CREATE TABLE IF NOT EXISTS cedula_a_mapas_mentales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  modulo_id uuid REFERENCES cedula_a_modulos(id) ON DELETE SET NULL,
  contenido_estructura jsonb NOT NULL DEFAULT '{}',
  imagen_url text,
  orden integer NOT NULL,
  descripcion text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Glossary table
CREATE TABLE IF NOT EXISTS cedula_a_glosario (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  termino text NOT NULL,
  definicion text NOT NULL,
  ejemplo text,
  modulo_id uuid REFERENCES cedula_a_modulos(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ============================================================================
-- PROGRESS TRACKING TABLES
-- ============================================================================

-- Module progress table
CREATE TABLE IF NOT EXISTS cedula_a_progreso_modulos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  modulo_id uuid NOT NULL REFERENCES cedula_a_modulos(id) ON DELETE CASCADE,
  lecciones_completadas integer DEFAULT 0,
  porcentaje_completado integer DEFAULT 0,
  fecha_inicio timestamptz DEFAULT now(),
  fecha_completado timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, modulo_id)
);

-- Lesson progress table
CREATE TABLE IF NOT EXISTS cedula_a_progreso_lecciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  leccion_id uuid NOT NULL REFERENCES cedula_a_lecciones(id) ON DELETE CASCADE,
  completado boolean DEFAULT false,
  tiempo_estudio_segundos integer DEFAULT 0,
  ultima_visita timestamptz DEFAULT now(),
  notas_usuario text,
  marcadores jsonb DEFAULT '[]',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, leccion_id)
);

-- Exam attempts table
CREATE TABLE IF NOT EXISTS cedula_a_intentos_examen (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  examen_id uuid NOT NULL REFERENCES cedula_a_examenes(id) ON DELETE CASCADE,
  respuestas jsonb NOT NULL DEFAULT '{}',
  puntaje integer NOT NULL,
  total_preguntas integer NOT NULL,
  aprobado boolean NOT NULL,
  tiempo_empleado_minutos integer DEFAULT 0,
  fecha_intento timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Certificates table
CREATE TABLE IF NOT EXISTS cedula_a_certificados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  examen_final_id uuid NOT NULL REFERENCES cedula_a_examenes(id) ON DELETE CASCADE,
  intento_id uuid NOT NULL REFERENCES cedula_a_intentos_examen(id) ON DELETE CASCADE,
  puntaje_final integer NOT NULL,
  fecha_emision timestamptz DEFAULT now(),
  codigo_verificacion text UNIQUE NOT NULL,
  pdf_url text,
  created_at timestamptz DEFAULT now()
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_cedula_a_lecciones_modulo_id ON cedula_a_lecciones(modulo_id);
CREATE INDEX IF NOT EXISTS idx_cedula_a_lecciones_orden ON cedula_a_lecciones(orden);
CREATE INDEX IF NOT EXISTS idx_cedula_a_preguntas_examen_id ON cedula_a_preguntas(examen_id);
CREATE INDEX IF NOT EXISTS idx_cedula_a_preguntas_orden ON cedula_a_preguntas(orden);
CREATE INDEX IF NOT EXISTS idx_cedula_a_progreso_modulos_user_id ON cedula_a_progreso_modulos(user_id);
CREATE INDEX IF NOT EXISTS idx_cedula_a_progreso_lecciones_user_id ON cedula_a_progreso_lecciones(user_id);
CREATE INDEX IF NOT EXISTS idx_cedula_a_intentos_examen_user_id ON cedula_a_intentos_examen(user_id);
CREATE INDEX IF NOT EXISTS idx_cedula_a_certificados_user_id ON cedula_a_certificados(user_id);
CREATE INDEX IF NOT EXISTS idx_cedula_a_certificados_codigo ON cedula_a_certificados(codigo_verificacion);

-- ============================================================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE cedula_a_modulos ENABLE ROW LEVEL SECURITY;
ALTER TABLE cedula_a_lecciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE cedula_a_examenes ENABLE ROW LEVEL SECURITY;
ALTER TABLE cedula_a_preguntas ENABLE ROW LEVEL SECURITY;
ALTER TABLE cedula_a_mapas_mentales ENABLE ROW LEVEL SECURITY;
ALTER TABLE cedula_a_glosario ENABLE ROW LEVEL SECURITY;
ALTER TABLE cedula_a_progreso_modulos ENABLE ROW LEVEL SECURITY;
ALTER TABLE cedula_a_progreso_lecciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE cedula_a_intentos_examen ENABLE ROW LEVEL SECURITY;
ALTER TABLE cedula_a_certificados ENABLE ROW LEVEL SECURITY;

-- Content tables: all authenticated users can read
CREATE POLICY "Authenticated users can view modules"
  ON cedula_a_modulos FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can view lessons"
  ON cedula_a_lecciones FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can view exams"
  ON cedula_a_examenes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can view questions"
  ON cedula_a_preguntas FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can view mental maps"
  ON cedula_a_mapas_mentales FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can view glossary"
  ON cedula_a_glosario FOR SELECT
  TO authenticated
  USING (true);

-- Content tables: only admins can modify
CREATE POLICY "Admins can insert modules"
  ON cedula_a_modulos FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'admin'
    )
  );

CREATE POLICY "Admins can update modules"
  ON cedula_a_modulos FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'admin'
    )
  );

CREATE POLICY "Admins can delete modules"
  ON cedula_a_modulos FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'admin'
    )
  );

-- Similar policies for other content tables
CREATE POLICY "Admins can manage lessons"
  ON cedula_a_lecciones FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'admin'
    )
  );

CREATE POLICY "Admins can manage exams"
  ON cedula_a_examenes FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'admin'
    )
  );

CREATE POLICY "Admins can manage questions"
  ON cedula_a_preguntas FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'admin'
    )
  );

CREATE POLICY "Admins can manage mental maps"
  ON cedula_a_mapas_mentales FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'admin'
    )
  );

CREATE POLICY "Admins can manage glossary"
  ON cedula_a_glosario FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'admin'
    )
  );

-- Progress tables: users can only see and modify their own data
CREATE POLICY "Users can view own module progress"
  ON cedula_a_progreso_modulos FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own module progress"
  ON cedula_a_progreso_modulos FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own module progress"
  ON cedula_a_progreso_modulos FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can view own lesson progress"
  ON cedula_a_progreso_lecciones FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own lesson progress"
  ON cedula_a_progreso_lecciones FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own lesson progress"
  ON cedula_a_progreso_lecciones FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Admins can view all progress
CREATE POLICY "Admins can view all module progress"
  ON cedula_a_progreso_modulos FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'admin'
    )
  );

CREATE POLICY "Admins can view all lesson progress"
  ON cedula_a_progreso_lecciones FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'admin'
    )
  );

-- Exam attempts: users can create and view their own
CREATE POLICY "Users can view own exam attempts"
  ON cedula_a_intentos_examen FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own exam attempts"
  ON cedula_a_intentos_examen FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can view all exam attempts"
  ON cedula_a_intentos_examen FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'admin'
    )
  );

-- Certificates: users can view their own, admins can view all
CREATE POLICY "Users can view own certificates"
  ON cedula_a_certificados FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can view all certificates"
  ON cedula_a_certificados FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'admin'
    )
  );

-- ============================================================================
-- DATABASE FUNCTIONS
-- ============================================================================

-- Function: Calculate module progress
CREATE OR REPLACE FUNCTION fn_calcular_progreso_modulo(
  p_user_id uuid,
  p_modulo_id uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total_lecciones integer;
  v_lecciones_completadas integer;
  v_porcentaje integer;
BEGIN
  SELECT COUNT(*) INTO v_total_lecciones
  FROM cedula_a_lecciones
  WHERE modulo_id = p_modulo_id;

  SELECT COUNT(*) INTO v_lecciones_completadas
  FROM cedula_a_progreso_lecciones pl
  JOIN cedula_a_lecciones l ON l.id = pl.leccion_id
  WHERE pl.user_id = p_user_id
    AND l.modulo_id = p_modulo_id
    AND pl.completado = true;

  IF v_total_lecciones > 0 THEN
    v_porcentaje := ROUND((v_lecciones_completadas::numeric / v_total_lecciones::numeric) * 100);
  ELSE
    v_porcentaje := 0;
  END IF;

  INSERT INTO cedula_a_progreso_modulos (user_id, modulo_id, lecciones_completadas, porcentaje_completado, updated_at)
  VALUES (p_user_id, p_modulo_id, v_lecciones_completadas, v_porcentaje, now())
  ON CONFLICT (user_id, modulo_id)
  DO UPDATE SET
    lecciones_completadas = v_lecciones_completadas,
    porcentaje_completado = v_porcentaje,
    updated_at = now(),
    fecha_completado = CASE WHEN v_porcentaje = 100 THEN now() ELSE cedula_a_progreso_modulos.fecha_completado END;

  RETURN v_porcentaje;
END;
$$;

-- Function: Evaluate exam
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

    v_retroalimentacion := v_retroalimentacion || jsonb_build_object(
      'pregunta_id', v_pregunta.id,
      'pregunta', v_pregunta.pregunta,
      'opciones', v_pregunta.opciones,
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
    tiempo_empleado_minutos
  )
  VALUES (
    p_user_id,
    p_examen_id,
    p_respuestas,
    v_puntaje,
    v_total_preguntas,
    v_aprobado,
    p_tiempo_minutos
  )
  RETURNING id INTO v_intento_id;

  IF v_tipo_examen = 'final' AND v_aprobado THEN
    PERFORM fn_generar_certificado(p_user_id, v_intento_id);
  END IF;

  RETURN jsonb_build_object(
    'intento_id', v_intento_id,
    'puntaje', v_puntaje,
    'total_preguntas', v_total_preguntas,
    'respuestas_correctas', v_respuestas_correctas,
    'aprobado', v_aprobado,
    'puntaje_minimo', v_puntaje_minimo,
    'retroalimentacion', v_retroalimentacion
  );
END;
$$;

-- Function: Generate certificate
CREATE OR REPLACE FUNCTION fn_generar_certificado(
  p_user_id uuid,
  p_intento_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_certificado_id uuid;
  v_codigo_verificacion text;
  v_examen_id uuid;
  v_puntaje integer;
BEGIN
  SELECT examen_id, puntaje
  INTO v_examen_id, v_puntaje
  FROM cedula_a_intentos_examen
  WHERE id = p_intento_id;

  v_codigo_verificacion := 'CA-' || UPPER(substring(gen_random_uuid()::text, 1, 8));

  INSERT INTO cedula_a_certificados (
    user_id,
    examen_final_id,
    intento_id,
    puntaje_final,
    codigo_verificacion
  )
  VALUES (
    p_user_id,
    v_examen_id,
    p_intento_id,
    v_puntaje,
    v_codigo_verificacion
  )
  RETURNING id INTO v_certificado_id;

  RETURN v_certificado_id;
END;
$$;

-- Function: Get course statistics
CREATE OR REPLACE FUNCTION fn_obtener_estadisticas_curso(
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total_lecciones integer;
  v_lecciones_completadas integer;
  v_modulos_completados integer;
  v_total_modulos integer;
  v_tiempo_total_segundos bigint;
  v_intentos_examenes integer;
  v_mejor_puntaje integer;
  v_certificados integer;
BEGIN
  SELECT COUNT(*) INTO v_total_lecciones
  FROM cedula_a_lecciones;

  SELECT COUNT(*) INTO v_lecciones_completadas
  FROM cedula_a_progreso_lecciones
  WHERE user_id = p_user_id AND completado = true;

  SELECT COUNT(*) INTO v_total_modulos
  FROM cedula_a_modulos;

  SELECT COUNT(*) INTO v_modulos_completados
  FROM cedula_a_progreso_modulos
  WHERE user_id = p_user_id AND porcentaje_completado = 100;

  SELECT COALESCE(SUM(tiempo_estudio_segundos), 0) INTO v_tiempo_total_segundos
  FROM cedula_a_progreso_lecciones
  WHERE user_id = p_user_id;

  SELECT COUNT(*) INTO v_intentos_examenes
  FROM cedula_a_intentos_examen
  WHERE user_id = p_user_id;

  SELECT COALESCE(MAX(puntaje), 0) INTO v_mejor_puntaje
  FROM cedula_a_intentos_examen
  WHERE user_id = p_user_id;

  SELECT COUNT(*) INTO v_certificados
  FROM cedula_a_certificados
  WHERE user_id = p_user_id;

  RETURN jsonb_build_object(
    'total_lecciones', v_total_lecciones,
    'lecciones_completadas', v_lecciones_completadas,
    'total_modulos', v_total_modulos,
    'modulos_completados', v_modulos_completados,
    'tiempo_total_segundos', v_tiempo_total_segundos,
    'intentos_examenes', v_intentos_examenes,
    'mejor_puntaje', v_mejor_puntaje,
    'certificados', v_certificados,
    'porcentaje_global', CASE WHEN v_total_lecciones > 0
      THEN ROUND((v_lecciones_completadas::numeric / v_total_lecciones::numeric) * 100)
      ELSE 0 END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION fn_calcular_progreso_modulo TO authenticated;
GRANT EXECUTE ON FUNCTION fn_evaluar_examen TO authenticated;
GRANT EXECUTE ON FUNCTION fn_generar_certificado TO authenticated;
GRANT EXECUTE ON FUNCTION fn_obtener_estadisticas_curso TO authenticated;
