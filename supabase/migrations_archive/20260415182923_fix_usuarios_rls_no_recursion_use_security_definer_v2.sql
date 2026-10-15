/*
  # Fix usuarios RLS - eliminate ALL recursive/set-returning calls

  ## Problem
  Any function or subquery that reads FROM usuarios inside a usuarios SELECT policy
  causes "set-returning functions are not allowed in WHERE" when the table is
  accessed via a JOIN (e.g. ticket_comentarios?select=*,usuario:usuario_id(...)).

  ## Solution
  - Remove "Admins also see inactive non-deleted users" which calls current_user_is_admin()
    (which itself queries usuarios)
  - Use a single simple policy that does NOT query usuarios at all
  - Admin visibility of inactive users is handled client-side by filtering or
    via a separate RPC/view approach
  - The UPDATE policies with EXISTS(SELECT FROM usuarios u WHERE u.id = auth.uid())
    are OK because they only run on UPDATE, not SELECT JOINs
*/

-- Drop the problematic admin policy that causes recursion via current_user_is_admin()
DROP POLICY IF EXISTS "Admins also see inactive non-deleted users" ON usuarios;

-- Drop and recreate the main SELECT policy to be purely simple (no subqueries into usuarios)
DROP POLICY IF EXISTS "Authenticated users see active users or own row" ON usuarios;

CREATE POLICY "Authenticated users see active users or own row"
  ON usuarios
  FOR SELECT
  TO authenticated
  USING (
    (
      (is_deleted = false OR is_deleted IS NULL)
      AND (estado = 'activo' OR estado = 'inactivo' OR estado = 'pendiente')
    )
    OR id = auth.uid()
  );
