/*
  # Módulo SICAS - Sistema de Integración con SICAS Online

  1. Tablas Principales
    - `sicas_config` - Configuración y estado de conexión
    - `sicas_despachos` - Catálogo de Despachos desde SICAS
    - `sicas_vendedores` - Catálogo de Vendedores desde SICAS
    - `sicas_mapeo_despacho_oficina` - Mapeo Despacho SICAS ↔ Oficina MOVI
    - `sicas_mapeo_vendedor_usuario` - Mapeo Vendedor SICAS ↔ Usuario MOVI

  2. Seguridad
    - RLS habilitado en todas las tablas
    - Solo Administradores pueden acceder
    - Service role puede acceder desde Edge Functions

  3. Notas
    - Almacena datos raw (JSONB) para flexibilidad
    - Parseo inteligente de respuestas SOAP
    - Sistema de logs para auditoría
*/

-- Tabla de configuración
CREATE TABLE IF NOT EXISTS sicas_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint text NOT NULL DEFAULT 'https://www.sicasonline.com.mx/SICASOnline/WS_SICASOnline.asmx',
  last_test_at timestamptz,
  last_test_success boolean,
  last_test_message text,
  last_sync_despachos_at timestamptz,
  last_sync_vendedores_at timestamptz,
  sync_logs jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Catálogo de Despachos
CREATE TABLE IF NOT EXISTS sicas_despachos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  id_sicas text UNIQUE NOT NULL,
  nombre text NOT NULL,
  raw jsonb NOT NULL,
  is_mapped boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Catálogo de Vendedores
CREATE TABLE IF NOT EXISTS sicas_vendedores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  id_sicas text UNIQUE NOT NULL,
  nombre text NOT NULL,
  raw jsonb NOT NULL,
  is_mapped boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Mapeo Despacho ↔ Oficina
CREATE TABLE IF NOT EXISTS sicas_mapeo_despacho_oficina (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  id_sicas_despacho text UNIQUE NOT NULL REFERENCES sicas_despachos(id_sicas) ON DELETE CASCADE,
  movi_oficina_id uuid NOT NULL REFERENCES oficinas(id) ON DELETE CASCADE,
  mapped_by uuid REFERENCES usuarios(id),
  mapped_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Mapeo Vendedor ↔ Usuario
CREATE TABLE IF NOT EXISTS sicas_mapeo_vendedor_usuario (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  id_sicas_vendedor text UNIQUE NOT NULL REFERENCES sicas_vendedores(id_sicas) ON DELETE CASCADE,
  movi_user_id uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  mapped_by uuid REFERENCES usuarios(id),
  mapped_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_sicas_despachos_id_sicas ON sicas_despachos(id_sicas);
CREATE INDEX IF NOT EXISTS idx_sicas_despachos_is_mapped ON sicas_despachos(is_mapped);
CREATE INDEX IF NOT EXISTS idx_sicas_vendedores_id_sicas ON sicas_vendedores(id_sicas);
CREATE INDEX IF NOT EXISTS idx_sicas_vendedores_is_mapped ON sicas_vendedores(is_mapped);
CREATE INDEX IF NOT EXISTS idx_sicas_mapeo_despacho_oficina ON sicas_mapeo_despacho_oficina(movi_oficina_id);
CREATE INDEX IF NOT EXISTS idx_sicas_mapeo_vendedor_usuario ON sicas_mapeo_vendedor_usuario(movi_user_id);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_sicas_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sicas_config_updated_at
  BEFORE UPDATE ON sicas_config
  FOR EACH ROW EXECUTE FUNCTION update_sicas_updated_at();

CREATE TRIGGER sicas_despachos_updated_at
  BEFORE UPDATE ON sicas_despachos
  FOR EACH ROW EXECUTE FUNCTION update_sicas_updated_at();

CREATE TRIGGER sicas_vendedores_updated_at
  BEFORE UPDATE ON sicas_vendedores
  FOR EACH ROW EXECUTE FUNCTION update_sicas_updated_at();

-- Trigger para actualizar is_mapped cuando se crea/elimina mapeo
CREATE OR REPLACE FUNCTION update_despacho_mapped_status()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE sicas_despachos
    SET is_mapped = true
    WHERE id_sicas = NEW.id_sicas_despacho;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE sicas_despachos
    SET is_mapped = false
    WHERE id_sicas = OLD.id_sicas_despacho;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER despacho_mapping_status
  AFTER INSERT OR DELETE ON sicas_mapeo_despacho_oficina
  FOR EACH ROW EXECUTE FUNCTION update_despacho_mapped_status();

CREATE OR REPLACE FUNCTION update_vendedor_mapped_status()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE sicas_vendedores
    SET is_mapped = true
    WHERE id_sicas = NEW.id_sicas_vendedor;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE sicas_vendedores
    SET is_mapped = false
    WHERE id_sicas = OLD.id_sicas_vendedor;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER vendedor_mapping_status
  AFTER INSERT OR DELETE ON sicas_mapeo_vendedor_usuario
  FOR EACH ROW EXECUTE FUNCTION update_vendedor_mapped_status();

-- RLS Policies (Solo Administradores)
ALTER TABLE sicas_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE sicas_despachos ENABLE ROW LEVEL SECURITY;
ALTER TABLE sicas_vendedores ENABLE ROW LEVEL SECURITY;
ALTER TABLE sicas_mapeo_despacho_oficina ENABLE ROW LEVEL SECURITY;
ALTER TABLE sicas_mapeo_vendedor_usuario ENABLE ROW LEVEL SECURITY;

-- Políticas para Administradores
CREATE POLICY "Admins can manage sicas_config"
  ON sicas_config FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

CREATE POLICY "Admins can view sicas_despachos"
  ON sicas_despachos FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

CREATE POLICY "Admins can view sicas_vendedores"
  ON sicas_vendedores FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

CREATE POLICY "Admins can manage despacho mappings"
  ON sicas_mapeo_despacho_oficina FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

CREATE POLICY "Admins can manage vendedor mappings"
  ON sicas_mapeo_vendedor_usuario FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

-- Service role puede hacer todo (para Edge Functions)
CREATE POLICY "Service role can manage all sicas tables"
  ON sicas_config FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can manage sicas_despachos"
  ON sicas_despachos FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can manage sicas_vendedores"
  ON sicas_vendedores FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can manage despacho mappings"
  ON sicas_mapeo_despacho_oficina FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can manage vendedor mappings"
  ON sicas_mapeo_vendedor_usuario FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Insertar configuración inicial
INSERT INTO sicas_config (endpoint)
VALUES ('https://www.sicasonline.com.mx/SICASOnline/WS_SICASOnline.asmx')
ON CONFLICT DO NOTHING;