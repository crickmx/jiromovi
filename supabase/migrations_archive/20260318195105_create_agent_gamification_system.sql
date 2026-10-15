/*
  # Sistema de Gamificación para Agentes

  1. New Tables
    - `agent_gamification_profile` - Perfil de gamificación de cada agente
    - `agent_gamification_events` - Registro auditable de todos los eventos XP/JC
    - `agent_levels` - Configuración de niveles y rangos
    - `agent_missions` - Definición de misiones disponibles
    - `agent_mission_progress` - Progreso de misiones por agente
    - `agent_xp_multipliers` - Multiplicadores configurables por ramo/evento

  2. Security
    - Enable RLS on all tables
    - Agents can view their own profile and events
    - Admins can manage everything
    - System can write events via service role

  3. Business Rules
    - XP is cumulative and irreversible (except cancellations)
    - Jiro Coins can be spent and expire
    - Events are auditable and traceable
    - Automatic level calculation
*/

-- =====================================================
-- ENUMS
-- =====================================================

CREATE TYPE gamification_event_type AS ENUM (
  'poliza_emitida',
  'prospecto',
  'curso_completado',
  'certificacion',
  'resena',
  'renovacion',
  'bono_antiguedad',
  'mision_completada',
  'ajuste_manual',
  'cancelacion',
  'compra_tienda',
  'expiracion_jc'
);

CREATE TYPE mission_period_type AS ENUM (
  'semanal',
  'mensual',
  'unica',
  'permanente'
);

-- =====================================================
-- NIVELES Y RANGOS
-- =====================================================

CREATE TABLE IF NOT EXISTS agent_levels (
  nivel INTEGER PRIMARY KEY,
  xp_min INTEGER NOT NULL,
  xp_max INTEGER,
  rango TEXT NOT NULL,
  descripcion TEXT,
  icono TEXT,
  color TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE agent_levels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view levels"
  ON agent_levels FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins manage levels"
  ON agent_levels FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid() AND rol = 'Administrador'
    )
  );

-- =====================================================
-- PERFILES DE GAMIFICACIÓN
-- =====================================================

CREATE TABLE IF NOT EXISTS agent_gamification_profile (
  user_id UUID PRIMARY KEY REFERENCES usuarios(id) ON DELETE CASCADE,
  xp_total INTEGER DEFAULT 0 NOT NULL,
  jiro_coins_balance INTEGER DEFAULT 0 NOT NULL,
  nivel_actual INTEGER DEFAULT 1 NOT NULL,
  rango_actual TEXT DEFAULT 'Agente Base' NOT NULL,
  anios_antiguedad NUMERIC(4,2) DEFAULT 0 NOT NULL,
  multiplicador_veterano NUMERIC(4,3) DEFAULT 1.000 NOT NULL,
  fecha_ingreso_empresa DATE,
  ultima_actualizacion_antiguedad DATE,
  total_polizas_emitidas INTEGER DEFAULT 0,
  total_prospectos INTEGER DEFAULT 0,
  total_cursos_completados INTEGER DEFAULT 0,
  total_certificaciones INTEGER DEFAULT 0,
  total_renovaciones INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE agent_gamification_profile ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agents view own profile"
  ON agent_gamification_profile FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid() AND rol IN ('Administrador', 'Gerente')
    )
  );

CREATE POLICY "Service role manages profiles"
  ON agent_gamification_profile FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Admins manage profiles"
  ON agent_gamification_profile FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid() AND rol = 'Administrador'
    )
  );

-- =====================================================
-- EVENTOS DE GAMIFICACIÓN
-- =====================================================

CREATE TABLE IF NOT EXISTS agent_gamification_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  tipo_evento gamification_event_type NOT NULL,
  referencia_tipo TEXT,
  referencia_id TEXT,
  xp_delta INTEGER DEFAULT 0 NOT NULL,
  jc_delta INTEGER DEFAULT 0 NOT NULL,
  xp_antes INTEGER NOT NULL,
  xp_despues INTEGER NOT NULL,
  jc_antes INTEGER NOT NULL,
  jc_despues INTEGER NOT NULL,
  fecha_evento TIMESTAMPTZ DEFAULT now() NOT NULL,
  fecha_expiracion_jc TIMESTAMPTZ,
  reversible BOOLEAN DEFAULT true,
  reversed_by_event_id UUID REFERENCES agent_gamification_events(id),
  is_reversal BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_by UUID REFERENCES usuarios(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE agent_gamification_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agents view own events"
  ON agent_gamification_events FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid() AND rol IN ('Administrador', 'Gerente')
    )
  );

CREATE POLICY "Service role manages events"
  ON agent_gamification_events FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Admins manage events"
  ON agent_gamification_events FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid() AND rol = 'Administrador'
    )
  );

-- =====================================================
-- MULTIPLICADORES
-- =====================================================

CREATE TABLE IF NOT EXISTS agent_xp_multipliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo TEXT NOT NULL CHECK (tipo IN ('ramo', 'evento', 'aseguradora', 'global')),
  referencia TEXT,
  factor NUMERIC(4,2) NOT NULL DEFAULT 1.00,
  descripcion TEXT,
  fecha_inicio DATE,
  fecha_fin DATE,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE agent_xp_multipliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view active multipliers"
  ON agent_xp_multipliers FOR SELECT
  TO authenticated
  USING (activo = true);

CREATE POLICY "Admins manage multipliers"
  ON agent_xp_multipliers FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid() AND rol = 'Administrador'
    )
  );

-- =====================================================
-- MISIONES
-- =====================================================

CREATE TABLE IF NOT EXISTS agent_missions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  descripcion TEXT,
  tipo_periodo mission_period_type NOT NULL DEFAULT 'mensual',
  regla_json JSONB NOT NULL,
  xp_reward INTEGER DEFAULT 0,
  jc_reward INTEGER DEFAULT 0,
  icono TEXT,
  color TEXT,
  orden INTEGER DEFAULT 0,
  activa BOOLEAN DEFAULT true,
  fecha_inicio DATE,
  fecha_fin DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE agent_missions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view active missions"
  ON agent_missions FOR SELECT
  TO authenticated
  USING (activa = true);

CREATE POLICY "Admins manage missions"
  ON agent_missions FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid() AND rol = 'Administrador'
    )
  );

-- =====================================================
-- PROGRESO DE MISIONES
-- =====================================================

CREATE TABLE IF NOT EXISTS agent_mission_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  mission_id UUID NOT NULL REFERENCES agent_missions(id) ON DELETE CASCADE,
  periodo TEXT NOT NULL,
  progreso_actual INTEGER DEFAULT 0,
  meta_requerida INTEGER NOT NULL,
  completada BOOLEAN DEFAULT false,
  fecha_completada TIMESTAMPTZ,
  recompensa_reclamada BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, mission_id, periodo)
);

ALTER TABLE agent_mission_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agents view own mission progress"
  ON agent_mission_progress FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid() AND rol IN ('Administrador', 'Gerente')
    )
  );

CREATE POLICY "Service role manages mission progress"
  ON agent_mission_progress FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- ÍNDICES
-- =====================================================

CREATE INDEX idx_gamification_events_user ON agent_gamification_events(user_id, fecha_evento DESC);
CREATE INDEX idx_gamification_events_tipo ON agent_gamification_events(tipo_evento);
CREATE INDEX idx_gamification_events_referencia ON agent_gamification_events(referencia_tipo, referencia_id);
CREATE INDEX idx_gamification_events_expiracion ON agent_gamification_events(fecha_expiracion_jc) WHERE fecha_expiracion_jc IS NOT NULL;
CREATE INDEX idx_mission_progress_user ON agent_mission_progress(user_id, completada);
CREATE INDEX idx_mission_progress_periodo ON agent_mission_progress(periodo, completada);

-- =====================================================
-- DATOS INICIALES: NIVELES
-- =====================================================

INSERT INTO agent_levels (nivel, xp_min, xp_max, rango, descripcion, icono, color) VALUES
  (1, 0, 999, 'Agente Base', 'Comenzando tu carrera en MOVI', 'Shield', '#94a3b8'),
  (2, 1000, 2499, 'Agente Base', 'Ganando experiencia', 'Shield', '#94a3b8'),
  (3, 2500, 4999, 'Agente Base', 'Consolidando conocimientos', 'Shield', '#94a3b8'),
  (4, 5000, 7999, 'Agente Élite', 'Entrando a la élite', 'Award', '#3b82f6'),
  (5, 8000, 11999, 'Agente Élite', 'Destacando en ventas', 'Award', '#3b82f6'),
  (6, 12000, 16999, 'Agente Élite', 'Experto en seguros', 'Award', '#3b82f6'),
  (7, 17000, 19999, 'Agente Élite', 'Top performer', 'Award', '#3b82f6'),
  (8, 20000, 29999, 'Maestro Élite', 'Maestro del negocio', 'Crown', '#8b5cf6'),
  (9, 30000, 39999, 'Maestro Élite', 'Referente de excelencia', 'Crown', '#8b5cf6'),
  (10, 40000, 49999, 'Maestro Élite', 'Líder indiscutible', 'Crown', '#8b5cf6'),
  (11, 50000, 74999, 'Leyenda Jiro', 'Leyenda viviente', 'Trophy', '#eab308'),
  (12, 75000, 99999, 'Leyenda Jiro', 'Leyenda definitiva', 'Trophy', '#eab308'),
  (13, 100000, NULL, 'Leyenda Jiro', 'Máximo nivel alcanzado', 'Trophy', '#eab308')
ON CONFLICT (nivel) DO NOTHING;

-- =====================================================
-- DATOS INICIALES: MISIONES PREDETERMINADAS
-- =====================================================

INSERT INTO agent_missions (nombre, descripcion, tipo_periodo, regla_json, xp_reward, jc_reward, icono, color) VALUES
  (
    'Racha Imparable',
    'Emite 5 pólizas en una semana',
    'semanal',
    '{"tipo": "polizas_emitidas", "cantidad": 5, "periodo_dias": 7}',
    500,
    200,
    'Zap',
    '#ef4444'
  ),
  (
    'Estudiante Élite',
    'Completa 3 cursos en el mes',
    'mensual',
    '{"tipo": "cursos_completados", "cantidad": 3}',
    300,
    100,
    'GraduationCap',
    '#3b82f6'
  ),
  (
    'Venta Millonaria',
    'Alcanza $200,000 en ventas del mes',
    'mensual',
    '{"tipo": "prima_neta_total", "minimo": 200000}',
    1000,
    500,
    'TrendingUp',
    '#10b981'
  ),
  (
    'Maestro de Renovaciones',
    'Renueva 10 pólizas en el mes',
    'mensual',
    '{"tipo": "renovaciones", "cantidad": 10}',
    600,
    300,
    'RefreshCw',
    '#8b5cf6'
  ),
  (
    'Prospector Experto',
    'Registra 20 prospectos válidos en el mes',
    'mensual',
    '{"tipo": "prospectos", "cantidad": 20}',
    400,
    150,
    'Users',
    '#f59e0b'
  )
ON CONFLICT DO NOTHING;
