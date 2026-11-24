/*
  # Fix GMM Quotations UPDATE Policy

  1. Changes
    - Remove conflicting UPDATE policies
    - Create single UPDATE policy that allows both normal updates and soft delete
    - Users can update their own quotations OR soft delete them

  2. Security
    - Maintains owner-only access
    - Allows setting deleted_at for soft delete
    - Prevents updating already deleted quotations
*/

-- Drop existing conflicting UPDATE policies
DROP POLICY IF EXISTS "Users can update own quotations" ON gmm_quotations;
DROP POLICY IF EXISTS "Users can soft delete own quotations" ON gmm_quotations;
DROP POLICY IF EXISTS "Users can delete own quotations" ON gmm_quotations;

-- Create single consolidated UPDATE policy
-- Allows users to update their own quotations (including setting deleted_at)
CREATE POLICY "Users can update and soft delete own quotations"
  ON gmm_quotations
  FOR UPDATE
  TO authenticated
  USING (
    usuario_id = auth.uid()
    AND deleted_at IS NULL  -- Can only update/delete non-deleted records
  )
  WITH CHECK (
    usuario_id = auth.uid()
    -- No restriction on deleted_at in WITH CHECK
    -- This allows both normal updates and setting deleted_at
  );