/*
  # Fix Ambiguous Column Reference in crm_list_boards_for_user

  1. Changes
    - Fix "column reference board_id is ambiguous" error
    - Qualify the board_id column in the subquery with the table name

  2. Notes
    - The error occurs because board_id appears both as:
      - An alias in the SELECT (b.id AS board_id)
      - A column name in the subquery
    - Solution: Use table aliases (cbm, cbm2) to disambiguate column references
*/

CREATE OR REPLACE FUNCTION crm_list_boards_for_user()
RETURNS TABLE (
  board_id uuid,
  board_name text,
  is_owner boolean,
  my_role text,
  owner_name text,
  owner_office text,
  members_count bigint,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    b.id AS board_id,
    b.name AS board_name,
    (b.owner_user_id = auth.uid()) AS is_owner,
    COALESCE(bm.member_role, 'owner') AS my_role,
    CONCAT(u.nombre, ' ', u.apellidos) AS owner_name,
    o.nombre AS owner_office,
    (SELECT COUNT(*) FROM crm_board_members cbm WHERE cbm.board_id = b.id) AS members_count,
    b.created_at,
    b.updated_at
  FROM crm_boards b
  LEFT JOIN crm_board_members bm ON bm.board_id = b.id AND bm.user_id = auth.uid()
  LEFT JOIN usuarios u ON u.id = b.owner_user_id
  LEFT JOIN oficinas o ON o.id = b.owner_office_id
  WHERE
    b.deleted_at IS NULL
    AND (
      b.owner_user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM crm_board_members cbm2
        WHERE cbm2.board_id = b.id
        AND cbm2.user_id = auth.uid()
      )
    )
  ORDER BY b.updated_at DESC;
END;
$$;
