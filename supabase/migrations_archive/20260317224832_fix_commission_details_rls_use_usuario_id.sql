/*
  # Fix Commission Details RLS to Use usuario_id

  1. Changes
    - Drop old policy that uses commission_agents and agent_id
    - Create new policy that uses usuario_id directly
    - Agents can only view their own commission details from closed batches

  2. Security
    - Ensures agents can only see their own commissions
    - Maintains admin access for all commissions
*/

-- Drop old policy that uses commission_agents
DROP POLICY IF EXISTS "Agents view own commissions" ON commission_details;

-- Create new policy using usuario_id
CREATE POLICY "Agents view own commissions"
  ON commission_details FOR SELECT
  TO authenticated
  USING (
    -- Allow if this is the user's own commission from a closed batch
    usuario_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM commission_batches cb
      WHERE cb.id = commission_details.batch_id
      AND cb.status = 'closed'
    )
  );
