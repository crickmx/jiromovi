-- Table: notificaciones_internas (for notifications widget)
CREATE TABLE IF NOT EXISTS notificaciones_internas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  titulo text NOT NULL,
  mensaje text,
  tipo text DEFAULT 'info',
  leido boolean DEFAULT false,
  referencia_tipo text,
  referencia_id uuid,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_notificaciones_usuario_leido ON notificaciones_internas(usuario_id, leido);

ALTER TABLE notificaciones_internas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own_notificaciones" ON notificaciones_internas FOR SELECT
  TO authenticated USING (auth.uid() = usuario_id);
CREATE POLICY "insert_notificaciones" ON notificaciones_internas FOR INSERT
  TO authenticated WITH CHECK (true);
CREATE POLICY "update_own_notificaciones" ON notificaciones_internas FOR UPDATE
  TO authenticated USING (auth.uid() = usuario_id) WITH CHECK (auth.uid() = usuario_id);
CREATE POLICY "delete_own_notificaciones" ON notificaciones_internas FOR DELETE
  TO authenticated USING (auth.uid() = usuario_id);

-- Table: comunicados (for communications widget)
CREATE TABLE IF NOT EXISTS comunicados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  contenido text,
  tipo text DEFAULT 'general',
  activo boolean DEFAULT true,
  publicado_por uuid REFERENCES usuarios(id),
  oficina_id uuid,
  dirigido_a text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_comunicados_activo ON comunicados(activo, created_at DESC);

ALTER TABLE comunicados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_comunicados" ON comunicados FOR SELECT
  TO authenticated USING (activo = true);
CREATE POLICY "insert_comunicados" ON comunicados FOR INSERT
  TO authenticated WITH CHECK (true);
CREATE POLICY "update_comunicados" ON comunicados FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_comunicados" ON comunicados FOR DELETE
  TO authenticated USING (true);

-- Table: agente_gamification_profiles (for gamification widget)
CREATE TABLE IF NOT EXISTS agente_gamification_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL UNIQUE REFERENCES usuarios(id) ON DELETE CASCADE,
  total_points int DEFAULT 0,
  current_level int DEFAULT 1,
  current_level_name text DEFAULT 'Novato',
  rank_in_office int,
  badges jsonb DEFAULT '[]',
  streak_days int DEFAULT 0,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE agente_gamification_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own_gamification" ON agente_gamification_profiles FOR SELECT
  TO authenticated USING (auth.uid() = usuario_id);
CREATE POLICY "insert_own_gamification" ON agente_gamification_profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = usuario_id);
CREATE POLICY "update_own_gamification" ON agente_gamification_profiles FOR UPDATE
  TO authenticated USING (auth.uid() = usuario_id) WITH CHECK (auth.uid() = usuario_id);
CREATE POLICY "delete_own_gamification" ON agente_gamification_profiles FOR DELETE
  TO authenticated USING (auth.uid() = usuario_id);