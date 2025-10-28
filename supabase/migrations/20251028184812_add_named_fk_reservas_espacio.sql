/*
  # Fix Foreign Key Relationships for Reservas Espacio

  1. Changes
    - Drop existing foreign keys without names
    - Add named foreign key constraints for better query hints
    - This allows Supabase to properly distinguish between usuario_id and creado_por relationships

  2. Foreign Keys
    - `reservas_espacio_usuario_fkey`: Links usuario_id to usuarios table (the person making the reservation)
    - `reservas_espacio_creado_por_fkey`: Links creado_por to usuarios table (the person who created the record)
*/

-- Drop and recreate the foreign keys with explicit names
DO $$
BEGIN
  -- Drop existing unnamed foreign keys if they exist
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name LIKE '%reservas_espacio%usuario%' 
    AND constraint_type = 'FOREIGN KEY'
    AND table_name = 'reservas_espacio'
  ) THEN
    -- Drop all existing foreign keys to usuarios
    ALTER TABLE reservas_espacio 
    DROP CONSTRAINT IF EXISTS reservas_espacio_usuario_id_fkey,
    DROP CONSTRAINT IF EXISTS reservas_espacio_creado_por_fkey;
  END IF;

  -- Add named foreign keys
  ALTER TABLE reservas_espacio
  ADD CONSTRAINT reservas_espacio_usuario_fkey 
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE;

  ALTER TABLE reservas_espacio
  ADD CONSTRAINT reservas_espacio_creado_por_fkey 
  FOREIGN KEY (creado_por) REFERENCES usuarios(id) ON DELETE CASCADE;
END $$;
