/*
  # Fix Commission Fiscal Regimes RLS Policies

  1. Changes
    - Drop existing restrictive RLS policies on commission_fiscal_regimes
    - Create simple read policy for all authenticated users (catalog table)
    - Create write policy for admins only
  
  2. Security
    - All authenticated users can read fiscal regimes (catalog data)
    - Only admins can modify fiscal regimes
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Admins manage fiscal regimes" ON commission_fiscal_regimes;
DROP POLICY IF EXISTS "Users view fiscal regimes" ON commission_fiscal_regimes;

-- Create simple read policy for all authenticated users
CREATE POLICY "All authenticated users can view fiscal regimes"
  ON commission_fiscal_regimes FOR SELECT
  TO authenticated
  USING (true);

-- Create write policies for admins only
CREATE POLICY "Admins can insert fiscal regimes"
  ON commission_fiscal_regimes FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
      AND usuarios.activo = true
      AND usuarios.is_deleted = false
    )
  );

CREATE POLICY "Admins can update fiscal regimes"
  ON commission_fiscal_regimes FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
      AND usuarios.activo = true
      AND usuarios.is_deleted = false
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
      AND usuarios.activo = true
      AND usuarios.is_deleted = false
    )
  );

CREATE POLICY "Admins can delete fiscal regimes"
  ON commission_fiscal_regimes FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
      AND usuarios.activo = true
      AND usuarios.is_deleted = false
    )
  );