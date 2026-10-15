/*
  # Fix usuarios RLS - no recursion, no CASE WHEN set-returning issue

  ## Problem
  - Previous CASE WHEN policy caused "set-returning functions are not allowed in WHERE"
  - Replacement with EXISTS subquery on usuarios caused infinite recursion (42P17)

  ## Fix
  Use get_current_user_rol() which is SECURITY DEFINER (bypasses RLS, no recursion)
  but restructure as OR conditions instead of CASE WHEN to avoid set-returning issue.
*/

DROP POLICY IF EXISTS "Admins can read all non-deleted users" ON usuarios;

CREATE POLICY "Admins can read all non-deleted users"
  ON usuarios
  FOR SELECT
  TO authenticated
  USING (
    (
      get_current_user_rol() = 'Administrador'
      AND (is_deleted = false OR is_deleted IS NULL)
    )
    OR
    (
      get_current_user_rol() != 'Administrador'
      AND estado = 'activo'
      AND (is_deleted = false OR is_deleted IS NULL)
    )
    OR
    id = auth.uid()
  );
