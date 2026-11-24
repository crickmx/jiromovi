/*
  # Create Soft Delete Function for GMM Quotations

  1. Problem
    - RLS policies may interfere with FK verification during UPDATE
    - Direct UPDATE from client causes "violates row-level security policy" error
    
  2. Solution
    - Create SECURITY DEFINER function to handle soft delete
    - Function bypasses RLS but maintains security by checking ownership
    - Prevents FK verification issues with usuarios table
    
  3. Security
    - Function validates usuario_id = auth.uid() before allowing delete
    - Only owners can soft delete their quotations
    - Maintains all security guarantees
*/

-- Create function to soft delete a quotation
CREATE OR REPLACE FUNCTION soft_delete_gmm_quotation(p_quotation_id uuid)
RETURNS json
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_user_id uuid;
  v_owner_id uuid;
  v_result json;
BEGIN
  -- Get current authenticated user
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'No authenticated user'
    );
  END IF;
  
  -- Get the owner of the quotation
  SELECT usuario_id INTO v_owner_id
  FROM gmm_quotations
  WHERE id = p_quotation_id;
  
  IF v_owner_id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Quotation not found'
    );
  END IF;
  
  -- Check ownership
  IF v_owner_id != v_user_id THEN
    RETURN json_build_object(
      'success', false,
      'error', 'You do not own this quotation'
    );
  END IF;
  
  -- Perform soft delete
  UPDATE gmm_quotations
  SET deleted_at = now()
  WHERE id = p_quotation_id;
  
  RETURN json_build_object(
    'success', true,
    'message', 'Quotation soft deleted successfully'
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION soft_delete_gmm_quotation(uuid) TO authenticated;

-- Add comment
COMMENT ON FUNCTION soft_delete_gmm_quotation IS 
  'Soft deletes a GMM quotation by setting deleted_at timestamp. Only the owner can delete their quotation.';
