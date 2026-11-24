/*
  # Link Commission Offices to Oficinas

  1. Changes to `commission_offices` table
    - Add `oficina_id` column linking to oficinas table
    - Add unique constraint on oficina_id
    - Sync existing oficinas to commission_offices

  2. Function to sync oficinas to commission_offices
    - Automatically creates commission office when oficina is created/updated

  3. Trigger to keep data in sync
*/

-- Add oficina_id column to commission_offices
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'commission_offices' AND column_name = 'oficina_id'
  ) THEN
    ALTER TABLE commission_offices 
    ADD COLUMN oficina_id uuid REFERENCES oficinas(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add unique constraint on oficina_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'commission_offices_oficina_id_key'
  ) THEN
    ALTER TABLE commission_offices 
    ADD CONSTRAINT commission_offices_oficina_id_key UNIQUE (oficina_id);
  END IF;
END $$;

-- Create index on oficina_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_commission_offices_oficina_id ON commission_offices(oficina_id);

-- Function to sync oficinas to commission_offices
CREATE OR REPLACE FUNCTION sync_oficina_to_commission_office()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert or update commission office
  INSERT INTO commission_offices (
    oficina_id,
    name,
    created_at
  ) VALUES (
    NEW.id,
    NEW.nombre,
    NOW()
  )
  ON CONFLICT (oficina_id) 
  DO UPDATE SET
    name = EXCLUDED.name;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to sync oficinas to commission_offices
DROP TRIGGER IF EXISTS sync_oficina_commission_office ON oficinas;
CREATE TRIGGER sync_oficina_commission_office
  AFTER INSERT OR UPDATE ON oficinas
  FOR EACH ROW
  EXECUTE FUNCTION sync_oficina_to_commission_office();

-- Populate commission_offices with existing oficinas
INSERT INTO commission_offices (oficina_id, name, created_at)
SELECT 
  id,
  nombre,
  NOW()
FROM oficinas
ON CONFLICT (oficina_id) DO NOTHING;
