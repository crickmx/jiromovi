/*
  # Simplify UPDATE policies to allow admin updates

  1. Problem
    - Complex WITH CHECK clauses with subqueries cause RLS violations
    - PostgreSQL evaluates WITH CHECK in the context of the NEW row
    - This creates circular dependency issues
  
  2. Solution
    - Admin: No WITH CHECK needed - USING is sufficient for security
    - Gerente: Simple WITH CHECK to ensure row stays in same office
    - User: Simple WITH CHECK to prevent id changes
  
  3. Security
    - Admin USING ensures only admins can update
    - Once we verify admin status in USING, we trust the update
    - Gerente and User maintain their constraints
*/

-- Admin: Simple policy without complex WITH CHECK
DROP POLICY IF EXISTS "Admins can update all users" ON usuarios;

CREATE POLICY "Admins can update all users"
  ON usuarios
  FOR UPDATE
  TO authenticated
  USING (
    -- Only admins can perform updates
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
        AND u.rol = 'Administrador'
        AND u.estado = 'activo'
        AND u.deleted_at IS NULL
    )
  );
  -- NO WITH CHECK - if you're admin, you can update anything

-- Gerente: Ensure target stays in same office
DROP POLICY IF EXISTS "Gerentes can update office users" ON usuarios;

CREATE POLICY "Gerentes can update office users"
  ON usuarios
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios me
      WHERE me.id = auth.uid()
        AND me.rol = 'Gerente'
        AND me.estado = 'activo'
        AND me.deleted_at IS NULL
        AND me.oficina_id = usuarios.oficina_id
    )
  )
  WITH CHECK (
    -- Target user must remain in the same office as gerente
    oficina_id IN (
      SELECT oficina_id FROM usuarios WHERE id = auth.uid()
    )
  );

-- User: Can only update themselves
DROP POLICY IF EXISTS "Users can update own profile" ON usuarios;

CREATE POLICY "Users can update own profile"
  ON usuarios
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());
