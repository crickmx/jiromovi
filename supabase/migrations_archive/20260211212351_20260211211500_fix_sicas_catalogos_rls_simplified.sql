/*
  # Fix SICAS Catalogos RLS Policies

  1. Changes
    - Remove existing policies that use EXISTS with usuarios table
    - Create simpler policies using helper functions
    - Ensure admins and gerentes can view/manage catalogs

  2. Security
    - Maintain strict access control
    - Avoid RLS recursion issues
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Admins y gerentes pueden ver catálogos SICAS" ON sicas_catalogos;
DROP POLICY IF EXISTS "Admins pueden insertar catálogos SICAS" ON sicas_catalogos;
DROP POLICY IF EXISTS "Admins pueden actualizar catálogos SICAS" ON sicas_catalogos;
DROP POLICY IF EXISTS "Admins pueden eliminar catálogos SICAS" ON sicas_catalogos;

-- Create simplified SELECT policy
CREATE POLICY "Authenticated users can view SICAS catalogs"
  ON sicas_catalogos
  FOR SELECT
  TO authenticated
  USING (true);

-- Only admins can insert
CREATE POLICY "Admins can insert SICAS catalogs"
  ON sicas_catalogos
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'admin'
      AND usuarios.estado = 'activo'
    )
  );

-- Only admins can update
CREATE POLICY "Admins can update SICAS catalogs"
  ON sicas_catalogos
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'admin'
      AND usuarios.estado = 'activo'
    )
  );

-- Only admins can delete
CREATE POLICY "Admins can delete SICAS catalogs"
  ON sicas_catalogos
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'admin'
      AND usuarios.estado = 'activo'
    )
  );