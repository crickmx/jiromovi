/*
  # Restrict Publicidad Plantillas to Admins Only

  1. Changes
    - Drop existing policies
    - Only Administradores can create, update, and delete plantillas
    - All authenticated users can view active plantillas
    - All users can create their own personalized designs (publicidad_disenos)

  2. Security
    - Only Admins can manage plantillas
    - All users can view and use active plantillas for their designs
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Admins and Gerentes can create plantillas" ON publicidad_plantillas;
DROP POLICY IF EXISTS "Admins and Gerentes can update plantillas" ON publicidad_plantillas;
DROP POLICY IF EXISTS "Admins and Gerentes can delete plantillas" ON publicidad_plantillas;
DROP POLICY IF EXISTS "All users can view active plantillas" ON publicidad_plantillas;

-- Create new policies - ADMIN ONLY
CREATE POLICY "Only admins can create plantillas"
  ON publicidad_plantillas
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

CREATE POLICY "Only admins can update plantillas"
  ON publicidad_plantillas
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

CREATE POLICY "Only admins can delete plantillas"
  ON publicidad_plantillas
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

CREATE POLICY "All users can view active plantillas"
  ON publicidad_plantillas
  FOR SELECT
  TO authenticated
  USING (
    activa = true
    OR created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );