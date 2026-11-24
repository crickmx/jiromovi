/*
  # Fix Publicidad Plantillas RLS Policies
  
  1. Changes
    - Drop existing policies
    - Create new policies that check rol from usuarios table instead of app_metadata
    - Ensure admins can update and delete plantillas
    
  2. Security
    - Admins can create, update, and delete plantillas
    - All authenticated users can view active plantillas
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Solo admin puede crear plantillas" ON publicidad_plantillas;
DROP POLICY IF EXISTS "Solo admin puede actualizar plantillas" ON publicidad_plantillas;
DROP POLICY IF EXISTS "Solo admin puede eliminar plantillas" ON publicidad_plantillas;
DROP POLICY IF EXISTS "Todos pueden ver plantillas activas" ON publicidad_plantillas;

-- Create new policies with correct rol check
CREATE POLICY "Admins can create plantillas"
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

CREATE POLICY "Admins can update plantillas"
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

CREATE POLICY "Admins can delete plantillas"
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
  USING (activa = true);
