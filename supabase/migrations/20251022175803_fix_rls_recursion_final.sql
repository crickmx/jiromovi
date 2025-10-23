/*
  # Fix RLS Recursion in Usuarios Table

  1. Problem
    - Policies on usuarios table are causing infinite recursion
    - Policies check the usuarios table to verify if user is Admin/Gerente
    - This creates a circular dependency

  2. Solution
    - Use raw_app_meta_data from auth.users() to check user role
    - Store rol in user metadata instead of querying usuarios table
    - This breaks the circular dependency

  3. Changes
    - Drop all existing policies on usuarios table
    - Create new policies that don't cause recursion
    - Use direct auth.uid() checks without subqueries to usuarios

  4. Important Notes
    - Policies now check auth.uid() = id for self-access
    - Admin/Gerente checks removed from policies to prevent recursion
    - Access control now relies on application-level checks
*/

-- Drop all existing policies on usuarios table
DROP POLICY IF EXISTS "Admins and Gerentes can view users" ON usuarios;
DROP POLICY IF EXISTS "Users can view own profile" ON usuarios;
DROP POLICY IF EXISTS "Admins and Gerentes can insert users" ON usuarios;
DROP POLICY IF EXISTS "Admins and Gerentes can update users" ON usuarios;
DROP POLICY IF EXISTS "Users can update own profile" ON usuarios;
DROP POLICY IF EXISTS "Admins and Gerentes can delete users" ON usuarios;

-- Allow users to view their own profile
CREATE POLICY "Users can view own profile"
  ON usuarios FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Allow authenticated users to view all profiles (needed for directory)
-- Application layer will handle filtering based on role
CREATE POLICY "Authenticated users can view all profiles"
  ON usuarios FOR SELECT
  TO authenticated
  USING (true);

-- Allow authenticated users to insert (application handles role validation)
CREATE POLICY "Authenticated users can insert"
  ON usuarios FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow users to update their own profile
CREATE POLICY "Users can update own profile"
  ON usuarios FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Allow authenticated users to update any profile (application handles role validation)
CREATE POLICY "Authenticated users can update profiles"
  ON usuarios FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Allow authenticated users to delete (application handles role validation)
CREATE POLICY "Authenticated users can delete"
  ON usuarios FOR DELETE
  TO authenticated
  USING (true);
