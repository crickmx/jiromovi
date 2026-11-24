/*
  # Fix SICAS Catalogos Names - Complete Solution

  1. Changes
    - Create trigger to automatically extract clean names from raw JSON
    - Update existing records to have clean names
    - Ensure all future inserts/updates extract clean names

  2. Security
    - Maintains data integrity
    - Automatic extraction of names
*/

-- Function to extract clean name from raw JSON based on catalog type
CREATE OR REPLACE FUNCTION extract_sicas_catalog_name()
RETURNS TRIGGER AS $$
BEGIN
  -- For Despachos (catalog_type_id = 11)
  IF NEW.catalog_type_id = 11 THEN
    NEW.nombre = COALESCE(NEW.raw->>'DespNombre', NEW.nombre);
  END IF;

  -- For Vendedores (catalog_type_id = 32)
  IF NEW.catalog_type_id = 32 THEN
    NEW.nombre = COALESCE(NEW.raw->>'VendNombre', NEW.nombre);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists
DROP TRIGGER IF EXISTS trigger_extract_catalog_name ON sicas_catalogos;

-- Create trigger for INSERT and UPDATE
CREATE TRIGGER trigger_extract_catalog_name
  BEFORE INSERT OR UPDATE ON sicas_catalogos
  FOR EACH ROW
  EXECUTE FUNCTION extract_sicas_catalog_name();

-- Update all existing despachos
UPDATE sicas_catalogos
SET nombre = raw->>'DespNombre'
WHERE catalog_type_id = 11
  AND raw ? 'DespNombre'
  AND (nombre IS NULL OR nombre LIKE '{%');

-- Update all existing vendedores
UPDATE sicas_catalogos
SET nombre = raw->>'VendNombre'
WHERE catalog_type_id = 32
  AND raw ? 'VendNombre'
  AND (nombre IS NULL OR nombre LIKE '{%');

-- Verify the fix worked
DO $$
DECLARE
  despachos_count INTEGER;
  vendedores_count INTEGER;
  despachos_clean INTEGER;
  vendedores_clean INTEGER;
BEGIN
  SELECT COUNT(*) INTO despachos_count FROM sicas_catalogos WHERE catalog_type_id = 11;
  SELECT COUNT(*) INTO vendedores_count FROM sicas_catalogos WHERE catalog_type_id = 32;
  
  SELECT COUNT(*) INTO despachos_clean FROM sicas_catalogos 
  WHERE catalog_type_id = 11 AND nombre NOT LIKE '{%';
  
  SELECT COUNT(*) INTO vendedores_clean FROM sicas_catalogos 
  WHERE catalog_type_id = 32 AND nombre NOT LIKE '{%';
  
  RAISE NOTICE 'Despachos: % total, % with clean names', despachos_count, despachos_clean;
  RAISE NOTICE 'Vendedores: % total, % with clean names', vendedores_count, vendedores_clean;
END $$;