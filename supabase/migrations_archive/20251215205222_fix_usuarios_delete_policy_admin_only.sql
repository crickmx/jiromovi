/*
  # Fix Delete Policy for Usuarios - Admin Only

  1. Changes
    - Drop the overly permissive delete policy that allows all authenticated users to delete
    - Create a new restrictive policy that only allows Administrators to delete users
  
  2. Security
    - Only users with rol = 'Administrador' can delete user records
    - This prevents unauthorized user deletion
*/

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Service role can delete users" ON usuarios;

-- Create a new restrictive policy for administrators only
CREATE POLICY "Administrators can delete users"
  ON usuarios
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND u.rol = 'Administrador'
    )
  );
