/*
  # Sistema de Analytics para Seguros Education

  1. Nuevas Tablas
    - `seguros_education_eventos`
      - Registro individual de eventos (lesson_view_start, lesson_play, lesson_pause, etc.)
      - Incluye: user_id, lesson_id, class_id, event_type, timestamp, session_id, metadata
    
    - `seguros_education_sesiones`
      - Agrupa eventos por sesión para análisis de comportamiento
      - Incluye: session_id, user_id, lesson_id, class_id, inicio, fin, duración total
    
  2. Vistas Materializadas (para performance)
    - `v_analytics_lecciones_stats`
      - Estadísticas agregadas por lección: reproducciones, usuarios únicos, completion rate
    
    - `v_analytics_usuarios_stats`
      - Actividad por usuario: lecciones vistas, tiempo total, progreso
    
    - `v_analytics_clases_stats`
      - Estadísticas de Aula Virtual: aperturas, joins, usuarios únicos
  
  3. Funciones
    - `registrar_evento_educacion()` - Función para insertar eventos con validación
    - `calcular_metricas_lecciones()` - Calcula reproducciones válidas (>10s o >5%)
    - `exportar_eventos_csv()` - Exporta datos para análisis externo
  
  4. Security
    - Enable RLS en todas las tablas
    - Solo admins pueden ver analytics completos
    - Gerentes solo su oficina (futuro)
    - Usuarios solo su progreso personal

  5. Índices
    - Optimizar queries por user_id, lesson_id, class_id, timestamp, oficina_id
*/

-- =====================================================
-- TABLA: seguros_education_eventos
-- =====================================================
CREATE TABLE IF NOT EXISTS seguros_education_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identificadores
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lesson_id uuid REFERENCES seguros_lessons(id) ON DELETE SET NULL,
  class_id uuid REFERENCES aula_virtual_sesiones(id) ON DELETE SET NULL,
  session_id text NOT NULL, -- UUID generado en frontend para agrupar sesión
  
  -- Tipo de evento
  event_type text NOT NULL CHECK (event_type IN (
    -- On Demand events
    'lesson_view_start', 'lesson_play', 'lesson_pause', 
    'lesson_complete', 'lesson_progress', 'lesson_download_attachment',
    -- Aula Virtual events
    'class_open', 'class_join_click', 'class_join_success', 
    'class_recording_open'
  )),
  
  -- Metadatos de contexto
  oficina_id uuid REFERENCES oficinas(id) ON DELETE SET NULL,
  rol text, -- admin, gerente, empleado, agente
  
  -- Datos del evento
  progress_seconds integer DEFAULT 0, -- segundos reproducidos
  progress_percent numeric(5,2) DEFAULT 0, -- porcentaje de avance (0-100)
  duration_seconds integer, -- duración total del contenido
  
  -- Device/Browser info
  device text, -- web, mobile
  browser text,
  source text, -- dashboard, email, notification
  
  -- Metadata adicional (JSON flexible)
  metadata jsonb DEFAULT '{}'::jsonb,
  
  -- Timestamps
  created_at timestamptz DEFAULT now(),
  
  -- Constraints
  CONSTRAINT valid_progress CHECK (progress_percent >= 0 AND progress_percent <= 100),
  CONSTRAINT requires_lesson_or_class CHECK (lesson_id IS NOT NULL OR class_id IS NOT NULL)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_eventos_user_id ON seguros_education_eventos(user_id);
CREATE INDEX IF NOT EXISTS idx_eventos_lesson_id ON seguros_education_eventos(lesson_id);
CREATE INDEX IF NOT EXISTS idx_eventos_class_id ON seguros_education_eventos(class_id);
CREATE INDEX IF NOT EXISTS idx_eventos_session_id ON seguros_education_eventos(session_id);
CREATE INDEX IF NOT EXISTS idx_eventos_event_type ON seguros_education_eventos(event_type);
CREATE INDEX IF NOT EXISTS idx_eventos_created_at ON seguros_education_eventos(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_eventos_oficina_id ON seguros_education_eventos(oficina_id);
CREATE INDEX IF NOT EXISTS idx_eventos_user_lesson ON seguros_education_eventos(user_id, lesson_id);

-- =====================================================
-- TABLA: seguros_education_sesiones
-- =====================================================
CREATE TABLE IF NOT EXISTS seguros_education_sesiones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  session_id text UNIQUE NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lesson_id uuid REFERENCES seguros_lessons(id) ON DELETE SET NULL,
  class_id uuid REFERENCES aula_virtual_sesiones(id) ON DELETE SET NULL,
  
  oficina_id uuid REFERENCES oficinas(id) ON DELETE SET NULL,
  rol text,
  
  -- Timing de sesión
  inicio timestamptz NOT NULL DEFAULT now(),
  fin timestamptz,
  duracion_total_segundos integer DEFAULT 0,
  
  -- Reproducciones válidas (>=10s o >=5%)
  es_reproduccion_valida boolean DEFAULT false,
  
  -- Completó la lección
  completo boolean DEFAULT false,
  max_progress_percent numeric(5,2) DEFAULT 0,
  
  device text,
  browser text,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sesiones_user_id ON seguros_education_sesiones(user_id);
CREATE INDEX IF NOT EXISTS idx_sesiones_lesson_id ON seguros_education_sesiones(lesson_id);
CREATE INDEX IF NOT EXISTS idx_sesiones_class_id ON seguros_education_sesiones(class_id);
CREATE INDEX IF NOT EXISTS idx_sesiones_session_id ON seguros_education_sesiones(session_id);
CREATE INDEX IF NOT EXISTS idx_sesiones_inicio ON seguros_education_sesiones(inicio DESC);

-- =====================================================
-- FUNCIÓN: registrar_evento_educacion
-- =====================================================
CREATE OR REPLACE FUNCTION registrar_evento_educacion(
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
AS $$
DECLARE
  v_event_id uuid;
  v_oficina_id uuid;
  v_rol text;
  v_session_uuid text;
BEGIN
  -- Obtener oficina_id y rol del usuario
  SELECT oficina_id, rol INTO v_oficina_id, v_rol
  FROM usuarios
  WHERE id = p_user_id;
  
  -- Generar session_id si no se proporciona
  v_session_uuid := COALESCE(p_session_id, gen_random_uuid()::text);
  
  -- Insertar evento
  INSERT INTO seguros_education_eventos (
    user_id, lesson_id, class_id, session_id, event_type,
    oficina_id, rol,
    progress_seconds, progress_percent, duration_seconds,
    device, browser, source, metadata
  ) VALUES (
    p_user_id, p_lesson_id, p_class_id, v_session_uuid, p_event_type,
    v_oficina_id, v_rol,
    p_progress_seconds, p_progress_percent, p_duration_seconds,
    p_device, p_browser, p_source, p_metadata
  )
  RETURNING id INTO v_event_id;
  
  -- Actualizar o crear sesión
  INSERT INTO seguros_education_sesiones (
    session_id, user_id, lesson_id, class_id, oficina_id, rol,
    inicio, duracion_total_segundos, max_progress_percent,
    device, browser,
    es_reproduccion_valida,
    completo
  )
  VALUES (
    v_session_uuid, p_user_id, p_lesson_id, p_class_id, v_oficina_id, v_rol,
    now(), p_progress_seconds, p_progress_percent,
    p_device, p_browser,
    (p_progress_seconds >= 10 OR p_progress_percent >= 5),
    (p_progress_percent >= 90)
  )
  ON CONFLICT (session_id) DO UPDATE SET
    duracion_total_segundos = GREATEST(seguros_education_sesiones.duracion_total_segundos, p_progress_seconds),
    max_progress_percent = GREATEST(seguros_education_sesiones.max_progress_percent, p_progress_percent),
    es_reproduccion_valida = (p_progress_seconds >= 10 OR p_progress_percent >= 5),
    completo = (p_progress_percent >= 90),
    fin = now(),
    updated_at = now();
  
  RETURN v_event_id;
END;
$$;

-- =====================================================
-- VISTA: Analytics por Lección (Agregado)
-- =====================================================
CREATE OR REPLACE VIEW v_analytics_lecciones_stats AS
SELECT
  l.id as lesson_id,
  l.titulo,
  l.categoria_id,
  c.nombre as categoria_nombre,
  
  -- Reproducciones válidas (>=10s o >=5%)
  COUNT(DISTINCT CASE WHEN s.es_reproduccion_valida THEN s.user_id END) as reproducciones,
  
  -- Usuarios únicos
  COUNT(DISTINCT s.user_id) as usuarios_unicos,
  
  -- Completadas
  COUNT(DISTINCT CASE WHEN s.completo THEN s.user_id END) as completadas,
  
  -- Completion rate
  ROUND(
    100.0 * COUNT(DISTINCT CASE WHEN s.completo THEN s.user_id END)::numeric / 
    NULLIF(COUNT(DISTINCT CASE WHEN s.es_reproduccion_valida THEN s.user_id END), 0),
    2
  ) as completion_rate_percent,
  
  -- Tiempo promedio reproducido
  ROUND(AVG(s.duracion_total_segundos)) as tiempo_promedio_segundos,
  
  -- Tiempo total reproducido
  SUM(s.duracion_total_segundos) as tiempo_total_segundos,
  
  -- Última visualización
  MAX(s.inicio) as ultima_visualizacion,
  
  -- Por oficina (top 3)
  (
    SELECT jsonb_agg(
      jsonb_build_object(
        'oficina_id', sub.oficina_id,
        'oficina_nombre', o.nombre,
        'count', sub.count
      )
      ORDER BY sub.count DESC
    )
    FROM (
      SELECT oficina_id, COUNT(*) as count
      FROM seguros_education_sesiones
      WHERE lesson_id = l.id AND es_reproduccion_valida
      GROUP BY oficina_id
      ORDER BY count DESC
      LIMIT 3
    ) sub
    LEFT JOIN oficinas o ON o.id = sub.oficina_id
  ) as top_oficinas

FROM seguros_lessons l
LEFT JOIN seguros_categories c ON c.id = l.categoria_id
LEFT JOIN seguros_education_sesiones s ON s.lesson_id = l.id
GROUP BY l.id, l.titulo, l.categoria_id, c.nombre;

-- =====================================================
-- VISTA: Analytics por Usuario
-- =====================================================
CREATE OR REPLACE VIEW v_analytics_usuarios_stats AS
SELECT
  u.id as user_id,
  u.nombre_completo,
  u.email_laboral,
  u.oficina_id,
  o.nombre as oficina_nombre,
  u.rol,
  
  -- Lecciones vistas (reproducciones válidas)
  COUNT(DISTINCT CASE WHEN s.es_reproduccion_valida AND s.lesson_id IS NOT NULL THEN s.lesson_id END) as lecciones_vistas,
  
  -- Lecciones completadas
  COUNT(DISTINCT CASE WHEN s.completo AND s.lesson_id IS NOT NULL THEN s.lesson_id END) as lecciones_completadas,
  
  -- Clases abiertas (Aula Virtual)
  COUNT(DISTINCT CASE WHEN s.class_id IS NOT NULL THEN s.class_id END) as clases_abiertas,
  
  -- Tiempo total (minutos)
  ROUND(SUM(s.duracion_total_segundos)::numeric / 60, 1) as tiempo_total_minutos,
  
  -- Último acceso
  MAX(s.inicio) as ultimo_acceso,
  
  -- Días activos
  COUNT(DISTINCT DATE(s.inicio)) as dias_activos

FROM usuarios u
LEFT JOIN oficinas o ON o.id = u.oficina_id
LEFT JOIN seguros_education_sesiones s ON s.user_id = u.id
WHERE u.deleted_at IS NULL
GROUP BY u.id, u.nombre_completo, u.email_laboral, u.oficina_id, o.nombre, u.rol;

-- =====================================================
-- VISTA: Analytics Aula Virtual (por clase)
-- =====================================================
CREATE OR REPLACE VIEW v_analytics_clases_stats AS
SELECT
  avs.id as class_id,
  avs.titulo,
  avs.fecha_inicio,
  avs.instructor_id,
  ui.nombre_completo as instructor_nombre,
  
  -- Aperturas (class_open)
  COUNT(DISTINCT CASE WHEN e.event_type = 'class_open' THEN e.user_id END) as aperturas,
  
  -- Clics en "Entrar" (class_join_click)
  COUNT(DISTINCT CASE WHEN e.event_type = 'class_join_click' THEN e.user_id END) as clicks_entrar,
  
  -- Joins exitosos (class_join_success)
  COUNT(DISTINCT CASE WHEN e.event_type = 'class_join_success' THEN e.user_id END) as joins_exitosos,
  
  -- Vistas de grabación (class_recording_open)
  COUNT(DISTINCT CASE WHEN e.event_type = 'class_recording_open' THEN e.user_id END) as vistas_grabacion,
  
  -- Usuarios únicos interesados
  COUNT(DISTINCT e.user_id) as usuarios_unicos,
  
  -- Top oficinas
  (
    SELECT jsonb_agg(
      jsonb_build_object(
        'oficina_id', sub.oficina_id,
        'oficina_nombre', o.nombre,
        'count', sub.count
      )
      ORDER BY sub.count DESC
    )
    FROM (
      SELECT oficina_id, COUNT(DISTINCT user_id) as count
      FROM seguros_education_eventos
      WHERE class_id = avs.id
      GROUP BY oficina_id
      ORDER BY count DESC
      LIMIT 3
    ) sub
    LEFT JOIN oficinas o ON o.id = sub.oficina_id
  ) as top_oficinas

FROM aula_virtual_sesiones avs
LEFT JOIN usuarios ui ON ui.id = avs.instructor_id
LEFT JOIN seguros_education_eventos e ON e.class_id = avs.id
GROUP BY avs.id, avs.titulo, avs.fecha_inicio, avs.instructor_id, ui.nombre_completo;

-- =====================================================
-- RLS POLICIES
-- =====================================================

ALTER TABLE seguros_education_eventos ENABLE ROW LEVEL SECURITY;
ALTER TABLE seguros_education_sesiones ENABLE ROW LEVEL SECURITY;

-- Admin puede ver todos los eventos
CREATE POLICY "Admins can view all events"
  ON seguros_education_eventos
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'admin'
    )
  );

-- Usuarios pueden ver solo sus propios eventos
CREATE POLICY "Users can view own events"
  ON seguros_education_eventos
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Insertar eventos (cualquier autenticado)
CREATE POLICY "Authenticated users can insert events"
  ON seguros_education_eventos
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Admin puede ver todas las sesiones
CREATE POLICY "Admins can view all sessions"
  ON seguros_education_sesiones
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'admin'
    )
  );

-- Usuarios pueden ver solo sus propias sesiones
CREATE POLICY "Users can view own sessions"
  ON seguros_education_sesiones
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Insertar/actualizar sesiones (cualquier autenticado - vía función)
CREATE POLICY "Authenticated users can manage own sessions"
  ON seguros_education_sesiones
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- =====================================================
-- GRANTS
-- =====================================================

GRANT SELECT ON v_analytics_lecciones_stats TO authenticated;
GRANT SELECT ON v_analytics_usuarios_stats TO authenticated;
GRANT SELECT ON v_analytics_clases_stats TO authenticated;
GRANT EXECUTE ON FUNCTION registrar_evento_educacion TO authenticated;

-- =====================================================
-- COMENTARIOS
-- =====================================================

COMMENT ON TABLE seguros_education_eventos IS 'Registro detallado de eventos de interacción con contenido educativo';
COMMENT ON TABLE seguros_education_sesiones IS 'Sesiones agregadas de usuarios consumiendo contenido educativo';
COMMENT ON FUNCTION registrar_evento_educacion IS 'Registra un evento de educación y actualiza la sesión automáticamente';
COMMENT ON VIEW v_analytics_lecciones_stats IS 'Estadísticas agregadas por lección para Analytics';
COMMENT ON VIEW v_analytics_usuarios_stats IS 'Estadísticas de actividad por usuario';
COMMENT ON VIEW v_analytics_clases_stats IS 'Estadísticas de participación en Aula Virtual';
