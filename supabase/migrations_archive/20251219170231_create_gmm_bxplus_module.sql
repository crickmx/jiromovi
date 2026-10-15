/*
  # Módulo GMM BX+ - Cotizador de Seguros

  1. Tablas
    - tariff_packages: Paquetes de tarifas (versiones)
    - tariff_tables: Tablas de factores y coeficientes
    - gmm_quotes: Cotizaciones guardadas
    - gmm_quote_insureds: Asegurados por cotización

  2. Seguridad
    - RLS habilitado en todas las tablas
    - Admin puede gestionar tarifas
    - Usuarios pueden crear y ver sus cotizaciones

  3. Storage
    - Bucket para archivos Excel
    - Bucket para PDFs generados
*/

-- ============================================
-- TABLA: tariff_packages
-- ============================================

CREATE TABLE IF NOT EXISTS tariff_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  source_filename text NOT NULL,
  source_hash text NOT NULL,
  source_url text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived', 'failed')),
  validation_errors jsonb,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  activated_at timestamptz,
  activated_by uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  notes text
);

ALTER TABLE tariff_packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage tariff packages"
  ON tariff_packages FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'admin'
    )
  );

CREATE POLICY "Users can view active tariff packages"
  ON tariff_packages FOR SELECT
  TO authenticated
  USING (status = 'active');

-- ============================================
-- TABLA: tariff_tables
-- ============================================

CREATE TABLE IF NOT EXISTS tariff_tables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tariff_package_id uuid NOT NULL REFERENCES tariff_packages(id) ON DELETE CASCADE,
  table_key text NOT NULL,
  data_json jsonb NOT NULL,
  row_count int,
  created_at timestamptz DEFAULT now(),
  UNIQUE(tariff_package_id, table_key)
);

CREATE INDEX idx_tariff_tables_package ON tariff_tables(tariff_package_id);
CREATE INDEX idx_tariff_tables_key ON tariff_tables(table_key);

ALTER TABLE tariff_tables ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage tariff tables"
  ON tariff_tables FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'admin'
    )
  );

CREATE POLICY "Users can view active tariff tables"
  ON tariff_tables FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tariff_packages
      WHERE tariff_packages.id = tariff_tables.tariff_package_id
      AND tariff_packages.status = 'active'
    )
  );

-- ============================================
-- TABLA: gmm_quotes
-- ============================================

CREATE TABLE IF NOT EXISTS gmm_quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tariff_package_id uuid NOT NULL REFERENCES tariff_packages(id) ON DELETE RESTRICT,
  quote_number text,

  -- Parámetros del plan
  zona text NOT NULL,
  estado text NOT NULL,
  nivel_hospitalario text NOT NULL,
  tabulador text NOT NULL,
  suma_asegurada text NOT NULL,
  deducible text NOT NULL,
  coaseguro text NOT NULL,
  tope_coaseguro numeric(12,2),
  forma_pago text NOT NULL,
  num_recibos int NOT NULL,

  -- Coberturas activadas (checkboxes)
  cob_reconocimiento_antiguedad boolean DEFAULT false,
  cob_medicamentos_fuera boolean DEFAULT false,
  cob_complicaciones_no_amparadas boolean DEFAULT false,
  cob_padecimientos_preexistentes boolean DEFAULT false,
  cob_eliminacion_deducible_accidente boolean DEFAULT false,
  cob_multiregion boolean DEFAULT false,
  cob_vip boolean DEFAULT false,
  cob_emergencia_medica_extranjero boolean DEFAULT false,
  cob_enfermedades_graves_extranjero boolean DEFAULT false,
  cob_cobertura_internacional boolean DEFAULT false,
  cob_ampliacion_servicios boolean DEFAULT false,
  cob_ayuda_diaria boolean DEFAULT false,
  cob_indemnizacion_eg boolean DEFAULT false,
  cob_maternidad boolean DEFAULT false,
  cob_xtensuz boolean DEFAULT false,

  -- Montos opcionales
  monto_maternidad numeric(12,2),
  monto_xtensuz numeric(12,2),

  -- Resultados calculados
  prima_neta_total numeric(12,2) NOT NULL,
  recargo numeric(12,2) NOT NULL,
  gastos_expedicion numeric(12,2) NOT NULL,
  subtotal numeric(12,2) NOT NULL,
  iva numeric(12,2) NOT NULL,
  total numeric(12,2) NOT NULL,

  -- Recibos
  primer_recibo numeric(12,2) NOT NULL,
  recibos_subsecuentes numeric(12,2),

  -- JSON completo para auditoría
  input_json jsonb NOT NULL,
  result_json jsonb NOT NULL,

  -- PDF
  pdf_url text,

  -- Metadata
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_gmm_quotes_created_by ON gmm_quotes(created_by);
CREATE INDEX idx_gmm_quotes_tariff_package ON gmm_quotes(tariff_package_id);
CREATE INDEX idx_gmm_quotes_created_at ON gmm_quotes(created_at DESC);

ALTER TABLE gmm_quotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own quotes"
  ON gmm_quotes FOR SELECT
  TO authenticated
  USING (created_by = auth.uid());

CREATE POLICY "Users can create quotes"
  ON gmm_quotes FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can update own quotes"
  ON gmm_quotes FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Admin can view all quotes"
  ON gmm_quotes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'admin'
    )
  );

-- ============================================
-- TABLA: gmm_quote_insureds
-- ============================================

CREATE TABLE IF NOT EXISTS gmm_quote_insureds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES gmm_quotes(id) ON DELETE CASCADE,
  orden int NOT NULL,

  -- Datos del asegurado
  nombre text NOT NULL,
  sexo text NOT NULL CHECK (sexo IN ('Hombre', 'Mujer')),
  edad int NOT NULL CHECK (edad >= 0 AND edad <= 110),
  fecha_nacimiento date,

  -- Primas calculadas
  prima_base numeric(12,2) NOT NULL,
  prima_adicionales numeric(12,2) DEFAULT 0,
  prima_xtensuz numeric(12,2) DEFAULT 0,
  prima_total numeric(12,2) NOT NULL,

  -- Desglose de adicionales (para auditoría)
  adicionales_json jsonb,

  created_at timestamptz DEFAULT now(),
  UNIQUE(quote_id, orden)
);

CREATE INDEX idx_gmm_quote_insureds_quote ON gmm_quote_insureds(quote_id);

ALTER TABLE gmm_quote_insureds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view insureds of own quotes"
  ON gmm_quote_insureds FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM gmm_quotes
      WHERE gmm_quotes.id = gmm_quote_insureds.quote_id
      AND gmm_quotes.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can insert insureds for own quotes"
  ON gmm_quote_insureds FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM gmm_quotes
      WHERE gmm_quotes.id = gmm_quote_insureds.quote_id
      AND gmm_quotes.created_by = auth.uid()
    )
  );

CREATE POLICY "Admin can view all insureds"
  ON gmm_quote_insureds FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'admin'
    )
  );

-- ============================================
-- FUNCIÓN: Activar tarifa
-- ============================================

CREATE OR REPLACE FUNCTION activate_tariff_package(p_package_id uuid)
RETURNS void AS $$
BEGIN
  -- Desactivar todas las tarifas activas
  UPDATE tariff_packages
  SET status = 'archived'
  WHERE status = 'active';

  -- Activar la nueva tarifa
  UPDATE tariff_packages
  SET
    status = 'active',
    activated_at = now(),
    activated_by = auth.uid()
  WHERE id = p_package_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- FUNCIÓN: Generar número de cotización
-- ============================================

CREATE OR REPLACE FUNCTION generate_quote_number()
RETURNS text AS $$
DECLARE
  v_year text;
  v_count int;
  v_number text;
BEGIN
  v_year := TO_CHAR(NOW(), 'YYYY');

  SELECT COUNT(*) + 1 INTO v_count
  FROM gmm_quotes
  WHERE EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM NOW());

  v_number := 'BXP-' || v_year || '-' || LPAD(v_count::text, 5, '0');

  RETURN v_number;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- TRIGGER: Auto-generar número de cotización
-- ============================================

CREATE OR REPLACE FUNCTION set_quote_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.quote_number IS NULL THEN
    NEW.quote_number := generate_quote_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_quote_number
  BEFORE INSERT ON gmm_quotes
  FOR EACH ROW
  EXECUTE FUNCTION set_quote_number();

-- ============================================
-- STORAGE: Buckets
-- ============================================

INSERT INTO storage.buckets (id, name, public)
VALUES
  ('gmm-tariffs', 'gmm-tariffs', false),
  ('gmm-quotes', 'gmm-quotes', false)
ON CONFLICT (id) DO NOTHING;

-- Políticas de storage para tarifas
CREATE POLICY "Admin can upload tariffs"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'gmm-tariffs' AND
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'admin'
    )
  );

CREATE POLICY "Admin can read tariffs"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'gmm-tariffs' AND
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'admin'
    )
  );

-- Políticas de storage para PDFs de cotizaciones
CREATE POLICY "Users can upload quote PDFs"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'gmm-quotes');

CREATE POLICY "Users can read own quote PDFs"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'gmm-quotes' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Admin can read all quote PDFs"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'gmm-quotes' AND
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'admin'
    )
  );
