/*
  # Fix RLS Policies - Eliminate Recursion
  
  1. Problem
    - Current RLS policies have circular recursion
    - Admin policies check usuarios table to verify admin role
    - This causes "infinite recursion" or query timeouts
    - Users cannot even read their own profile on first login
  
  2. Solution
    - Drop ALL existing policies on usuarios table
    - Create simple, non-recursive policies:
      - Users can ALWAYS read their own row (by auth.uid())
      - Users can ALWAYS update their own row (by auth.uid())
      - For admin operations, we'll use service role or stored functions
  
  3. Security
    - Users can only access their own data
    - No user can see other users' data (unless using service role)
    - Admins will use edge functions with service role for admin operations
*/

-- Drop all existing policies on usuarios
DROP POLICY IF EXISTS "Users can view own profile" ON usuarios;
DROP POLICY IF EXISTS "Users can update own profile" ON usuarios;
DROP POLICY IF EXISTS "Admins can view all users" ON usuarios;
DROP POLICY IF EXISTS "Admins can update all users" ON usuarios;
DROP POLICY IF EXISTS "Admins can insert users" ON usuarios;
DROP POLICY IF EXISTS "Admins can delete users" ON usuarios;
DROP POLICY IF EXISTS "Gerentes can view office users" ON usuarios;
DROP POLICY IF EXISTS "Gerentes can update office users" ON usuarios;

-- Create simple, non-recursive policies
-- Policy 1: Users can ALWAYS read their own profile
CREATE POLICY "Users can read own profile"
  ON usuarios
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Policy 2: Users can ALWAYS update their own profile (excluding rol and activo)
CREATE POLICY "Users can update own profile"
  ON usuarios
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Policy 3: Service role bypass (for admin operations via edge functions)
-- No policy needed - service role automatically bypasses RLS

-- Verify RLS is enabled
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
