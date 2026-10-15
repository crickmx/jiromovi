/*
  # Fix SICAS Mapeo Tables RLS Policies

  1. Changes
    - Allow admins and gerentes to view and manage mappings
    - Simplify RLS policies for better performance

  2. Security
    - Restrict access to admins and gerentes only
    - Allow full CRUD operations for authorized roles
*/

-- Fix sicas_mapeo_despacho_oficina policies
DROP POLICY IF EXISTS "Allow admins and gerentes full access to despacho mappings" ON sicas_mapeo_despacho_oficina;
DROP POLICY IF EXISTS "Admin and gerente can manage despacho mappings" ON sicas_mapeo_despacho_oficina;
DROP POLICY IF EXISTS "Admin and gerente can view despacho mappings" ON sicas_mapeo_despacho_oficina;

CREATE POLICY "Allow admins and gerentes full access to despacho mappings"
  ON sicas_mapeo_despacho_oficina
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol IN ('admin', 'gerente')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol IN ('admin', 'gerente')
    )
  );

-- Fix sicas_mapeo_vendedor_usuario policies
DROP POLICY IF EXISTS "Allow admins and gerentes full access to vendedor mappings" ON sicas_mapeo_vendedor_usuario;
DROP POLICY IF EXISTS "Admin and gerente can manage vendedor mappings" ON sicas_mapeo_vendedor_usuario;
DROP POLICY IF EXISTS "Admin and gerente can view vendedor mappings" ON sicas_mapeo_vendedor_usuario;

CREATE POLICY "Allow admins and gerentes full access to vendedor mappings"
  ON sicas_mapeo_vendedor_usuario
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol IN ('admin', 'gerente')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol IN ('admin', 'gerente')
    )
  );

-- Fix sicas_despachos RLS policies
DROP POLICY IF EXISTS "Allow admins and gerentes to view despachos" ON sicas_despachos;

CREATE POLICY "Allow admins and gerentes to view despachos"
  ON sicas_despachos
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol IN ('admin', 'gerente')
    )
  );

CREATE POLICY "Allow admins and gerentes to update despachos"
  ON sicas_despachos
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol IN ('admin', 'gerente')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol IN ('admin', 'gerente')
    )
  );
