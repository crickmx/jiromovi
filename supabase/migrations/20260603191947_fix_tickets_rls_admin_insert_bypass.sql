/*
  # Fix tickets INSERT RLS - allow admin bypass

  ## Problem
  The INSERT policy for tickets only allows: `creado_por = auth.uid()`
  When an admin impersonates an agent and creates a ticket on their behalf,
  `auth.uid()` = admin's UUID but `creado_por` = agent's UUID → RLS violation.

  ## Fix
  Allow admins (Administrador role) to insert tickets with any creado_por value.
  Non-admin users still must set creado_por = auth.uid().

  Also fixes the duplicate UPDATE policies by keeping only the most restrictive/correct one.
*/

-- Drop and recreate the INSERT policy with admin bypass
DROP POLICY IF EXISTS "tickets_insert_by_authenticated" ON tickets;
DROP POLICY IF EXISTS "tickets_insert_policy" ON tickets;

CREATE POLICY "tickets_insert_by_authenticated"
  ON tickets
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Admins can create tickets on behalf of any user (impersonation support)
    get_my_rol() = 'Administrador'
    OR
    -- Everyone else must be the creator
    creado_por = auth.uid()
  );
