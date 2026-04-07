/*
  # Fix admin UPDATE policy WITH CHECK clause

  1. Problem
    - Current WITH CHECK uses get_my_rol() which evaluates in row context
    - This causes RLS violations when admin updates other users
    - WITH CHECK should verify the CURRENT USER is still admin, not the target row
  
  2. Solution
    - Change WITH CHECK to use explicit auth.uid() check
    - Verify that the current authenticated user has admin role
    - This ensures the check is about who's making the change, not what's being changed
  
  3. Security
    - Maintains admin-only update access
    - Prevents privilege escalation
    - Allows admins to update any user's state
*/

-- Drop and recreate admin policy with corrected WITH CHECK
DROP POLICY IF EXISTS "Admins can update all users" ON usuarios;

CREATE POLICY "Admins can update all users"
  ON usuarios
  FOR UPDATE
  TO authenticated
  USING (
    -- Can see/update any user if I'm admin
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid()
        AND rol = 'Administrador'
        AND estado = 'activo'
        AND deleted_at IS NULL
    )
  )
  WITH CHECK (
    -- After update, the current user (me) must still be admin
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid()
        AND rol = 'Administrador'
        AND estado = 'activo'
        AND deleted_at IS NULL
    )
  );
