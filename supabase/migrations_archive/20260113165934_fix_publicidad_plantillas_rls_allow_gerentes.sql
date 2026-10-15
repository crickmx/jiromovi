/*
  # Fix Publicidad Plantillas RLS - Allow Gerentes

  1. Changes
    - Drop existing restrictive policies
    - Allow both Administrador and Gerente to create, update, and delete plantillas
    - Ensure all authenticated users can view active plantillas

  2. Security
    - Admins and Gerentes can fully manage plantillas
    - All users can view active plantillas
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Admins can create plantillas" ON publicidad_plantillas;
DROP POLICY IF EXISTS "Admins can update plantillas" ON publicidad_plantillas;
DROP POLICY IF EXISTS "Admins can delete plantillas" ON publicidad_plantillas;
DROP POLICY IF EXISTS "All users can view active plantillas" ON publicidad_plantillas;

-- Create new policies allowing both Administrador and Gerente
CREATE POLICY "Admins and Gerentes can create plantillas"
  ON publicidad_plantillas
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol IN ('Administrador', 'Gerente')
    )
  );

CREATE POLICY "Admins and Gerentes can update plantillas"
  ON publicidad_plantillas
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol IN ('Administrador', 'Gerente')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol IN ('Administrador', 'Gerente')
    )
  );

CREATE POLICY "Admins and Gerentes can delete plantillas"
  ON publicidad_plantillas
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol IN ('Administrador', 'Gerente')
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
      AND usuarios.rol IN ('Administrador', 'Gerente')
    )
  );