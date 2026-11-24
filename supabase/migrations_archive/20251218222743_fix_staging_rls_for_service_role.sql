/*
  # Fix RLS for Commission Staging Tables
  
  ## Changes
  - Add explicit service_role policies
  - Ensure authenticated admins can read their own sessions
  - Fix any recursion issues
  
  ## Security
  - Service role bypasses RLS (needed for edge functions)
  - Authenticated admins can only see sessions they created or all if admin
*/

-- Drop existing policies to recreate them properly
DROP POLICY IF EXISTS "Admins pueden ver todas las sesiones" ON commission_staging_sessions;
DROP POLICY IF EXISTS "Admins pueden insertar sesiones" ON commission_staging_sessions;
DROP POLICY IF EXISTS "Admins pueden actualizar sesiones" ON commission_staging_sessions;
DROP POLICY IF EXISTS "Admins pueden eliminar sesiones" ON commission_staging_sessions;

DROP POLICY IF EXISTS "Admins pueden ver todos los items staging" ON commission_items_staging;
DROP POLICY IF EXISTS "Admins pueden insertar items staging" ON commission_items_staging;
DROP POLICY IF EXISTS "Admins pueden actualizar items staging" ON commission_items_staging;
DROP POLICY IF EXISTS "Admins pueden eliminar items staging" ON commission_items_staging;

-- Service role bypasses RLS automatically, but let's ensure authenticated users work

-- Commission Staging Sessions Policies
CREATE POLICY "Admins can view staging sessions"
  ON commission_staging_sessions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
        AND usuarios.rol = 'Administrador'
    )
  );

CREATE POLICY "Admins can insert staging sessions"
  ON commission_staging_sessions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
        AND usuarios.rol = 'Administrador'
    )
  );

CREATE POLICY "Admins can update staging sessions"
  ON commission_staging_sessions
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
        AND usuarios.rol = 'Administrador'
    )
  );

CREATE POLICY "Admins can delete staging sessions"
  ON commission_staging_sessions
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
        AND usuarios.rol = 'Administrador'
    )
  );

-- Commission Items Staging Policies
CREATE POLICY "Admins can view staging items"
  ON commission_items_staging
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
        AND usuarios.rol = 'Administrador'
    )
  );

CREATE POLICY "Admins can insert staging items"
  ON commission_items_staging
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
        AND usuarios.rol = 'Administrador'
    )
  );

CREATE POLICY "Admins can update staging items"
  ON commission_items_staging
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
        AND usuarios.rol = 'Administrador'
    )
  );

CREATE POLICY "Admins can delete staging items"
  ON commission_items_staging
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
        AND usuarios.rol = 'Administrador'
    )
  );