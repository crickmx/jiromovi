-- ============================================================
-- Multicotizador GMM Module
-- Supports BNV (Bupa Nacional Vital), BNP (Bupa Nacional Plus)
-- BX+ reuses existing tariff_packages/tariff_tables
-- ============================================================

-- Tariff packages for BNV and BNP
CREATE TABLE multicotizador_gmm_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product text NOT NULL CHECK (product IN ('BNV', 'BNP')),
  version_name text NOT NULL,
  source_filename text,
  source_hash text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived', 'failed')),
  derecho_poliza numeric NOT NULL DEFAULT 1600,
  asistencia_extranjero numeric NOT NULL DEFAULT 1632,
  costo_catastrofica_extranjero numeric DEFAULT 5800,
  sumas_aseguradas jsonb NOT NULL DEFAULT '[]',
  deducibles jsonb NOT NULL DEFAULT '[]',
  coaseguros jsonb NOT NULL DEFAULT '[]',
  topes_coaseguro jsonb NOT NULL DEFAULT '[]',
  client_types jsonb NOT NULL DEFAULT '[]',
  internal_factors jsonb NOT NULL DEFAULT '[]',
  rates_count integer DEFAULT 0,
  validation_errors jsonb,
  notes text,
  created_at timestamptz DEFAULT now(),
  created_by uuid,
  activated_at timestamptz,
  activated_by uuid
);

ALTER TABLE multicotizador_gmm_packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_mgmm_packages_all" ON multicotizador_gmm_packages
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_mgmm_packages_admin" ON multicotizador_gmm_packages
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'Administrador'));
CREATE POLICY "update_mgmm_packages_admin" ON multicotizador_gmm_packages
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'Administrador'))
  WITH CHECK (EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'Administrador'));
CREATE POLICY "delete_mgmm_packages_admin" ON multicotizador_gmm_packages
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'Administrador'));

-- Rate lookup table for BNV and BNP
CREATE TABLE multicotizador_gmm_rates (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  package_id uuid NOT NULL REFERENCES multicotizador_gmm_packages(id) ON DELETE CASCADE,
  lookup_key text NOT NULL,
  plan_name text NOT NULL,
  region text NOT NULL,
  age integer NOT NULL,
  rate numeric NOT NULL,
  rate_type text DEFAULT 'Unisex' CHECK (rate_type IN ('Male', 'Female', 'Unisex'))
);

ALTER TABLE multicotizador_gmm_rates ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_mgmm_rates_pkg ON multicotizador_gmm_rates(package_id);
CREATE INDEX idx_mgmm_rates_key ON multicotizador_gmm_rates(package_id, lookup_key, region, age);
CREATE INDEX idx_mgmm_rates_plan ON multicotizador_gmm_rates(package_id, plan_name, region, age, rate_type);

CREATE POLICY "select_mgmm_rates_all" ON multicotizador_gmm_rates
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_mgmm_rates_admin" ON multicotizador_gmm_rates
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'Administrador'));
CREATE POLICY "update_mgmm_rates_admin" ON multicotizador_gmm_rates
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'Administrador'))
  WITH CHECK (EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'Administrador'));
CREATE POLICY "delete_mgmm_rates_admin" ON multicotizador_gmm_rates
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'Administrador'));

-- Saved multi-carrier quotations
CREATE TABLE multicotizador_gmm_quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  folio text UNIQUE,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  client_name text NOT NULL,
  people_json jsonb NOT NULL DEFAULT '[]',
  options_json jsonb NOT NULL DEFAULT '[]',
  results_json jsonb NOT NULL DEFAULT '[]',
  selected_formas_pago jsonb DEFAULT '["Anual","Semestral","Trimestral","Mensual"]',
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'calculated', 'pdf_generated', 'deleted')),
  pdf_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz
);

ALTER TABLE multicotizador_gmm_quotes ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_mgmm_quotes_usr ON multicotizador_gmm_quotes(created_by);
CREATE INDEX idx_mgmm_quotes_sts ON multicotizador_gmm_quotes(status) WHERE deleted_at IS NULL;

CREATE POLICY "select_mgmm_quotes_own" ON multicotizador_gmm_quotes
  FOR SELECT TO authenticated
  USING (created_by = auth.uid() AND deleted_at IS NULL);
CREATE POLICY "select_mgmm_quotes_admin" ON multicotizador_gmm_quotes
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'Administrador') AND deleted_at IS NULL);
CREATE POLICY "insert_mgmm_quotes_own" ON multicotizador_gmm_quotes
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());
CREATE POLICY "update_mgmm_quotes_own" ON multicotizador_gmm_quotes
  FOR UPDATE TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());
CREATE POLICY "delete_mgmm_quotes_own" ON multicotizador_gmm_quotes
  FOR DELETE TO authenticated
  USING (created_by = auth.uid());

-- Folio counter
CREATE TABLE multicotizador_gmm_folio_counter (
  year integer PRIMARY KEY,
  last_number integer NOT NULL DEFAULT 0
);

INSERT INTO multicotizador_gmm_folio_counter (year, last_number) VALUES (2026, 0);

-- Folio generation function
CREATE OR REPLACE FUNCTION generate_multicotizador_gmm_folio()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year integer := EXTRACT(YEAR FROM now())::integer;
  v_number integer;
BEGIN
  INSERT INTO multicotizador_gmm_folio_counter (year, last_number)
  VALUES (v_year, 1)
  ON CONFLICT (year)
  DO UPDATE SET last_number = multicotizador_gmm_folio_counter.last_number + 1
  RETURNING last_number INTO v_number;

  RETURN 'MGMM-' || v_year || '-' || LPAD(v_number::text, 5, '0');
END;
$$;

-- Trigger to auto-set folio on insert
CREATE OR REPLACE FUNCTION set_multicotizador_gmm_folio()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.folio IS NULL THEN
    NEW.folio := generate_multicotizador_gmm_folio();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_set_multicotizador_gmm_folio
  BEFORE INSERT ON multicotizador_gmm_quotes
  FOR EACH ROW EXECUTE FUNCTION set_multicotizador_gmm_folio();

-- Activate tariff package function
CREATE OR REPLACE FUNCTION activate_multicotizador_tariff(p_package_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_product text;
BEGIN
  SELECT product INTO v_product FROM multicotizador_gmm_packages WHERE id = p_package_id;
  IF v_product IS NULL THEN
    RAISE EXCEPTION 'Package not found';
  END IF;

  UPDATE multicotizador_gmm_packages
  SET status = 'archived', activated_at = NULL
  WHERE product = v_product AND status = 'active';

  UPDATE multicotizador_gmm_packages
  SET status = 'active', activated_at = now(), activated_by = auth.uid()
  WHERE id = p_package_id;
END;
$$;
