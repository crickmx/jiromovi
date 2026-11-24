/*
  # Add Gerente Role to Permissions System

  1. Purpose
    - Update permisos_campos table to support Gerente role
    - Add permissions for Gerente role for all fields
    
  2. Changes
    - Drop existing check constraint on rol column
    - Add new check constraint including Gerente role
    - Insert permission records for Gerente role for all fields
    
  3. Notes
    - Gerentes get full visibility and edit access by default
    - Only inserts if Gerente permissions don't already exist
*/

-- Drop the existing check constraint
ALTER TABLE permisos_campos 
  DROP CONSTRAINT IF EXISTS permisos_campos_rol_check;

-- Add new check constraint including Gerente
ALTER TABLE permisos_campos 
  ADD CONSTRAINT permisos_campos_rol_check 
  CHECK (rol = ANY (ARRAY['Administrador'::text, 'Empleado'::text, 'Agente'::text, 'Gerente'::text]));

-- Insert permissions for Gerente role if they don't exist
DO $$
DECLARE
  campo_record RECORD;
BEGIN
  FOR campo_record IN 
    SELECT DISTINCT nombre_campo 
    FROM permisos_campos 
    WHERE rol = 'Agente'
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM permisos_campos 
      WHERE rol = 'Gerente' AND nombre_campo = campo_record.nombre_campo
    ) THEN
      INSERT INTO permisos_campos (rol, nombre_campo, visible, editable)
      VALUES ('Gerente', campo_record.nombre_campo, true, true);
    END IF;
  END LOOP;
END $$;
