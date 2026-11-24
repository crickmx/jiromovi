/*
  # Fix correo_configuracion RLS policies
  
  1. Changes
    - Drop existing policies that reference non-existent user_roles
    - Create new policies using usuarios table directly
    - Allow administrators to manage email configuration
  
  2. Security
    - Only administrators can insert, update, delete email configuration
    - Only administrators can view email configuration
*/

-- Drop existing policy
DROP POLICY IF EXISTS "Admins can manage correo_configuracion" ON correo_configuracion;

-- Create separate policies for each operation
CREATE POLICY "Admins can view correo_configuracion"
  ON correo_configuracion
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

CREATE POLICY "Admins can insert correo_configuracion"
  ON correo_configuracion
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

CREATE POLICY "Admins can update correo_configuracion"
  ON correo_configuracion
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

CREATE POLICY "Admins can delete correo_configuracion"
  ON correo_configuracion
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );
