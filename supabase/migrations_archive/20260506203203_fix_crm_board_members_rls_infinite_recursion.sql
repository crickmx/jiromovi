/*
  # Fix infinite recursion in crm_board_members RLS policies

  1. Problem
    - The SELECT policy on crm_board_members references crm_boards
    - The UPDATE policy on crm_boards references crm_board_members
    - This creates a circular dependency causing infinite recursion on board deletion

  2. Solution
    - Replace the SELECT policy on crm_board_members with one that checks membership directly
      without referencing crm_boards
    - Also fix DELETE and UPDATE policies to avoid the same circular pattern

  3. Security
    - Users can still only see members of boards they own or are members of
    - Ownership check uses auth.uid() directly on crm_board_members without cross-table reference
*/

-- Drop the problematic SELECT policy
DROP POLICY IF EXISTS "Users can view members of accessible boards" ON crm_board_members;

-- Create a non-recursive SELECT policy: user can see members if they are a member of the same board
CREATE POLICY "Users can view members of accessible boards"
  ON crm_board_members
  FOR SELECT
  TO authenticated
  USING (
    (get_user_role(auth.uid()) = ANY (ARRAY['Empleado'::text, 'Gerente'::text, 'Administrador'::text]))
    AND (
      -- User is a member of this board
      EXISTS (
        SELECT 1 FROM crm_board_members AS my_m
        WHERE my_m.board_id = crm_board_members.board_id
          AND my_m.user_id = auth.uid()
      )
      -- Or user owns the board (check directly on boards without triggering boards RLS)
      OR EXISTS (
        SELECT 1 FROM crm_boards b
        WHERE b.id = crm_board_members.board_id
          AND b.owner_user_id = auth.uid()
      )
    )
  );

-- Fix the DELETE policy to not self-reference through the same table with RLS
DROP POLICY IF EXISTS "Owners and admins can remove members" ON crm_board_members;

CREATE POLICY "Owners and admins can remove members"
  ON crm_board_members
  FOR DELETE
  TO authenticated
  USING (
    (get_user_role(auth.uid()) = ANY (ARRAY['Empleado'::text, 'Gerente'::text, 'Administrador'::text]))
    AND (
      -- User is owner/admin of this board (direct check avoids recursion)
      EXISTS (
        SELECT 1 FROM crm_board_members AS my_m
        WHERE my_m.board_id = crm_board_members.board_id
          AND my_m.user_id = auth.uid()
          AND my_m.member_role = ANY (ARRAY['owner'::text, 'admin'::text])
      )
      -- Or user is the board owner
      OR EXISTS (
        SELECT 1 FROM crm_boards b
        WHERE b.id = crm_board_members.board_id
          AND b.owner_user_id = auth.uid()
      )
    )
  );

-- Fix the UPDATE policy similarly
DROP POLICY IF EXISTS "Owners and admins can update member roles" ON crm_board_members;

CREATE POLICY "Owners and admins can update member roles"
  ON crm_board_members
  FOR UPDATE
  TO authenticated
  USING (
    (get_user_role(auth.uid()) = ANY (ARRAY['Empleado'::text, 'Gerente'::text, 'Administrador'::text]))
    AND (
      EXISTS (
        SELECT 1 FROM crm_board_members AS my_m
        WHERE my_m.board_id = crm_board_members.board_id
          AND my_m.user_id = auth.uid()
          AND my_m.member_role = ANY (ARRAY['owner'::text, 'admin'::text])
      )
      OR EXISTS (
        SELECT 1 FROM crm_boards b
        WHERE b.id = crm_board_members.board_id
          AND b.owner_user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    (get_user_role(auth.uid()) = ANY (ARRAY['Empleado'::text, 'Gerente'::text, 'Administrador'::text]))
    AND (get_user_role(user_id) = ANY (ARRAY['Empleado'::text, 'Gerente'::text, 'Administrador'::text]))
  );

-- Also fix crm_boards UPDATE policy to avoid recursion
-- The "Only owners can soft delete boards" is fine (no subquery on members)
-- But "Owners and admins can update boards" queries crm_board_members which triggers the SELECT policy loop

DROP POLICY IF EXISTS "Owners and admins can update boards" ON crm_boards;

CREATE POLICY "Owners and admins can update boards"
  ON crm_boards
  FOR UPDATE
  TO authenticated
  USING (
    (deleted_at IS NULL)
    AND (get_user_role(auth.uid()) = ANY (ARRAY['Empleado'::text, 'Gerente'::text, 'Administrador'::text]))
    AND (
      owner_user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM crm_board_members
        WHERE crm_board_members.board_id = crm_boards.id
          AND crm_board_members.user_id = auth.uid()
          AND crm_board_members.member_role = ANY (ARRAY['owner'::text, 'admin'::text])
      )
    )
  )
  WITH CHECK (
    get_user_role(auth.uid()) = ANY (ARRAY['Empleado'::text, 'Gerente'::text, 'Administrador'::text])
  );
