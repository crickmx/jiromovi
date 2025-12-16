/*
  # Fix Commission Tables para Importación

  1. Propósito
    - Agregar columnas faltantes que usa convert-import-to-commission-batches
    - Permitir inserción de datos crudos del Excel
    - Mantener compatibilidad con sistema de comisiones calculadas

  2. Cambios en commission_batches
    - Agregar display_name (alias de name)
    - Agregar total_commission
    - Agregar pending_assignments_count

  3. Cambios en commission_details
    - Agregar agent_email (texto, permite NULL)
    - Agregar importe (valor bruto del Excel)
    - Agregar porpart (porcentaje del Excel, 0-100)
    - Hacer fpago NOT NULL con default actual
    - Hacer commission_bruta y commission_neta NULL por defecto
    - Hacer porcentaje_comision NULL por defecto

  4. Justificación
    - Los datos del Excel se insertan "crudos" en commission_details
    - El cálculo de comisiones se hace después
    - agent_email permite matching posterior a agent_id
*/

-- Agregar columnas a commission_batches
DO $$
BEGIN
  -- display_name (alias de name)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'commission_batches' AND column_name = 'display_name'
  ) THEN
    ALTER TABLE commission_batches
    ADD COLUMN display_name text;
  END IF;

  -- total_commission
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'commission_batches' AND column_name = 'total_commission'
  ) THEN
    ALTER TABLE commission_batches
    ADD COLUMN total_commission double precision DEFAULT 0;
  END IF;

  -- pending_assignments_count
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'commission_batches' AND column_name = 'pending_assignments_count'
  ) THEN
    ALTER TABLE commission_batches
    ADD COLUMN pending_assignments_count integer DEFAULT 0;
  END IF;
END $$;

-- Agregar columnas a commission_details
DO $$
BEGIN
  -- agent_email (para matching)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'commission_details' AND column_name = 'agent_email'
  ) THEN
    ALTER TABLE commission_details
    ADD COLUMN agent_email text;

    CREATE INDEX IF NOT EXISTS idx_commission_details_agent_email
    ON commission_details(agent_email);
  END IF;

  -- importe (valor bruto del Excel)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'commission_details' AND column_name = 'importe'
  ) THEN
    ALTER TABLE commission_details
    ADD COLUMN importe double precision;
  END IF;

  -- porpart (porcentaje del Excel, 0-100)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'commission_details' AND column_name = 'porpart'
  ) THEN
    ALTER TABLE commission_details
    ADD COLUMN porpart double precision;
  END IF;
END $$;

-- Hacer fpago NOT NULL con default
ALTER TABLE commission_details
  ALTER COLUMN fpago SET DEFAULT CURRENT_DATE;

-- Actualizar fpago NULL existentes
UPDATE commission_details
SET fpago = CURRENT_DATE
WHERE fpago IS NULL;

-- Ahora hacer fpago NOT NULL
ALTER TABLE commission_details
  ALTER COLUMN fpago SET NOT NULL;

-- Hacer prima_neta nullable (puede venir NULL del Excel)
ALTER TABLE commission_details
  ALTER COLUMN prima_neta DROP NOT NULL;

-- Hacer porcentaje_comision nullable (se calcula después)
ALTER TABLE commission_details
  ALTER COLUMN porcentaje_comision DROP NOT NULL;

-- Comentarios
COMMENT ON COLUMN commission_batches.display_name IS 'Nombre legible del lote (ej: "Comisiones Semana 12")';
COMMENT ON COLUMN commission_batches.total_commission IS 'Suma total de comisiones del lote';
COMMENT ON COLUMN commission_batches.pending_assignments_count IS 'Cantidad de items sin usuario asignado';
COMMENT ON COLUMN commission_details.agent_email IS 'Email del agente (usado para matching antes de asignar agent_id)';
COMMENT ON COLUMN commission_details.importe IS 'Importe bruto del Excel (sin calcular comisión)';
COMMENT ON COLUMN commission_details.porpart IS 'Porcentaje PorPart del Excel (0-100)';
