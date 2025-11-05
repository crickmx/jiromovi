/*
  # Fix reservas_espacio estados constraint
  
  1. Changes
    - Drop conflicting check constraints
    - Add new constraint with correct estados: pendiente, aprobada, rechazada, cancelada
    
  2. Notes
    - The current code uses 'aprobada' and 'rechazada' but the constraint only allows 'confirmada' and 'cancelada'
    - This migration aligns the constraint with the actual code implementation
*/

-- Drop existing conflicting constraints
ALTER TABLE reservas_espacio DROP CONSTRAINT IF EXISTS reservas_espacio_estado_check;
ALTER TABLE reservas_espacio DROP CONSTRAINT IF EXISTS reservas_estado_check;

-- Add new constraint with correct estados
ALTER TABLE reservas_espacio 
ADD CONSTRAINT reservas_espacio_estado_check 
CHECK (estado IN ('pendiente', 'aprobada', 'rechazada', 'cancelada'));
