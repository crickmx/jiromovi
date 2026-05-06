/*
  # Fix crm_boards soft-delete failing with 403

  1. Problem
    - When updating deleted_at on crm_boards, the new row no longer passes the SELECT policy
      (which requires deleted_at IS NULL), causing PostgREST to reject the UPDATE
    - PostgREST checks that updated rows are still visible via SELECT policy

  2. Solution
    - Modify the UPDATE policy to include a WITH CHECK that allows setting deleted_at
    - The owner should be able to soft-delete their own board regardless of deleted_at state
    - Also adjust SELECT to allow owners to see their soft-deleted boards (needed for RETURNING)
*/

-- Fix: Allow owners to see their boards even if soft-deleted (for RETURNING clause)
DROP POLICY IF EXISTS "Users can view boards they own or are members of" ON crm_boards;
CREATE POLICY "Users can view boards they own or are members of"
  ON crm_boards
  FOR SELECT
  TO authenticated
  USING (
    (deleted_at IS NULL AND (owner_user_id = auth.uid() OR is_crm_board_member(id, auth.uid())))
    OR (owner_user_id = auth.uid())
  );

-- Recreate UPDATE policy ensuring owners can always update (including soft-delete)
DROP POLICY IF EXISTS "Owners and admins can update boards" ON crm_boards;
CREATE POLICY "Owners and admins can update boards"
  ON crm_boards
  FOR UPDATE
  TO authenticated
  USING (
    owner_user_id = auth.uid()
    OR is_crm_board_admin(id, auth.uid())
  )
  WITH CHECK (
    owner_user_id = auth.uid()
    OR is_crm_board_admin(id, auth.uid())
  );
