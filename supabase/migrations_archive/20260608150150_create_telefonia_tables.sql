
-- ============================================================
-- TELEFONIA MODULE: Core tables for Yeastar Linkus integration
-- ============================================================

-- 1. Global telephony configuration (single-row per org)
CREATE TABLE IF NOT EXISTS telefonia_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pbx_url text NOT NULL DEFAULT '',
  pbx_username text NOT NULL DEFAULT '',
  pbx_token text NOT NULL DEFAULT '',
  api_mode text NOT NULL DEFAULT 'mock' CHECK (api_mode IN ('mock', 'live')),
  auto_sync boolean NOT NULL DEFAULT false,
  sync_interval_minutes integer NOT NULL DEFAULT 60,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE telefonia_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_telefonia_config" ON telefonia_config FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM usuarios u WHERE u.id = auth.uid() AND u.rol = 'Administrador')
  );
CREATE POLICY "insert_telefonia_config" ON telefonia_config FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM usuarios u WHERE u.id = auth.uid() AND u.rol = 'Administrador')
  );
CREATE POLICY "update_telefonia_config" ON telefonia_config FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM usuarios u WHERE u.id = auth.uid() AND u.rol = 'Administrador')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM usuarios u WHERE u.id = auth.uid() AND u.rol = 'Administrador')
  );
CREATE POLICY "delete_telefonia_config" ON telefonia_config FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM usuarios u WHERE u.id = auth.uid() AND u.rol = 'Administrador')
  );

-- 2. Per-office telephony configuration (extension ranges)
CREATE TABLE IF NOT EXISTS telefonia_oficinas_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  oficina_id uuid NOT NULL REFERENCES oficinas(id) ON DELETE CASCADE,
  rango_inicio integer NOT NULL,
  rango_fin integer NOT NULL,
  prefijo text NOT NULL DEFAULT '',
  descripcion text NOT NULL DEFAULT '',
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rango_valido CHECK (rango_inicio <= rango_fin)
);

ALTER TABLE telefonia_oficinas_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_telefonia_oficinas" ON telefonia_oficinas_config FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM usuarios u WHERE u.id = auth.uid() AND u.rol IN ('Administrador', 'Gerente'))
  );
CREATE POLICY "insert_telefonia_oficinas" ON telefonia_oficinas_config FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM usuarios u WHERE u.id = auth.uid() AND u.rol = 'Administrador')
  );
CREATE POLICY "update_telefonia_oficinas" ON telefonia_oficinas_config FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM usuarios u WHERE u.id = auth.uid() AND u.rol = 'Administrador')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM usuarios u WHERE u.id = auth.uid() AND u.rol = 'Administrador')
  );
CREATE POLICY "delete_telefonia_oficinas" ON telefonia_oficinas_config FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM usuarios u WHERE u.id = auth.uid() AND u.rol = 'Administrador')
  );

-- 3. User-extension assignments
CREATE TABLE IF NOT EXISTS telefonia_usuarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  extension text NOT NULL,
  tipo text NOT NULL DEFAULT 'sip' CHECK (tipo IN ('sip', 'iax', 'virtual')),
  estado text NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo', 'inactivo', 'suspendido')),
  yeastar_extension_id text,
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(usuario_id),
  UNIQUE(extension)
);

ALTER TABLE telefonia_usuarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_telefonia_usuarios" ON telefonia_usuarios FOR SELECT
  TO authenticated USING (
    usuario_id = auth.uid() OR
    EXISTS (SELECT 1 FROM usuarios u WHERE u.id = auth.uid() AND u.rol IN ('Administrador', 'Gerente'))
  );
CREATE POLICY "insert_telefonia_usuarios" ON telefonia_usuarios FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM usuarios u WHERE u.id = auth.uid() AND u.rol = 'Administrador')
  );
CREATE POLICY "update_telefonia_usuarios" ON telefonia_usuarios FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM usuarios u WHERE u.id = auth.uid() AND u.rol = 'Administrador')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM usuarios u WHERE u.id = auth.uid() AND u.rol = 'Administrador')
  );
CREATE POLICY "delete_telefonia_usuarios" ON telefonia_usuarios FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM usuarios u WHERE u.id = auth.uid() AND u.rol = 'Administrador')
  );

-- 4. Extension inventory/catalog
CREATE TABLE IF NOT EXISTS telefonia_extensiones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  extension text NOT NULL UNIQUE,
  oficina_id uuid REFERENCES oficinas(id) ON DELETE SET NULL,
  nombre_display text NOT NULL DEFAULT '',
  estado text NOT NULL DEFAULT 'disponible' CHECK (estado IN ('disponible', 'asignada', 'reservada', 'fuera_servicio')),
  usuario_asignado_id uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  yeastar_id text,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE telefonia_extensiones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_telefonia_extensiones" ON telefonia_extensiones FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM usuarios u WHERE u.id = auth.uid() AND u.rol IN ('Administrador', 'Gerente'))
  );
CREATE POLICY "insert_telefonia_extensiones" ON telefonia_extensiones FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM usuarios u WHERE u.id = auth.uid() AND u.rol = 'Administrador')
  );
CREATE POLICY "update_telefonia_extensiones" ON telefonia_extensiones FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM usuarios u WHERE u.id = auth.uid() AND u.rol = 'Administrador')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM usuarios u WHERE u.id = auth.uid() AND u.rol = 'Administrador')
  );
CREATE POLICY "delete_telefonia_extensiones" ON telefonia_extensiones FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM usuarios u WHERE u.id = auth.uid() AND u.rol = 'Administrador')
  );

-- 5. Sync operation logs
CREATE TABLE IF NOT EXISTS telefonia_sync_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL CHECK (tipo IN ('create', 'update', 'delete', 'bulk_sync', 'test_connection')),
  estado text NOT NULL CHECK (estado IN ('pendiente', 'en_proceso', 'completado', 'error')),
  usuario_admin_id uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  detalles jsonb NOT NULL DEFAULT '{}',
  resultado jsonb,
  error_mensaje text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

ALTER TABLE telefonia_sync_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_telefonia_sync_logs" ON telefonia_sync_logs FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM usuarios u WHERE u.id = auth.uid() AND u.rol = 'Administrador')
  );
CREATE POLICY "insert_telefonia_sync_logs" ON telefonia_sync_logs FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM usuarios u WHERE u.id = auth.uid() AND u.rol = 'Administrador')
  );
CREATE POLICY "update_telefonia_sync_logs" ON telefonia_sync_logs FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM usuarios u WHERE u.id = auth.uid() AND u.rol = 'Administrador')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM usuarios u WHERE u.id = auth.uid() AND u.rol = 'Administrador')
  );
CREATE POLICY "delete_telefonia_sync_logs" ON telefonia_sync_logs FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM usuarios u WHERE u.id = auth.uid() AND u.rol = 'Administrador')
  );

-- Indexes for performance
CREATE INDEX idx_telefonia_usuarios_extension ON telefonia_usuarios(extension);
CREATE INDEX idx_telefonia_usuarios_usuario_id ON telefonia_usuarios(usuario_id);
CREATE INDEX idx_telefonia_extensiones_oficina ON telefonia_extensiones(oficina_id);
CREATE INDEX idx_telefonia_extensiones_estado ON telefonia_extensiones(estado);
CREATE INDEX idx_telefonia_sync_logs_tipo ON telefonia_sync_logs(tipo);
CREATE INDEX idx_telefonia_sync_logs_created ON telefonia_sync_logs(created_at DESC);
CREATE INDEX idx_telefonia_oficinas_config_oficina ON telefonia_oficinas_config(oficina_id);
