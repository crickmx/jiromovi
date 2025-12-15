/*
  # Fix usuarios estado check constraint

  1. Problem
    - The check constraint usuarios_estado_check only allows: 'activo', 'inactivo', 'pendiente'
    - The safe_delete_user function tries to set estado = 'eliminado'
    - This causes a constraint violation error when deleting users

  2. Solution
    - Drop the existing check constraint
    - Create new check constraint that includes 'eliminado' as a valid value

  3. Changes
    - Drop: usuarios_estado_check (old constraint)
    - Create: usuarios_estado_check (with 'eliminado' added)
*/

-- Drop the existing constraint
ALTER TABLE usuarios 
DROP CONSTRAINT IF EXISTS usuarios_estado_check;

-- Create new constraint with 'eliminado' included
ALTER TABLE usuarios
ADD CONSTRAINT usuarios_estado_check 
CHECK (estado IN ('activo', 'inactivo', 'pendiente', 'eliminado'));

-- Add comment explaining the valid states
COMMENT ON COLUMN usuarios.estado IS 'Estado del usuario: activo, inactivo, pendiente, eliminado';
