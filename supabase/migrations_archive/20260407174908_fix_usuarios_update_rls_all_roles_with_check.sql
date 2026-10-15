/*
  # Fix all UPDATE policies WITH CHECK clauses

  1. Problem
    - WITH CHECK clauses were using helper functions that evaluate in row context
    - This causes RLS violations when updating other users
    - WITH CHECK should verify the CURRENT USER's permissions, not the target row
  
  2. Solution
    - Gerente: Verify current user is gerente AND target row stays in same office
    - User: Verify current user is updating themselves
  
  3. Security
    - Maintains role-based access control
    - Prevents privilege escalation
    - Allows proper updates within permission boundaries
*/

-- Drop and recreate gerente policy
DROP POLICY IF EXISTS "Gerentes can update office users" ON usuarios;

CREATE POLICY "Gerentes can update office users"
  ON usuarios
  FOR UPDATE
  TO authenticated
  USING (
    -- Can see/update users in my office if I'm gerente
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
    -- After update: I must still be gerente AND target user stays in my office
    EXISTS (
      SELECT 1 FROM usuarios me
      WHERE me.id = auth.uid()
        AND me.rol = 'Gerente'
        AND me.estado = 'activo'
        AND me.deleted_at IS NULL
        AND me.oficina_id = usuarios.oficina_id
    )
  );

-- Drop and recreate user self-update policy
DROP POLICY IF EXISTS "Users can update own profile" ON usuarios;

CREATE POLICY "Users can update own profile"
  ON usuarios
  FOR UPDATE
  TO authenticated
  USING (
    -- Can see/update myself
    id = auth.uid()
  )
  WITH CHECK (
    -- After update, must still be myself (can't change id)
    id = auth.uid()
  );
