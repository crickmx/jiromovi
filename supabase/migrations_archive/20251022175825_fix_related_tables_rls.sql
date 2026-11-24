/*
  # Fix RLS Policies for Related Tables

  1. Problem
    - Other tables (oficinas, documentos, etc.) have policies that query usuarios table
    - These also cause recursion issues
    
  2. Solution
    - Simplify policies to avoid subqueries to usuarios
    - Rely on application-level role checks
    - Keep policies simple and non-recursive

  3. Changes
    - Update oficinas policies
    - Update documentos_usuarios policies
    - Update esquemas_pago policies
*/

-- Fix oficinas policies
DROP POLICY IF EXISTS "Admins and Gerentes can view offices" ON oficinas;
DROP POLICY IF EXISTS "Admins can view all offices" ON oficinas;
DROP POLICY IF EXISTS "Admins can insert offices" ON oficinas;
DROP POLICY IF EXISTS "Admins can update offices" ON oficinas;
DROP POLICY IF EXISTS "Admins can delete offices" ON oficinas;

CREATE POLICY "Authenticated users can view offices"
  ON oficinas FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage offices"
  ON oficinas FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Fix documentos_usuarios policies
DROP POLICY IF EXISTS "Admins and Gerentes can view documents" ON documentos_usuarios;
DROP POLICY IF EXISTS "Admins can view all documents" ON documentos_usuarios;
DROP POLICY IF EXISTS "Users can view own documents" ON documentos_usuarios;
DROP POLICY IF EXISTS "Admins and Gerentes can insert documents" ON documentos_usuarios;
DROP POLICY IF EXISTS "Admins can insert documents" ON documentos_usuarios;
DROP POLICY IF EXISTS "Users can insert own documents" ON documentos_usuarios;
DROP POLICY IF EXISTS "Admins and Gerentes can update documents" ON documentos_usuarios;
DROP POLICY IF EXISTS "Admins can update documents" ON documentos_usuarios;
DROP POLICY IF EXISTS "Users can update own documents" ON documentos_usuarios;
DROP POLICY IF EXISTS "Admins and Gerentes can delete documents" ON documentos_usuarios;
DROP POLICY IF EXISTS "Admins can delete documents" ON documentos_usuarios;
DROP POLICY IF EXISTS "Users can delete own documents" ON documentos_usuarios;

CREATE POLICY "Users can view own documents"
  ON documentos_usuarios FOR SELECT
  TO authenticated
  USING (usuario_id = auth.uid());

CREATE POLICY "All authenticated can view documents"
  ON documentos_usuarios FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can manage own documents"
  ON documentos_usuarios FOR ALL
  TO authenticated
  USING (usuario_id = auth.uid())
  WITH CHECK (usuario_id = auth.uid());

CREATE POLICY "Authenticated users can manage all documents"
  ON documentos_usuarios FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Fix esquemas_pago policies
DROP POLICY IF EXISTS "Authenticated users can view payment schemes" ON esquemas_pago;
DROP POLICY IF EXISTS "Admins can insert payment schemes" ON esquemas_pago;
DROP POLICY IF EXISTS "Admins can update payment schemes" ON esquemas_pago;
DROP POLICY IF EXISTS "Admins can delete payment schemes" ON esquemas_pago;

CREATE POLICY "All can view payment schemes"
  ON esquemas_pago FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated can manage payment schemes"
  ON esquemas_pago FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
