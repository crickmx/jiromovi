/*
  # Fix SICAS Despachos Synchronization

  1. Changes
    - Populate sicas_despachos with data from sicas_catalogos
    - Create trigger to keep both tables in sync
    - Fix RLS policies for gerentes access

  2. Security
    - Allow gerentes to view SICAS catalogos
    - Maintain data consistency between tables
*/

-- First, populate sicas_despachos from sicas_catalogos
INSERT INTO sicas_despachos (id_sicas, nombre, raw, is_mapped, created_at, updated_at)
SELECT 
  id_sicas,
  nombre,
  raw,
  false as is_mapped,
  created_at,
  updated_at
FROM sicas_catalogos
WHERE catalog_type_id = 11
ON CONFLICT (id_sicas) DO UPDATE SET
  nombre = EXCLUDED.nombre,
  raw = EXCLUDED.raw,
  updated_at = EXCLUDED.updated_at;

-- Create function to sync despachos from catalogos
CREATE OR REPLACE FUNCTION sync_sicas_despachos()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.catalog_type_id = 11 THEN
    INSERT INTO sicas_despachos (id_sicas, nombre, raw, created_at, updated_at)
    VALUES (NEW.id_sicas, NEW.nombre, NEW.raw, NEW.created_at, NEW.updated_at)
    ON CONFLICT (id_sicas) DO UPDATE SET
      nombre = EXCLUDED.nombre,
      raw = EXCLUDED.raw,
      updated_at = EXCLUDED.updated_at;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists
DROP TRIGGER IF EXISTS trigger_sync_despachos ON sicas_catalogos;

-- Create trigger
CREATE TRIGGER trigger_sync_despachos
  AFTER INSERT OR UPDATE ON sicas_catalogos
  FOR EACH ROW
  WHEN (NEW.catalog_type_id = 11)
  EXECUTE FUNCTION sync_sicas_despachos();

-- Fix RLS policies for SICAS catalogos to allow gerentes
DROP POLICY IF EXISTS "Allow admins and gerentes to view catalogos" ON sicas_catalogos;

CREATE POLICY "Allow admins and gerentes to view catalogos"
  ON sicas_catalogos
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol IN ('admin', 'gerente')
    )
  );

-- Verify sync worked
DO $$
DECLARE
  despachos_count INTEGER;
  catalogos_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO despachos_count FROM sicas_despachos;
  SELECT COUNT(*) INTO catalogos_count FROM sicas_catalogos WHERE catalog_type_id = 11;
  
  RAISE NOTICE 'Synced % despachos from % catalogos', despachos_count, catalogos_count;
END $$;
