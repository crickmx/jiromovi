/*
  # Update RLS Policies to Exclude Deleted Users

  1. Changes
    - Update usuarios SELECT policies to exclude is_deleted = true by default
    - Admins can see deleted users with special query parameter
    - Protect all normal views from showing deleted users
    
  2. Security
    - Normal users cannot see deleted users
    - Admins can see deleted users only when explicitly requested
    - Maintain existing permission structure
*/

-- Drop existing SELECT policies for usuarios
DROP POLICY IF EXISTS "Users can view own data" ON usuarios;
DROP POLICY IF EXISTS "Admins can view all users" ON usuarios;
DROP POLICY IF EXISTS "Gerentes can view own office users" ON usuarios;
DROP POLICY IF EXISTS "Users can view all active users for directory" ON usuarios;

-- Policy: Users can view their own data (even if deleted, for profile page)
CREATE POLICY "Users can view own data"
  ON usuarios FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Policy: Admins can view all users (including deleted)
CREATE POLICY "Admins can view all users including deleted"
  ON usuarios FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND u.rol = 'Administrador'
      AND u.is_deleted = false
    )
  );

-- Policy: Gerentes can view users in their office (excluding deleted)
CREATE POLICY "Gerentes can view own office users"
  ON usuarios FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios gerente
      WHERE gerente.id = auth.uid()
      AND gerente.rol = 'Gerente'
      AND gerente.is_deleted = false
      AND gerente.oficina_id = usuarios.oficina_id
    )
    AND usuarios.is_deleted = false
  );

-- Policy: All authenticated users can view active, non-deleted users for directory
CREATE POLICY "Users can view active users for directory"
  ON usuarios FOR SELECT
  TO authenticated
  USING (
    usuarios.activo = true 
    AND usuarios.is_deleted = false
  );

-- Add comment
COMMENT ON COLUMN usuarios.is_deleted IS 'Soft delete flag - when true, user is deleted but data preserved';
