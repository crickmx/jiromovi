/*
  # Fix usuarios RLS policy - replace CASE WHEN with OR conditions

  ## Problem
  The "Admins can read all non-deleted users" policy uses CASE WHEN with get_current_user_rol()
  which causes "set-returning functions are not allowed in WHERE" error when usuarios is
  joined in a PostgREST SELECT (e.g., ticket_comentarios with usuario:usuario_id join).

  ## Fix
  Replace the CASE WHEN structure with explicit OR conditions using EXISTS subqueries,
  which are safe to use in RLS policies.
*/

DROP POLICY IF EXISTS "Admins can read all non-deleted users" ON usuarios;

CREATE POLICY "Admins can read all non-deleted users"
  ON usuarios
  FOR SELECT
  TO authenticated
  USING (
    (
      EXISTS (
        SELECT 1 FROM usuarios u
        WHERE u.id = auth.uid()
          AND u.rol = 'Administrador'
          AND u.deleted_at IS NULL
      )
      AND (is_deleted = false OR is_deleted IS NULL)
    )
    OR
    (
      (estado = 'activo')
      AND (is_deleted = false OR is_deleted IS NULL)
    )
    OR
    (id = auth.uid())
  );
