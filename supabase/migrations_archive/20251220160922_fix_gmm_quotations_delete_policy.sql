/*
  # Fix GMM Quotations Delete Policy

  1. Changes
    - Remove conflicting "Users can delete own quotations" policy
    - Update "Users can update own quotations" policy to allow soft delete
    - Simplify RLS policies to avoid WITH CHECK conflicts

  2. Security
    - Users can still soft delete their own quotations
    - All operations remain secure and scoped to user's own data
*/

-- Drop the conflicting delete policy
DROP POLICY IF EXISTS "Users can delete own quotations" ON gmm_quotations;

-- Drop and recreate the update policy to allow soft delete
DROP POLICY IF EXISTS "Users can update own quotations" ON gmm_quotations;

CREATE POLICY "Users can update own quotations"
  ON gmm_quotations
  FOR UPDATE
  TO authenticated
  USING (usuario_id = auth.uid())
  WITH CHECK (usuario_id = auth.uid());
