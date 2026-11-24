/*
  # Fix login RLS policies for oficinas

  1. Changes
    - Add simple policy to allow authenticated users to view their own office
    - This prevents RLS recursion during login when fetchUsuario runs
  
  2. Security
    - Users can only see their own office via the oficina_id in usuarios
    - More permissive policies still require active status checks
*/

-- Drop if exists, then create
DROP POLICY IF EXISTS "Users can view own office" ON oficinas;

CREATE POLICY "Users can view own office"
  ON oficinas
  FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT oficina_id 
      FROM usuarios 
      WHERE id = auth.uid()
    )
  );
