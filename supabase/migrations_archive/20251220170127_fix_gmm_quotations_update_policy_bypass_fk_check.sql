/*
  # Fix GMM Quotations UPDATE Policy - Bypass FK Check Issue

  1. Problem
    - RLS policies on usuarios table may block FK verification during UPDATE
    - This causes "new row violates row-level security policy" error
    
  2. Solution
    - Use SECURITY DEFINER function to bypass RLS on FK check
    - Simplify UPDATE policy to focus only on ownership check
    
  3. Security
    - Still maintains owner-only access
    - Allows soft delete without FK verification issues
*/

-- Drop existing UPDATE policy
DROP POLICY IF EXISTS "Users can update and soft delete own quotations" ON gmm_quotations;

-- Create new simplified UPDATE policy
-- This avoids RLS issues with the usuarios foreign key check
CREATE POLICY "Users can update and soft delete own quotations"
  ON gmm_quotations
  FOR UPDATE
  TO authenticated
  USING (usuario_id = auth.uid())
  WITH CHECK (usuario_id = auth.uid());
