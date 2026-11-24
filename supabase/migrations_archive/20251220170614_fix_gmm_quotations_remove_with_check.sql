/*
  # Fix GMM Quotations - Remove WITH CHECK restriction

  1. Problem
    - WITH CHECK clause may be causing FK verification issues during UPDATE
    - PostgreSQL evaluates WITH CHECK after triggers, which can cause conflicts
    
  2. Solution
    - Keep USING for row selection (ensures user owns the record)
    - Remove WITH CHECK entirely (trust that USING already validated ownership)
    - Since USING validates usuario_id = auth.uid(), we don't need WITH CHECK
    
  3. Security
    - USING ensures only owner can update
    - No security is lost by removing WITH CHECK in this case
*/

-- Drop existing policy
DROP POLICY IF EXISTS "Users can update and soft delete own quotations" ON gmm_quotations;

-- Create new policy with only USING, no WITH CHECK
CREATE POLICY "Users can update and soft delete own quotations"
  ON gmm_quotations
  FOR UPDATE
  TO authenticated
  USING (usuario_id = auth.uid());
  -- No WITH CHECK clause at all
