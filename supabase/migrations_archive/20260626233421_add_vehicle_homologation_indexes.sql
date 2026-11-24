-- Add indexes for fast vehicle lookup by attributes used in quoting
CREATE INDEX IF NOT EXISTS idx_catalogo_vehiculos_marca_modelo_anio 
  ON multi_autos_catalogo_vehiculos (marca, modelo, anio);

CREATE INDEX IF NOT EXISTS idx_catalogo_vehiculos_descripcion 
  ON multi_autos_catalogo_vehiculos (descripcion_completa);

CREATE INDEX IF NOT EXISTS idx_catalogo_vehiculos_clave_amis 
  ON multi_autos_catalogo_vehiculos (clave_amis);

-- Add insurer connection status tracking table
CREATE TABLE IF NOT EXISTS multi_autos_insurer_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  insurer_name text NOT NULL UNIQUE,
  last_success_at timestamptz,
  last_failure_at timestamptz,
  last_error text,
  consecutive_failures integer DEFAULT 0,
  credential_status text DEFAULT 'unknown' CHECK (credential_status IN ('valid', 'invalid', 'expired', 'unknown', 'missing')),
  endpoint_reachable boolean DEFAULT true,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE multi_autos_insurer_status ENABLE ROW LEVEL SECURITY;

-- Allow anon and authenticated to read status (dashboard display)
CREATE POLICY "select_insurer_status" ON multi_autos_insurer_status FOR SELECT
  TO anon, authenticated USING (true);

-- Only service role can update (edge function uses service role key)
CREATE POLICY "insert_insurer_status" ON multi_autos_insurer_status FOR INSERT
  TO anon, authenticated WITH CHECK (true);

CREATE POLICY "update_insurer_status" ON multi_autos_insurer_status FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "delete_insurer_status" ON multi_autos_insurer_status FOR DELETE
  TO anon, authenticated USING (true);

-- Seed initial status rows for all insurers
INSERT INTO multi_autos_insurer_status (insurer_name, credential_status, endpoint_reachable)
VALUES
  ('Qualitas', 'unknown', true),
  ('GNP', 'missing', true),
  ('ANA Seguros', 'missing', true),
  ('HDI Seguros', 'expired', true),
  ('Zurich', 'unknown', false),
  ('Chubb', 'unknown', false),
  ('Potosi', 'unknown', false)
ON CONFLICT (insurer_name) DO NOTHING;

-- Expand metadata_aseguradoras comment for clarity
COMMENT ON COLUMN multi_autos_catalogo_vehiculos.metadata_aseguradoras IS 'JSONB with insurer-specific vehicle codes. Keys: armadora_gnp, carroceria_gnp, version_gnp, clave_hdi, clave_zurich, clave_chubb, clave_ana';