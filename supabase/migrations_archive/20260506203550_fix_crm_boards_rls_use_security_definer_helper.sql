/*
  # Fix infinite recursion in CRM boards/members RLS using SECURITY DEFINER helper

  1. Problem
    - Self-referencing policies on crm_board_members cause infinite recursion
    - Any policy that queries crm_board_members triggers its own SELECT policy evaluation recursively

  2. Solution
    - Create a SECURITY DEFINER function that checks board membership without RLS
    - Use this function in all policies instead of subqueries that trigger RLS evaluation
    - This breaks the recursion cycle completely

  3. Security
    - The helper function only returns a boolean (is user a member / owner / admin)
    - It cannot be used to extract data from the table
    - All policies still enforce proper access control
*/

-- Create helper function to check if a user is a member of a board (bypasses RLS)
CREATE OR REPLACE FUNCTION public.is_crm_board_member(p_board_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM crm_board_members
    WHERE board_id = p_board_id AND user_id = p_user_id
  );
$$;

-- Create helper to check if user is owner/admin of a board (bypasses RLS)
CREATE OR REPLACE FUNCTION public.is_crm_board_admin(p_board_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM crm_board_members
    WHERE board_id = p_board_id
      AND user_id = p_user_id
      AND member_role = ANY (ARRAY['owner', 'admin'])
  );
$$;

-- ============================================
-- Fix crm_board_members policies
-- ============================================

DROP POLICY IF EXISTS "Users can view members of accessible boards" ON crm_board_members;
CREATE POLICY "Users can view members of accessible boards"
  ON crm_board_members
  FOR SELECT
  TO authenticated
  USING (
    is_crm_board_member(board_id, auth.uid())
  );

DROP POLICY IF EXISTS "Owners and admins can add members" ON crm_board_members;
CREATE POLICY "Owners and admins can add members"
  ON crm_board_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    is_crm_board_admin(board_id, auth.uid())
  );

DROP POLICY IF EXISTS "Owners and admins can remove members" ON crm_board_members;
CREATE POLICY "Owners and admins can remove members"
  ON crm_board_members
  FOR DELETE
  TO authenticated
  USING (
    is_crm_board_admin(board_id, auth.uid())
  );

DROP POLICY IF EXISTS "Owners and admins can update member roles" ON crm_board_members;
CREATE POLICY "Owners and admins can update member roles"
  ON crm_board_members
  FOR UPDATE
  TO authenticated
  USING (
    is_crm_board_admin(board_id, auth.uid())
  )
  WITH CHECK (true);

-- ============================================
-- Fix crm_boards policies that reference crm_board_members
-- ============================================

DROP POLICY IF EXISTS "Users can view boards they own or are members of" ON crm_boards;
CREATE POLICY "Users can view boards they own or are members of"
  ON crm_boards
  FOR SELECT
  TO authenticated
  USING (
    deleted_at IS NULL
    AND (
      owner_user_id = auth.uid()
      OR is_crm_board_member(id, auth.uid())
    )
  );

DROP POLICY IF EXISTS "Owners and admins can update boards" ON crm_boards;
CREATE POLICY "Owners and admins can update boards"
  ON crm_boards
  FOR UPDATE
  TO authenticated
  USING (
    owner_user_id = auth.uid()
    OR is_crm_board_admin(id, auth.uid())
  )
  WITH CHECK (true);

-- Keep the soft-delete policy (owner only, no subquery needed)
DROP POLICY IF EXISTS "Only owners can soft delete boards" ON crm_boards;
