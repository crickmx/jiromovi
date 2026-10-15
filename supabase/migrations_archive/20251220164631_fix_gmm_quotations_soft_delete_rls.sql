/*
  # Fix GMM Quotations Soft Delete RLS

  1. Changes
    - Separate UPDATE policy into two: one for normal updates, one for soft delete
    - Remove WITH CHECK restriction on soft delete to allow marking as deleted
    - Ensure users can only soft delete their own quotations

  2. Security
    - Users can update their own non-deleted quotations
    - Users can soft delete their own non-deleted quotations
    - All operations remain secure and scoped to user's own data
*/

-- Drop existing update policy
DROP POLICY IF EXISTS "Users can update own quotations" ON gmm_quotations;

-- Policy: Users can update their own quotations (except deleted_at field)
CREATE POLICY "Users can update own quotations"
  ON gmm_quotations
  FOR UPDATE
  TO authenticated
  USING (
    usuario_id = auth.uid()
    AND deleted_at IS NULL
  )
  WITH CHECK (
    usuario_id = auth.uid()
    AND deleted_at IS NULL
  );

-- Policy: Users can soft delete their own quotations (set deleted_at)
CREATE POLICY "Users can soft delete own quotations"
  ON gmm_quotations
  FOR UPDATE
  TO authenticated
  USING (
    usuario_id = auth.uid()
    AND deleted_at IS NULL
  )
  WITH CHECK (
    usuario_id = auth.uid()
    -- No restriction on deleted_at in WITH CHECK to allow setting it
  );
