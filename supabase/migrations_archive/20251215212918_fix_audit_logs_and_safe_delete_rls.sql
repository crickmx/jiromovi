/*
  # Fix Audit Logs RLS and Safe Delete Function

  1. Problem
    - Policy "Admins can view all audit logs" has recursive subquery on usuarios table
    - This causes infinite recursion when checking policies
    - safe_delete_user function may be blocked by RLS

  2. Solution
    - Drop recursive policy on audit_logs
    - Replace with policy using get_current_user_role() helper
    - Ensure SECURITY DEFINER functions can bypass RLS correctly

  3. Changes
    - Drop: "Admins can view all audit logs" (has recursion)
    - Create: New non-recursive admin SELECT policy
    - Verify: INSERT policy allows system functions
*/

-- Drop recursive policy
DROP POLICY IF EXISTS "Admins can view all audit logs" ON audit_logs;

-- Create non-recursive version using helper function
CREATE POLICY "Admins can view all audit logs"
  ON audit_logs
  FOR SELECT
  TO authenticated
  USING (
    get_current_user_role() = 'Administrador'
  );

-- Ensure the INSERT policy is correct (should already exist but let's verify)
DROP POLICY IF EXISTS "System can insert audit logs" ON audit_logs;

CREATE POLICY "System can insert audit logs"
  ON audit_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Add comment explaining the RLS bypass for SECURITY DEFINER
COMMENT ON FUNCTION safe_delete_user IS 'Soft deletes a user and creates audit log. Uses SECURITY DEFINER to bypass RLS policies and ensure proper access to usuarios and audit_logs tables.';
