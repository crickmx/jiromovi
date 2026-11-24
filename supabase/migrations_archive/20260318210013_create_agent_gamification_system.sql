/*
  # Sistema de Gamificación para Agentes
  
  1. Nuevas Tablas
    - `agent_gamification_profile`: Perfil de gamificación de cada agente
    - `agent_gamification_events`: Log auditable de todos los eventos
    - `agent_levels`: Configuración de niveles y rangos
    - `agent_missions`: Catálogo de misiones
    - `agent_mission_progress`: Progreso individual de misiones
    - `agent_xp_multipliers`: Multiplicadores configurables
  
  2. Seguridad
    - RLS habilitado en todas las tablas
    - Agentes pueden ver su propio perfil
    - Admin puede ver todo y configurar
    - Gerentes pueden ver rankings de su oficina
*/

-- Tipos ENUM
DO $$ BEGIN
  CREATE TYPE tipo_evento_gamificacion AS ENUM (
    'poliza_emitida',
    'prospecto',
    'curso_completado',
    'certificacion_aprobada',
    'resena_5_estrellas',
    'renovacion',
    'bono_antiguedad',
    'mision_completada',
    'ajuste_manual',
    'cancelacion_poliza',
    'expiracion_jc'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE tipo_periodo_mision AS ENUM (
    'semanal',
    'mensual',
    'unica'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE tipo_multiplicador AS ENUM (
    'ramo',
    'evento'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Tabla: agent_levels (configuración de niveles)
CREATE TABLE IF NOT EXISTS agent_levels (
  nivel int PRIMARY KEY,
  xp_min bigint NOT NULL,
  xp_max bigint NOT NULL,
  rango text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE agent_levels ENABLE ROW LEVEL SECURITY;

-- Tabla: agent_gamification_profile
CREATE TABLE IF NOT EXISTS agent_gamification_profile (
  user_id uuid PRIMARY KEY REFERENCES usuarios(id) ON DELETE CASCADE,
  xp_total bigint NOT NULL DEFAULT 0,
  jiro_coins_balance bigint NOT NULL DEFAULT 0,
  nivel_actual int NOT NULL DEFAULT 1,
  rango_actual text NOT NULL DEFAULT 'Agente Base',
  anios_antiguedad numeric(5,2) NOT NULL DEFAULT 0,
  multiplicador_veterano numeric(5,2) NOT NULL DEFAULT 1.0,
  fecha_ingreso_empresa date NOT NULL DEFAULT CURRENT_DATE,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE agent_gamification_profile ENABLE ROW LEVEL SECURITY;

-- Tabla: agent_gamification_events
CREATE TABLE IF NOT EXISTS agent_gamification_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  tipo_evento tipo_evento_gamificacion NOT NULL,
  referencia_tipo text,
  referencia_id uuid,
  xp_delta int NOT NULL DEFAULT 0,
  jc_delta int NOT NULL DEFAULT 0,
  fecha_evento timestamptz NOT NULL DEFAULT now(),
  fecha_expiracion_jc timestamptz,
  reversible boolean NOT NULL DEFAULT false,
  reversed_by_event_id uuid REFERENCES agent_gamification_events(id),
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE agent_gamification_events ENABLE ROW LEVEL SECURITY;

-- Tabla: agent_missions
CREATE TABLE IF NOT EXISTS agent_missions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  descripcion text,
  tipo_periodo tipo_periodo_mision NOT NULL,
  regla_json jsonb NOT NULL,
  xp_reward int NOT NULL DEFAULT 0,
  jc_reward int NOT NULL DEFAULT 0,
  activa boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE agent_missions ENABLE ROW LEVEL SECURITY;

-- Tabla: agent_mission_progress
CREATE TABLE IF NOT EXISTS agent_mission_progress (
  user_id uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  mission_id uuid NOT NULL REFERENCES agent_missions(id) ON DELETE CASCADE,
  periodo text NOT NULL,
  progreso_actual int NOT NULL DEFAULT 0,
  completada boolean NOT NULL DEFAULT false,
  fecha_completada timestamptz,
  updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, mission_id, periodo)
);

ALTER TABLE agent_mission_progress ENABLE ROW LEVEL SECURITY;

-- Tabla: agent_xp_multipliers
CREATE TABLE IF NOT EXISTS agent_xp_multipliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo tipo_multiplicador NOT NULL,
  referencia text NOT NULL,
  factor numeric(5,2) NOT NULL DEFAULT 1.0,
  fecha_inicio date NOT NULL DEFAULT CURRENT_DATE,
  fecha_fin date,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE agent_xp_multipliers ENABLE ROW LEVEL SECURITY;

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_gamification_events_user_id ON agent_gamification_events(user_id);
CREATE INDEX IF NOT EXISTS idx_gamification_events_fecha ON agent_gamification_events(fecha_evento DESC);
CREATE INDEX IF NOT EXISTS idx_gamification_events_tipo ON agent_gamification_events(tipo_evento);
CREATE INDEX IF NOT EXISTS idx_gamification_events_expiracion ON agent_gamification_events(fecha_expiracion_jc) WHERE fecha_expiracion_jc IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_mission_progress_user ON agent_mission_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_mission_progress_periodo ON agent_mission_progress(periodo);
CREATE INDEX IF NOT EXISTS idx_xp_multipliers_activo ON agent_xp_multipliers(activo, fecha_inicio, fecha_fin) WHERE activo = true;

-- Cargar niveles y rangos por defecto
INSERT INTO agent_levels (nivel, xp_min, xp_max, rango) VALUES
  (1, 0, 999, 'Agente Base'),
  (2, 1000, 2499, 'Agente Base'),
  (3, 2500, 4999, 'Agente Base'),
  (4, 5000, 7499, 'Agente Élite'),
  (5, 7500, 9999, 'Agente Élite'),
  (6, 10000, 12499, 'Agente Élite'),
  (7, 12500, 14999, 'Agente Élite'),
  (8, 15000, 17499, 'Agente Élite'),
  (9, 17500, 19999, 'Agente Élite'),
  (10, 20000, 24999, 'Maestro Élite'),
  (11, 25000, 29999, 'Maestro Élite'),
  (12, 30000, 34999, 'Maestro Élite'),
  (13, 35000, 39999, 'Maestro Élite'),
  (14, 40000, 44999, 'Maestro Élite'),
  (15, 45000, 49999, 'Maestro Élite'),
  (16, 50000, 59999, 'Leyenda Jiro'),
  (17, 60000, 69999, 'Leyenda Jiro'),
  (18, 70000, 79999, 'Leyenda Jiro'),
  (19, 80000, 99999, 'Leyenda Jiro'),
  (20, 100000, 999999999, 'Leyenda Jiro')
ON CONFLICT (nivel) DO NOTHING;

-- Políticas RLS

-- agent_levels: lectura pública para usuarios autenticados
CREATE POLICY "Usuarios autenticados pueden ver niveles"
  ON agent_levels FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Solo admin puede gestionar niveles"
  ON agent_levels FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'admin'
  ));

-- agent_gamification_profile: agentes ven su perfil, admin ve todo
CREATE POLICY "Agentes pueden ver su propio perfil"
  ON agent_gamification_profile FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() 
    OR EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol IN ('admin', 'gerente'))
  );

CREATE POLICY "Solo admin puede modificar perfiles"
  ON agent_gamification_profile FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'admin'
  ));

-- agent_gamification_events: agentes ven sus eventos, admin ve todo
CREATE POLICY "Agentes pueden ver sus eventos"
  ON agent_gamification_events FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol IN ('admin', 'gerente'))
  );

CREATE POLICY "Sistema puede insertar eventos"
  ON agent_gamification_events FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Solo admin puede modificar eventos"
  ON agent_gamification_events FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'admin'
  ));

-- agent_missions: todos pueden ver misiones activas
CREATE POLICY "Usuarios pueden ver misiones activas"
  ON agent_missions FOR SELECT
  TO authenticated
  USING (activa = true OR EXISTS (
    SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'admin'
  ));

CREATE POLICY "Solo admin puede gestionar misiones"
  ON agent_missions FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'admin'
  ));

-- agent_mission_progress: agentes ven su progreso
CREATE POLICY "Agentes pueden ver su progreso"
  ON agent_mission_progress FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol IN ('admin', 'gerente'))
  );

CREATE POLICY "Sistema puede actualizar progreso"
  ON agent_mission_progress FOR ALL
  TO authenticated
  USING (true);

-- agent_xp_multipliers: lectura pública, escritura admin
CREATE POLICY "Usuarios pueden ver multiplicadores activos"
  ON agent_xp_multipliers FOR SELECT
  TO authenticated
  USING (activo = true OR EXISTS (
    SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'admin'
  ));

CREATE POLICY "Solo admin puede gestionar multiplicadores"
  ON agent_xp_multipliers FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'admin'
  ));