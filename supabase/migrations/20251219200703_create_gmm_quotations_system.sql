/*
  # Create GMM Quotations System

  1. New Tables
    - `gmm_quotations`
      - `id` (uuid, primary key)
      - `folio` (text, unique, auto-generated)
      - `usuario_id` (uuid, foreign key to usuarios)
      - `estado` (text, enum: draft, active, archived)
      - `producto` (text, default 'GMM BX+')
      - `cliente_nombre` (text)
      - `asegurado_principal` (text)
      - `quote_data` (jsonb, stores complete quote configuration)
      - `coverage_selections` (jsonb, stores which optional coverages are active)
      - `prima_neta_total` (numeric)
      - `total_a_pagar` (numeric)
      - `forma_pago` (text)
      - `pdf_url` (text, nullable)
      - `editada_desde_cotizacion_id` (uuid, nullable, self-reference)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
      - `deleted_at` (timestamptz, nullable for soft delete)

  2. Security
    - Enable RLS on `gmm_quotations` table
    - Add policies for authenticated users to manage their own quotations
    - Admins can view all quotations

  3. Functions
    - Auto-generate folio with format: GMM-YYYY-NNNNN
    - Trigger to update updated_at timestamp
*/

-- Create gmm_quotations table
CREATE TABLE IF NOT EXISTS gmm_quotations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  folio text UNIQUE NOT NULL,
  usuario_id uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  estado text NOT NULL DEFAULT 'active' CHECK (estado IN ('draft', 'active', 'archived')),
  producto text NOT NULL DEFAULT 'GMM BX+',
  cliente_nombre text,
  asegurado_principal text NOT NULL,
  quote_data jsonb NOT NULL,
  coverage_selections jsonb NOT NULL DEFAULT '{}',
  prima_neta_total numeric NOT NULL,
  total_a_pagar numeric NOT NULL,
  forma_pago text NOT NULL,
  pdf_url text,
  editada_desde_cotizacion_id uuid REFERENCES gmm_quotations(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_gmm_quotations_usuario_id ON gmm_quotations(usuario_id);
CREATE INDEX IF NOT EXISTS idx_gmm_quotations_folio ON gmm_quotations(folio);
CREATE INDEX IF NOT EXISTS idx_gmm_quotations_created_at ON gmm_quotations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gmm_quotations_deleted_at ON gmm_quotations(deleted_at) WHERE deleted_at IS NULL;

-- Function to generate folio
CREATE OR REPLACE FUNCTION generate_gmm_folio()
RETURNS text AS $$
DECLARE
  year_part text;
  sequence_num integer;
  new_folio text;
BEGIN
  year_part := TO_CHAR(NOW(), 'YYYY');
  
  -- Get the next sequence number for this year
  SELECT COALESCE(MAX(CAST(SUBSTRING(folio FROM 10) AS INTEGER)), 0) + 1
  INTO sequence_num
  FROM gmm_quotations
  WHERE folio LIKE 'GMM-' || year_part || '-%'
  AND deleted_at IS NULL;
  
  new_folio := 'GMM-' || year_part || '-' || LPAD(sequence_num::text, 5, '0');
  
  RETURN new_folio;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate folio before insert
CREATE OR REPLACE FUNCTION set_gmm_folio()
RETURNS trigger AS $$
BEGIN
  IF NEW.folio IS NULL OR NEW.folio = '' THEN
    NEW.folio := generate_gmm_folio();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_gmm_folio
  BEFORE INSERT ON gmm_quotations
  FOR EACH ROW
  EXECUTE FUNCTION set_gmm_folio();

-- Trigger to update updated_at
CREATE TRIGGER trigger_gmm_quotations_updated_at
  BEFORE UPDATE ON gmm_quotations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE gmm_quotations ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own quotations (not deleted)
CREATE POLICY "Users can view own quotations"
  ON gmm_quotations
  FOR SELECT
  TO authenticated
  USING (
    usuario_id = auth.uid()
    AND deleted_at IS NULL
  );

-- Policy: Admins can view all quotations
CREATE POLICY "Admins can view all quotations"
  ON gmm_quotations
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'admin'
    )
  );

-- Policy: Users can insert their own quotations
CREATE POLICY "Users can insert own quotations"
  ON gmm_quotations
  FOR INSERT
  TO authenticated
  WITH CHECK (usuario_id = auth.uid());

-- Policy: Users can update their own quotations
CREATE POLICY "Users can update own quotations"
  ON gmm_quotations
  FOR UPDATE
  TO authenticated
  USING (
    usuario_id = auth.uid()
    AND deleted_at IS NULL
  )
  WITH CHECK (usuario_id = auth.uid());

-- Policy: Users can soft delete their own quotations
CREATE POLICY "Users can delete own quotations"
  ON gmm_quotations
  FOR UPDATE
  TO authenticated
  USING (
    usuario_id = auth.uid()
    AND deleted_at IS NULL
  )
  WITH CHECK (
    usuario_id = auth.uid()
    AND deleted_at IS NOT NULL
  );