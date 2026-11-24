/*
  # Agregar campo Concepto a production_records

  1. Cambios
    - Agregar columna `concepto` (text, nullable) a la tabla production_records
    - Esta columna almacenará el concepto del documento desde el Excel/Google Sheets

  2. Notas
    - El campo es nullable porque puede no estar presente en todos los registros existentes
    - Se agregará un índice para mejorar búsquedas por concepto
*/

-- Agregar columna concepto a production_records
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'production_records' AND column_name = 'concepto'
  ) THEN
    ALTER TABLE production_records ADD COLUMN concepto text;
  END IF;
END $$;

-- Crear índice para búsquedas
CREATE INDEX IF NOT EXISTS idx_production_records_concepto ON production_records(concepto);
