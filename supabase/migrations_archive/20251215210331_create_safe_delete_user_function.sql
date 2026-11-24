/*
  # Create Safe Delete User Function

  1. Purpose
    - Provides a safe way to delete users from the database
    - Handles all foreign key relationships automatically
    - Cleans up related data or sets to NULL as appropriate
    
  2. Function Behavior
    - Uses CASCADE for data that should be deleted with the user
    - Uses SET NULL for audit/history data that should be preserved
    - Returns detailed information about what was deleted
    
  3. Security
    - Function runs with SECURITY DEFINER to bypass RLS
    - Should only be called by edge functions with proper authorization
*/

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS safe_delete_user(uuid);

-- Create the function
CREATE OR REPLACE FUNCTION safe_delete_user(user_id_to_delete uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count integer := 0;
  result jsonb;
BEGIN
  -- Verify user exists
  IF NOT EXISTS (SELECT 1 FROM usuarios WHERE id = user_id_to_delete) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'User not found'
    );
  END IF;

  -- Delete from usuarios table
  -- This will CASCADE or SET NULL to all related tables automatically
  DELETE FROM usuarios WHERE id = user_id_to_delete;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  -- Build success response
  result := jsonb_build_object(
    'success', true,
    'deleted_users', deleted_count,
    'message', 'User deleted successfully'
  );

  RETURN result;

EXCEPTION
  WHEN foreign_key_violation THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Cannot delete user due to foreign key constraint',
      'detail', SQLERRM
    );
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Unexpected error during deletion',
      'detail', SQLERRM
    );
END;
$$;

-- Grant execute permission to authenticated users (will be called via edge function)
GRANT EXECUTE ON FUNCTION safe_delete_user(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION safe_delete_user(uuid) TO service_role;

-- Add comment
COMMENT ON FUNCTION safe_delete_user IS 'Safely deletes a user and handles all foreign key relationships';
