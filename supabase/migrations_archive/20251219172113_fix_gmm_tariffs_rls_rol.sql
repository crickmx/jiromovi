/*
  # Fix GMM Tariffs RLS Policies

  1. Changes
    - Update RLS policies to use 'Administrador' instead of 'admin'
    - Allow admins to view all tariff packages (not just active ones)
    - Allow admins to manage tariff tables

  2. Security
    - Admins can view and manage all tariffs
    - Regular users can only view active tariffs
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Admin can manage tariff packages" ON tariff_packages;
DROP POLICY IF EXISTS "Users can view active tariff packages" ON tariff_packages;
DROP POLICY IF EXISTS "Admin can manage tariff tables" ON tariff_tables;
DROP POLICY IF EXISTS "Users can view active tariff tables" ON tariff_tables;

-- Recreate policies with correct role name
CREATE POLICY "Admin can manage tariff packages"
  ON tariff_packages
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

CREATE POLICY "Admin can view all tariff packages"
  ON tariff_packages
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

CREATE POLICY "Users can view active tariff packages"
  ON tariff_packages
  FOR SELECT
  TO authenticated
  USING (status = 'active');

CREATE POLICY "Admin can manage tariff tables"
  ON tariff_tables
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

CREATE POLICY "Users can view active tariff tables"
  ON tariff_tables
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tariff_packages
      WHERE tariff_packages.id = tariff_tables.tariff_package_id
      AND tariff_packages.status = 'active'
    )
  );
