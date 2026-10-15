/*
  # Fix Anonymous Access to Seguros Education

  1. Changes
    - Drop existing anonymous policies
    - Recreate with explicit permissions for anon role
    - Ensure categories and lessons are accessible without authentication
  
  2. Security
    - Only SELECT access for anonymous users
    - Only active categories visible
    - All lessons visible for migration purposes
*/

-- Drop existing anonymous policies
DROP POLICY IF EXISTS "Anonymous users can view active categories" ON seguros_categories;
DROP POLICY IF EXISTS "Anonymous users can view active lessons" ON seguros_lessons;

-- Recreate anonymous access policies
CREATE POLICY "Allow anonymous read active categories"
  ON seguros_categories
  FOR SELECT
  TO anon
  USING (activa = true);

CREATE POLICY "Allow anonymous read all lessons"
  ON seguros_lessons
  FOR SELECT
  TO anon
  USING (true);
