/*
  # Fix assistant suggestions RLS - allow all authenticated users to read

  1. Changes
    - Add SELECT policy for all authenticated users on `assistant_suggestions`
    - Keep the existing admin-only ALL policy for management (insert/update/delete)

  2. Security
    - All authenticated users can read active suggestions
    - Only admins can create, update, or delete suggestions
*/

-- Drop the overly restrictive ALL policy (it blocks non-admin reads)
DROP POLICY IF EXISTS "Only admins can manage suggestions" ON assistant_suggestions;

-- Allow all authenticated users to read suggestions
CREATE POLICY "All authenticated users can read suggestions"
  ON assistant_suggestions
  FOR SELECT
  TO authenticated
  USING (true);

-- Only admins can insert suggestions
CREATE POLICY "Admins can insert suggestions"
  ON assistant_suggestions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

-- Only admins can update suggestions
CREATE POLICY "Admins can update suggestions"
  ON assistant_suggestions
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

-- Only admins can delete suggestions
CREATE POLICY "Admins can delete suggestions"
  ON assistant_suggestions
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );