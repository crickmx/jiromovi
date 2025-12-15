/*
  # Corrección: Separación de Prima Neta y Comisión Base

  ## Problema
  El sistema estaba copiando prima_neta a commission_bruta incorrectamente.

  ## Cambios
  1. Agregar campos de auditoría
     - calculation_status (ok, missing_base, missing_rules, error)
     - calculation_warnings (jsonb array)
     - calculation_method (excel_column, rules_engine, manual)

  2. Crear tabla de configuración
     - commission_import_config para definir de dónde sale commission_bruta

  3. Agregar validaciones para prevenir el bug

  ## Seguridad
  - RLS habilitado en todas las tablas
*/

-- 1. Agregar nuevos campos a commission_details
ALTER TABLE commission_details
  ADD COLUMN IF NOT EXISTS calculation_status text DEFAULT 'ok'
    CHECK (calculation_status IN ('ok', 'missing_base', 'missing_rules', 'error')),
  ADD COLUMN IF NOT EXISTS calculation_warnings jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS calculation_method text
    CHECK (calculation_method IN ('excel_column', 'rules_engine', 'manual', 'unknown'));

-- 2. Agregar comentarios para claridad
COMMENT ON COLUMN commission_details.prima_neta IS 'Prima Neta: monto de la prima del seguro (NO es la comisión)';
COMMENT ON COLUMN commission_details.commission_bruta IS 'Comisión Base/Bruta: monto de comisión antes de impuestos (NO debe ser igual a prima_neta por defecto)';
COMMENT ON COLUMN commission_details.commission_neta IS 'Comisión Neta: monto final después de impuestos';
COMMENT ON COLUMN commission_details.importe_base IS 'Importe Base: monto sobre el cual se calculó la comisión (puede ser prima_neta u otro)';

-- 3. Crear tabla de configuración de importación
CREATE TABLE IF NOT EXISTS commission_import_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  config_name text NOT NULL UNIQUE,

  prima_neta_source text NOT NULL DEFAULT 'excel_column'
    CHECK (prima_neta_source IN ('excel_column', 'calculated')),
  prima_neta_column_name text DEFAULT 'PrimaNeta',

  commission_bruta_source text NOT NULL DEFAULT 'rules_engine'
    CHECK (commission_bruta_source IN ('excel_column', 'rules_engine', 'manual_only')),
  commission_bruta_column_name text,

  commission_neta_source text DEFAULT 'calculated'
    CHECK (commission_neta_source IN ('excel_column', 'calculated')),
  commission_neta_column_name text,

  allow_prima_neta_as_commission_bruta boolean DEFAULT false,
  strict_validation boolean DEFAULT true,

  created_by uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  active boolean DEFAULT true
);

INSERT INTO commission_import_config (
  config_name,
  prima_neta_source,
  prima_neta_column_name,
  commission_bruta_source,
  commission_bruta_column_name,
  allow_prima_neta_as_commission_bruta,
  strict_validation,
  active
) VALUES (
  'default',
  'excel_column',
  'PrimaNeta',
  'rules_engine',
  null,
  false,
  true,
  true
) ON CONFLICT (config_name) DO NOTHING;

-- 4. Crear tabla de auditoría de recálculos
CREATE TABLE IF NOT EXISTS commission_recalculations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES commission_batches(id) ON DELETE CASCADE,
  recalculated_by uuid NOT NULL REFERENCES usuarios(id) ON DELETE SET NULL,
  before_stats jsonb DEFAULT '{}'::jsonb,
  after_stats jsonb DEFAULT '{}'::jsonb,
  changes_summary jsonb DEFAULT '{}'::jsonb,
  warnings jsonb DEFAULT '[]'::jsonb,
  recalculated_at timestamptz DEFAULT now()
);

-- 5. Índices
CREATE INDEX IF NOT EXISTS idx_commission_details_calculation_status
  ON commission_details(calculation_status);

CREATE INDEX IF NOT EXISTS idx_commission_details_calculation_method
  ON commission_details(calculation_method);

CREATE INDEX IF NOT EXISTS idx_commission_import_config_active
  ON commission_import_config(active) WHERE active = true;

CREATE INDEX IF NOT EXISTS idx_commission_recalculations_batch
  ON commission_recalculations(batch_id);

-- 6. Trigger para updated_at en config
CREATE OR REPLACE FUNCTION update_commission_import_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS commission_import_config_updated_at ON commission_import_config;
CREATE TRIGGER commission_import_config_updated_at
  BEFORE UPDATE ON commission_import_config
  FOR EACH ROW
  EXECUTE FUNCTION update_commission_import_config_updated_at();

-- 7. Función de validación anti-bug
CREATE OR REPLACE FUNCTION validate_commission_bruta_not_prima_neta()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.commission_bruta IS NOT NULL
     AND NEW.prima_neta IS NOT NULL
     AND NEW.commission_bruta = NEW.prima_neta THEN

    IF NOT EXISTS (
      SELECT 1 FROM commission_import_config
      WHERE active = true AND allow_prima_neta_as_commission_bruta = true
    ) THEN
      NEW.calculation_warnings =
        COALESCE(NEW.calculation_warnings, '[]'::jsonb) ||
        jsonb_build_array(
          jsonb_build_object(
            'code', 'SUSPICIOUS_BRUTA_EQUALS_PRIMA',
            'message', 'commission_bruta es igual a prima_neta, esto es probablemente un bug',
            'detected_at', now()
          )
        );

      NEW.calculation_status = 'error';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS validate_commission_bruta ON commission_details;
CREATE TRIGGER validate_commission_bruta
  BEFORE INSERT OR UPDATE ON commission_details
  FOR EACH ROW
  EXECUTE FUNCTION validate_commission_bruta_not_prima_neta();

-- 8. Enable RLS
ALTER TABLE commission_import_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE commission_recalculations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins pueden ver configuración"
  ON commission_import_config FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

CREATE POLICY "Admins pueden insertar configuración"
  ON commission_import_config FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

CREATE POLICY "Admins pueden actualizar configuración"
  ON commission_import_config FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

CREATE POLICY "Admins pueden ver recálculos"
  ON commission_recalculations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

CREATE POLICY "Admins pueden insertar recálculos"
  ON commission_recalculations FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

-- 9. Marcar registros existentes sospechosos
UPDATE commission_details
SET
  calculation_status = 'error',
  calculation_warnings = jsonb_build_array(
    jsonb_build_object(
      'code', 'LEGACY_DATA_NEEDS_REVIEW',
      'message', 'Este registro fue importado antes de la corrección del bug. Requiere verificación.',
      'detected_at', now()
    )
  ),
  calculation_method = 'unknown'
WHERE commission_bruta = prima_neta
  AND (calculation_status IS NULL OR calculation_method IS NULL);
