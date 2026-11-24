/*
  # Fix Infinite Recursion in Usuarios RLS Policies

  1. Problem
    - Policies "Admins can view all users including deleted" and "Gerentes can view own office users"
    - Contain subqueries that SELECT from usuarios table
    - This creates infinite recursion when Postgres tries to evaluate policies

  2. Solution
    - Drop policies with recursive subqueries
    - Replace with policies using helper functions (get_current_user_role, get_current_user_office)
    - Helper functions bypass RLS to avoid recursion

  3. Changes
    - Drop: "Admins can view all users including deleted"
    - Drop: "Gerentes can view own office users"
    - Drop: "Administrators can delete users" (also has recursion)
    - Replace with non-recursive versions
*/

-- Drop problematic policies with recursion
DROP POLICY IF EXISTS "Admins can view all users including deleted" ON usuarios;
DROP POLICY IF EXISTS "Gerentes can view own office users" ON usuarios;
DROP POLICY IF EXISTS "Administrators can delete users" ON usuarios;

-- Create corrected policy for admin viewing all users (no recursion)
-- Admins already have "Admins view all users" policy using get_current_user_role()
-- So we don't need the "including deleted" one - they can see all anyway

-- Create corrected policy for gerentes viewing own office (no recursion)
CREATE POLICY "Gerentes can view own office users"
  ON usuarios
  FOR SELECT
  TO authenticated
  USING (
    (get_current_user_role() = 'Gerente') 
    AND (oficina_id = get_current_user_office())
    AND (is_deleted = false)
  );

-- Create corrected policy for admin deleting users (no recursion)
CREATE POLICY "Administrators can delete users"
  ON usuarios
  FOR DELETE
  TO authenticated
  USING (
    get_current_user_role() = 'Administrador'
  );

-- Add comment explaining helper functions prevent recursion
COMMENT ON FUNCTION get_current_user_role IS 'Gets current user role without RLS checks. CRITICAL: Must use SECURITY DEFINER to bypass RLS and prevent infinite recursion in policies.';

COMMENT ON FUNCTION get_current_user_office IS 'Gets current user office without RLS checks. CRITICAL: Must use SECURITY DEFINER to bypass RLS and prevent infinite recursion in policies.';
