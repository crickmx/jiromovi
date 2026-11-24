/*
  # Improve safe_delete_user Error Handling

  1. Changes
    - Add more detailed error information
    - Include SQLSTATE in error responses
    - Add specific handling for common error cases
    - Better logging capabilities
*/

-- Drop existing function
DROP FUNCTION IF EXISTS safe_delete_user(uuid);

-- Create improved function
CREATE OR REPLACE FUNCTION safe_delete_user(user_id_to_delete uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count integer := 0;
  result jsonb;
  error_state text;
  error_msg text;
  error_detail text;
  error_hint text;
  error_context text;
BEGIN
  -- Verify user exists
  IF NOT EXISTS (SELECT 1 FROM usuarios WHERE id = user_id_to_delete) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'User not found',
      'error_code', 'USER_NOT_FOUND'
    );
  END IF;

  -- Delete from usuarios table
  -- This will CASCADE or SET NULL to all related tables automatically
  DELETE FROM usuarios WHERE id = user_id_to_delete;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  -- Verify deletion was successful
  IF deleted_count = 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'User could not be deleted',
      'error_code', 'DELETE_FAILED'
    );
  END IF;

  -- Build success response
  result := jsonb_build_object(
    'success', true,
    'deleted_users', deleted_count,
    'message', 'User deleted successfully'
  );

  RETURN result;

EXCEPTION
  WHEN foreign_key_violation THEN
    GET STACKED DIAGNOSTICS
      error_state = RETURNED_SQLSTATE,
      error_msg = MESSAGE_TEXT,
      error_detail = PG_EXCEPTION_DETAIL,
      error_hint = PG_EXCEPTION_HINT,
      error_context = PG_EXCEPTION_CONTEXT;
    
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Cannot delete user due to foreign key constraint',
      'error_code', 'FOREIGN_KEY_VIOLATION',
      'sqlstate', error_state,
      'detail', error_detail,
      'hint', error_hint,
      'message', error_msg
    );
    
  WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS
      error_state = RETURNED_SQLSTATE,
      error_msg = MESSAGE_TEXT,
      error_detail = PG_EXCEPTION_DETAIL,
      error_hint = PG_EXCEPTION_HINT,
      error_context = PG_EXCEPTION_CONTEXT;
    
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Unexpected error during deletion',
      'error_code', 'UNEXPECTED_ERROR',
      'sqlstate', error_state,
      'detail', error_detail,
      'hint', error_hint,
      'message', error_msg,
      'context', error_context
    );
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION safe_delete_user(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION safe_delete_user(uuid) TO service_role;

-- Add comment
COMMENT ON FUNCTION safe_delete_user IS 'Safely deletes a user with detailed error reporting';
