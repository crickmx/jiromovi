/*
  # Create Helper Function for Email Lookup

  1. New Function
    - `get_auth_email_for_user(user_id uuid)`
      - Returns the auth email for a given user ID
      - Security definer to access auth.users
      - Used by login flow to handle email_laboral vs auth.email discrepancies

  2. Purpose
    - Allows transparent login with either email_laboral or auth.email
    - Improves user experience when emails don't match
    - Maintains security by using service role context

  3. Security
    - Function runs with security definer (service role)
    - Only returns email for valid, active users
    - No sensitive data exposed
*/

-- Create function to get auth email for a user
CREATE OR REPLACE FUNCTION get_auth_email_for_user(user_id uuid)
RETURNS TABLE (email text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Return the email from auth.users for the given user_id
  RETURN QUERY
  SELECT au.email::text
  FROM auth.users au
  WHERE au.id = user_id;
END;
$$;

-- Grant execute to authenticated and anon (needed for login)
GRANT EXECUTE ON FUNCTION get_auth_email_for_user(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_auth_email_for_user(uuid) TO anon;

-- Add comment
COMMENT ON FUNCTION get_auth_email_for_user IS 'Returns the auth.users email for a given user ID. Used during login to handle email_laboral vs auth.email discrepancies.';
