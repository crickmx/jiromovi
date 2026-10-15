/*
  # Add tipo_seguro_id to tickets table

  1. Changes
    - Add tipo_seguro_id column to tickets table
    - Add foreign key constraint to insurance_types table
    - Column is optional (nullable) to allow flexibility

  2. Purpose
    - Allow tickets to be associated with a specific insurance type
    - Enable better categorization and filtering of tickets
*/

-- Add tipo_seguro_id column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tickets' AND column_name = 'tipo_seguro_id'
  ) THEN
    ALTER TABLE tickets ADD COLUMN tipo_seguro_id uuid REFERENCES insurance_types(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_tickets_tipo_seguro_id ON tickets(tipo_seguro_id);
  END IF;
END $$;
