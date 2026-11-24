/*
  # Fix oficinas RLS - Remove all subqueries

  1. Changes
    - Drop all policies that cause recursion with usuarios
    - Create simple policy: all authenticated users can view active offices
    - This is safe because office names are not sensitive data
  
  2. Security
    - Only authenticated users can view
    - Only active offices are visible
    - Admin policies still allow full management
*/

-- Drop problematic policies
DROP POLICY IF EXISTS "Users can view own office" ON oficinas;
DROP POLICY IF EXISTS "Employees can view active oficinas" ON oficinas;

-- Create simple policy without subqueries
CREATE POLICY "Authenticated users can view active offices"
  ON oficinas
  FOR SELECT
  TO authenticated
  USING (activa = true);
