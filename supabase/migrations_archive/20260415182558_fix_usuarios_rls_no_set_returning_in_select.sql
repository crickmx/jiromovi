/*
  # Fix usuarios SELECT policy - eliminate set-returning function error

  ## Problem
  get_current_user_rol() internally does SELECT FROM usuarios, which when called
  inside a SELECT policy on usuarios during a JOIN, triggers the PostgreSQL error:
  "set-returning functions are not allowed in WHERE"

  ## Fix
  Use a SECURITY DEFINER function that reads from a separate auth structure,
  or simply split the policy so the SELECT always returns rows and rely on the
  "users can only see active users OR own row" logic without calling usuarios recursively.

  Strategy: use a materialized/cached approach via a helper that uses auth.jwt() claims
  if available, otherwise fall back to a direct query with SECURITY DEFINER that
  PostgreSQL can optimize away from the recursive context.

  Simplest safe fix: drop the role-based separation for SELECT and allow all
  authenticated users to see active+non-deleted users OR their own row.
  Admins seeing inactive users is handled by a separate permissive policy using
  a stable SECURITY DEFINER function that PostgreSQL won't treat as set-returning.
*/

DROP POLICY IF EXISTS "Admins can read all non-deleted users" ON usuarios;

CREATE OR REPLACE FUNCTION public.current_user_is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM usuarios
    WHERE id = auth.uid()
      AND rol = 'Administrador'
      AND deleted_at IS NULL
  );
$$;

CREATE POLICY "Authenticated users see active users or own row"
  ON usuarios
  FOR SELECT
  TO authenticated
  USING (
    (
      (is_deleted = false OR is_deleted IS NULL)
      AND estado = 'activo'
    )
    OR id = auth.uid()
  );

CREATE POLICY "Admins also see inactive non-deleted users"
  ON usuarios
  FOR SELECT
  TO authenticated
  USING (
    current_user_is_admin() = true
    AND (is_deleted = false OR is_deleted IS NULL)
  );
