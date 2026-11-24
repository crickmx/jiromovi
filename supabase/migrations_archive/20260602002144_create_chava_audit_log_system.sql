/*
  # Chava AI Audit Log System

  ## Purpose
  Full traceability for all Chava AI queries — logs every request, tool call, error,
  and response with timing and user context. Visible in Admin → Chava IA → Auditoría.

  ## New Tables
  - `chava_audit_log` — Per-query log with reference ID, tool calls, errors, stack traces
  - `chava_tool_health` — Latest health status per tool (buscar_cliente, buscar_poliza, etc.)

  ## Security
  - RLS enabled on both tables
  - Admin: full read access
  - Users: read only their own logs
  - Service role: full insert access (for edge function logging)
*/

-- ── Audit log ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chava_audit_log (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ref_id        text NOT NULL,                     -- CHAVA-XXXXXXXX display reference
  usuario_id    uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  conversacion_id uuid,
  modulo        text DEFAULT 'chava',
  ruta          text,
  pregunta      text,
  respuesta     text,
  -- Tool execution
  herramientas_llamadas jsonb DEFAULT '[]',        -- [{tool, input, output, duration_ms, error}]
  fuentes_utilizadas    jsonb DEFAULT '[]',
  -- Performance
  tiempo_respuesta_ms   int DEFAULT 0,
  tokens_entrada        int DEFAULT 0,
  tokens_salida         int DEFAULT 0,
  modelo                text,
  -- Error tracking
  tuvo_error    boolean DEFAULT false,
  error_mensaje text,
  error_stack   text,
  error_tipo    text,                              -- 'network', 'openai', 'db', 'auth', 'timeout'
  -- User context
  rol_usuario   text,
  oficina_id    uuid,
  -- Metadata
  ip_origen     text,
  user_agent    text,
  created_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chava_audit_log_usuario_id ON chava_audit_log(usuario_id);
CREATE INDEX IF NOT EXISTS idx_chava_audit_log_created_at ON chava_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chava_audit_log_tuvo_error ON chava_audit_log(tuvo_error) WHERE tuvo_error = true;
CREATE INDEX IF NOT EXISTS idx_chava_audit_log_ref_id ON chava_audit_log(ref_id);

ALTER TABLE chava_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read all chava audit logs"
  ON chava_audit_log FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND u.rol = 'Administrador'
    )
  );

CREATE POLICY "Users can read own chava audit logs"
  ON chava_audit_log FOR SELECT
  TO authenticated
  USING (usuario_id = auth.uid());

CREATE POLICY "Service role can insert chava audit logs"
  ON chava_audit_log FOR INSERT
  TO service_role
  WITH CHECK (true);

-- ── Tool health cache ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chava_tool_health (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  herramienta   text UNIQUE NOT NULL,              -- buscar_cliente, buscar_poliza, etc.
  estado        text DEFAULT 'unknown',            -- ok, error, degraded, unknown
  ultimo_ok_at  timestamptz,
  ultimo_error_at timestamptz,
  ultimo_error  text,
  tiempo_respuesta_ms int,
  registros_encontrados int,
  updated_at    timestamptz DEFAULT now()
);

ALTER TABLE chava_tool_health ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage tool health"
  ON chava_tool_health FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND u.rol IN ('Administrador', 'Gerente')
    )
  );

CREATE POLICY "Service role can upsert tool health"
  ON chava_tool_health FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ── Seed tool health rows ─────────────────────────────────────────────────────
INSERT INTO chava_tool_health (herramienta, estado) VALUES
  ('buscar_cliente', 'unknown'),
  ('buscar_poliza', 'unknown'),
  ('buscar_contacto', 'unknown'),
  ('buscar_usuario', 'unknown'),
  ('buscar_oficina', 'unknown'),
  ('consultar_sicas', 'unknown'),
  ('consultar_produccion', 'unknown'),
  ('consultar_tramites', 'unknown'),
  ('consultar_comisiones', 'unknown')
ON CONFLICT (herramienta) DO NOTHING;
