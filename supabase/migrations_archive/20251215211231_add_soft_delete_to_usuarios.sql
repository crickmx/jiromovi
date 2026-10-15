/*
  # Add Soft Delete to Usuarios

  1. New Columns
    - `is_deleted` (boolean, default false) - Marca si el usuario está eliminado
    - `deleted_at` (timestamptz nullable) - Fecha/hora de eliminación
    - `deleted_by_user_id` (uuid nullable) - ID del administrador que eliminó
    - `estado` (text) - Estado del usuario: activo, suspendido, eliminado
    
  2. Changes
    - Add new columns to usuarios table
    - Add check constraint for estado
    - Add index on is_deleted for better query performance
    - Add foreign key for deleted_by_user_id
    
  3. Security
    - No RLS changes needed - using existing policies
*/

-- Add soft delete columns
DO $$ 
BEGIN
  -- Add is_deleted if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'usuarios' AND column_name = 'is_deleted'
  ) THEN
    ALTER TABLE usuarios ADD COLUMN is_deleted boolean DEFAULT false NOT NULL;
  END IF;

  -- Add deleted_at if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'usuarios' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE usuarios ADD COLUMN deleted_at timestamptz;
  END IF;

  -- Add deleted_by_user_id if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'usuarios' AND column_name = 'deleted_by_user_id'
  ) THEN
    ALTER TABLE usuarios ADD COLUMN deleted_by_user_id uuid;
  END IF;
END $$;

-- Update estado column to have proper values if it exists, or create it
DO $$
BEGIN
  -- Check if estado column exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'usuarios' AND column_name = 'estado'
  ) THEN
    -- Update existing estado values to match new constraint
    UPDATE usuarios SET estado = 'activo' WHERE estado IS NULL OR estado NOT IN ('activo', 'suspendido', 'eliminado');
  ELSE
    -- Add estado column
    ALTER TABLE usuarios ADD COLUMN estado text DEFAULT 'activo' NOT NULL;
  END IF;
END $$;

-- Add check constraint for estado
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'usuarios_estado_check'
  ) THEN
    ALTER TABLE usuarios 
      ADD CONSTRAINT usuarios_estado_check 
      CHECK (estado IN ('activo', 'suspendido', 'eliminado'));
  END IF;
END $$;

-- Add foreign key for deleted_by_user_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'usuarios_deleted_by_user_id_fkey'
  ) THEN
    ALTER TABLE usuarios
      ADD CONSTRAINT usuarios_deleted_by_user_id_fkey
      FOREIGN KEY (deleted_by_user_id)
      REFERENCES usuarios(id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- Create index on is_deleted for better query performance
CREATE INDEX IF NOT EXISTS idx_usuarios_is_deleted 
  ON usuarios(is_deleted) 
  WHERE is_deleted = false;

-- Create index on estado for filtering
CREATE INDEX IF NOT EXISTS idx_usuarios_estado 
  ON usuarios(estado);

-- Add comment
COMMENT ON COLUMN usuarios.is_deleted IS 'Marca si el usuario está eliminado (soft delete)';
COMMENT ON COLUMN usuarios.deleted_at IS 'Fecha y hora cuando el usuario fue eliminado';
COMMENT ON COLUMN usuarios.deleted_by_user_id IS 'ID del administrador que eliminó el usuario';
COMMENT ON COLUMN usuarios.estado IS 'Estado del usuario: activo, suspendido, eliminado';
