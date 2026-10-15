/*
  # Fix SICAS Mapeo Tables RLS Policies

  1. Changes
    - Remove duplicate and conflicting policies
    - Create simple, consistent policies
    - Allow authenticated users to view mappings
    - Only admins and gerentes can modify mappings

  2. Security
    - Maintain access control
    - Avoid recursion issues
*/

-- ============================================
-- sicas_mapeo_despacho_oficina
-- ============================================

-- Drop all existing policies
DROP POLICY IF EXISTS "Admins can manage despacho mappings" ON sicas_mapeo_despacho_oficina;
DROP POLICY IF EXISTS "Admins y gerentes pueden ver mapeos de despacho" ON sicas_mapeo_despacho_oficina;
DROP POLICY IF EXISTS "Admins y gerentes pueden crear mapeos de despacho" ON sicas_mapeo_despacho_oficina;
DROP POLICY IF EXISTS "Admins y gerentes pueden actualizar mapeos de despacho" ON sicas_mapeo_despacho_oficina;
DROP POLICY IF EXISTS "Admins y gerentes pueden eliminar mapeos de despacho" ON sicas_mapeo_despacho_oficina;
DROP POLICY IF EXISTS "Service role can manage despacho mappings" ON sicas_mapeo_despacho_oficina;

-- Create new simplified policies
CREATE POLICY "Authenticated users can view despacho mappings"
  ON sicas_mapeo_despacho_oficina
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins and gerentes can insert despacho mappings"
  ON sicas_mapeo_despacho_oficina
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol IN ('admin', 'gerente')
      AND usuarios.estado = 'activo'
    )
  );

CREATE POLICY "Admins and gerentes can update despacho mappings"
  ON sicas_mapeo_despacho_oficina
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol IN ('admin', 'gerente')
      AND usuarios.estado = 'activo'
    )
  );

CREATE POLICY "Admins and gerentes can delete despacho mappings"
  ON sicas_mapeo_despacho_oficina
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol IN ('admin', 'gerente')
      AND usuarios.estado = 'activo'
    )
  );

-- ============================================
-- sicas_mapeo_vendedor_usuario
-- ============================================

-- Drop all existing policies
DROP POLICY IF EXISTS "Admins can manage vendedor mappings" ON sicas_mapeo_vendedor_usuario;
DROP POLICY IF EXISTS "Admins y gerentes pueden ver mapeos de vendedor" ON sicas_mapeo_vendedor_usuario;
DROP POLICY IF EXISTS "Admins y gerentes pueden crear mapeos de vendedor" ON sicas_mapeo_vendedor_usuario;
DROP POLICY IF EXISTS "Admins y gerentes pueden actualizar mapeos de vendedor" ON sicas_mapeo_vendedor_usuario;
DROP POLICY IF EXISTS "Admins y gerentes pueden eliminar mapeos de vendedor" ON sicas_mapeo_vendedor_usuario;
DROP POLICY IF EXISTS "Service role can manage vendedor mappings" ON sicas_mapeo_vendedor_usuario;

-- Create new simplified policies
CREATE POLICY "Authenticated users can view vendedor mappings"
  ON sicas_mapeo_vendedor_usuario
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins and gerentes can insert vendedor mappings"
  ON sicas_mapeo_vendedor_usuario
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol IN ('admin', 'gerente')
      AND usuarios.estado = 'activo'
    )
  );

CREATE POLICY "Admins and gerentes can update vendedor mappings"
  ON sicas_mapeo_vendedor_usuario
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol IN ('admin', 'gerente')
      AND usuarios.estado = 'activo'
    )
  );

CREATE POLICY "Admins and gerentes can delete vendedor mappings"
  ON sicas_mapeo_vendedor_usuario
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol IN ('admin', 'gerente')
      AND usuarios.estado = 'activo'
    )
  );