/*
  # Módulo de Comisiones - MOVI Digital

  Este módulo maneja el cálculo, procesamiento y distribución de comisiones para agentes.

  ## 1. Nuevas Tablas
  
  Todas las tablas necesarias para el módulo de comisiones con RLS apropiado.

  ## 2. Security
  
  - Admins pueden gestionar todo
  - Agentes solo ven sus comisiones cerradas
*/

-- Tabla de oficinas
CREATE TABLE IF NOT EXISTS commission_offices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Tabla de regímenes fiscales
CREATE TABLE IF NOT EXISTS commission_fiscal_regimes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  iva_trasladado float NOT NULL DEFAULT 0,
  iva_retenido float NOT NULL DEFAULT 0,
  isr float NOT NULL DEFAULT 0,
  otros_json jsonb DEFAULT '{}'::jsonb,
  valid_from date NOT NULL,
  valid_to date,
  created_at timestamptz DEFAULT now()
);

-- Tabla de agentes
CREATE TABLE IF NOT EXISTS commission_agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  office_id uuid REFERENCES commission_offices(id) ON DELETE SET NULL,
  fiscal_regime_id uuid REFERENCES commission_fiscal_regimes(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

-- Tabla de reglas de negocio
CREATE TABLE IF NOT EXISTS commission_business_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ramo text NOT NULL,
  aseguradora text NOT NULL,
  office_id uuid REFERENCES commission_offices(id) ON DELETE SET NULL,
  campo_base text NOT NULL DEFAULT 'PrimaNeta',
  tipo_calculo text NOT NULL CHECK (tipo_calculo IN ('%_sobre_base', 'monto_fijo', '%_con_min_max')),
  porcentaje float,
  monto_fijo float,
  minimo float,
  maximo float,
  prioridad int NOT NULL DEFAULT 0,
  valid_from date NOT NULL,
  valid_to date,
  created_at timestamptz DEFAULT now()
);

-- Tabla de lotes de comisiones
CREATE TABLE IF NOT EXISTS commission_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  date_from date NOT NULL,
  date_to date NOT NULL,
  uploaded_by uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'confirmed', 'closed')),
  rules_version text,
  source_file text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Tabla de detalles de comisiones
CREATE TABLE IF NOT EXISTS commission_details (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES commission_batches(id) ON DELETE CASCADE,
  agent_id uuid NOT NULL REFERENCES commission_agents(id) ON DELETE CASCADE,
  ramo text NOT NULL,
  aseguradora text NOT NULL,
  office_id uuid REFERENCES commission_offices(id) ON DELETE SET NULL,
  poliza text NOT NULL,
  prima_base float NOT NULL,
  concepto text,
  date_fpago date NOT NULL,
  commission_bruta float NOT NULL,
  impuestos_json jsonb DEFAULT '{}'::jsonb,
  commission_neta float NOT NULL,
  is_manual_adjusted boolean DEFAULT false,
  adjusted_by_user_id uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  adjusted_at timestamptz,
  adjusted_commission_bruta float,
  adjusted_impuestos_json jsonb,
  adjusted_commission_neta float,
  adjust_reason text,
  raw_row jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Tabla de errores de procesamiento
CREATE TABLE IF NOT EXISTS commission_errors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES commission_batches(id) ON DELETE CASCADE,
  error_type text NOT NULL CHECK (error_type IN ('agent_not_found', 'rule_not_found', 'invalid_data', 'other')),
  email_agente text,
  poliza text,
  detalle text NOT NULL,
  raw_row jsonb DEFAULT '{}'::jsonb,
  resolved boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_commission_details_agent ON commission_details(agent_id);
CREATE INDEX IF NOT EXISTS idx_commission_details_batch ON commission_details(batch_id);
CREATE INDEX IF NOT EXISTS idx_commission_agents_email ON commission_agents(email);
CREATE INDEX IF NOT EXISTS idx_commission_batches_status ON commission_batches(status);
CREATE INDEX IF NOT EXISTS idx_commission_batches_dates ON commission_batches(date_from, date_to);
CREATE INDEX IF NOT EXISTS idx_commission_errors_batch ON commission_errors(batch_id);
CREATE INDEX IF NOT EXISTS idx_commission_errors_resolved ON commission_errors(resolved);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_commission_batch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS commission_batch_updated_at ON commission_batches;
CREATE TRIGGER commission_batch_updated_at
  BEFORE UPDATE ON commission_batches
  FOR EACH ROW
  EXECUTE FUNCTION update_commission_batch_updated_at();

-- Enable RLS
ALTER TABLE commission_offices ENABLE ROW LEVEL SECURITY;
ALTER TABLE commission_fiscal_regimes ENABLE ROW LEVEL SECURITY;
ALTER TABLE commission_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE commission_business_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE commission_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE commission_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE commission_errors ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins manage offices"
  ON commission_offices FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

CREATE POLICY "All view offices"
  ON commission_offices FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins manage fiscal regimes"
  ON commission_fiscal_regimes FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

CREATE POLICY "All view fiscal regimes"
  ON commission_fiscal_regimes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins manage agents"
  ON commission_agents FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

CREATE POLICY "All view agents"
  ON commission_agents FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins manage rules"
  ON commission_business_rules FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

CREATE POLICY "All view rules"
  ON commission_business_rules FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins manage batches"
  ON commission_batches FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

CREATE POLICY "Users view closed batches"
  ON commission_batches FOR SELECT
  TO authenticated
  USING (status = 'closed');

CREATE POLICY "Admins manage commission details"
  ON commission_details FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

CREATE POLICY "Agents view own commissions"
  ON commission_details FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 
      FROM commission_batches cb
      INNER JOIN commission_agents ca ON ca.id = commission_details.agent_id
      INNER JOIN auth.users au ON au.email = ca.email
      WHERE cb.id = commission_details.batch_id
      AND cb.status = 'closed'
      AND au.id = auth.uid()
    )
  );

CREATE POLICY "Admins manage errors"
  ON commission_errors FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

-- Datos iniciales
INSERT INTO commission_fiscal_regimes (name, iva_trasladado, iva_retenido, isr, valid_from) VALUES
  ('RESICO', 0.16, 0.00, 0.0125, '2024-01-01'),
  ('Honorarios', 0.16, 0.1067, 0.10, '2024-01-01'),
  ('Asimilados', 0.00, 0.00, 0.10, '2024-01-01')
ON CONFLICT (name) DO NOTHING;

INSERT INTO commission_offices (name) VALUES
  ('Oficina Central'),
  ('Oficina Norte'),
  ('Oficina Sur')
ON CONFLICT DO NOTHING;