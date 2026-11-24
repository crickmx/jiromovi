/*
  # Fix crm_board_members RLS - remove all cross-table references to crm_boards

  1. Problem
    - Even after the previous fix, crm_board_members SELECT policy still references crm_boards
    - This can still cause circular recursion when crm_boards SELECT references crm_board_members

  2. Solution
    - crm_board_members policies must ONLY self-reference (with aliases) and never query crm_boards
    - A user can see/manage members if they themselves are a member of the same board
    - Board ownership is already tracked via a member_role='owner' entry in crm_board_members

  3. Security
    - Users can only see members of boards where they are also a member
    - Only owners/admins can modify membership
*/

-- Drop and recreate SELECT policy without any crm_boards reference
DROP POLICY IF EXISTS "Users can view members of accessible boards" ON crm_board_members;

CREATE POLICY "Users can view members of accessible boards"
  ON crm_board_members
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM crm_board_members AS my_m
      WHERE my_m.board_id = crm_board_members.board_id
        AND my_m.user_id = auth.uid()
    )
  );

-- Drop and recreate DELETE policy without crm_boards reference
DROP POLICY IF EXISTS "Owners and admins can remove members" ON crm_board_members;

CREATE POLICY "Owners and admins can remove members"
  ON crm_board_members
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM crm_board_members AS my_m
      WHERE my_m.board_id = crm_board_members.board_id
        AND my_m.user_id = auth.uid()
        AND my_m.member_role = ANY (ARRAY['owner'::text, 'admin'::text])
    )
  );

-- Drop and recreate UPDATE policy without crm_boards reference
DROP POLICY IF EXISTS "Owners and admins can update member roles" ON crm_board_members;

CREATE POLICY "Owners and admins can update member roles"
  ON crm_board_members
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM crm_board_members AS my_m
      WHERE my_m.board_id = crm_board_members.board_id
        AND my_m.user_id = auth.uid()
        AND my_m.member_role = ANY (ARRAY['owner'::text, 'admin'::text])
    )
  )
  WITH CHECK (true);
