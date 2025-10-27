/*
  # Add Estado Field to Usuarios

  1. Changes
    - Add `estado` column to usuarios table with values 'registrado' or 'activo'
    - Default estado is 'activo' for existing users
    - Gerentes will create users with 'registrado' estado
    - Administradores can change estado from 'registrado' to 'activo'

  2. Notes
    - Existing users will have 'activo' estado by default
    - New users created by Gerentes will be 'registrado' until Administrador activates them
*/

-- Add estado column to usuarios table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'usuarios' AND column_name = 'estado'
  ) THEN
    ALTER TABLE usuarios ADD COLUMN estado text DEFAULT 'activo' CHECK (estado IN ('registrado', 'activo'));
  END IF;
END $$;

-- Update existing users to 'activo'
UPDATE usuarios SET estado = 'activo' WHERE estado IS NULL;
