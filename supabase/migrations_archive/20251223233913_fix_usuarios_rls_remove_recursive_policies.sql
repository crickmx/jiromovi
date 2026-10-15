/*
  # Fix usuarios RLS - Remove recursive policies

  1. Problem
    - Policies "Admins view all" and "Gerentes view office users" cause infinite recursion
    - They query usuarios table within usuarios policies
  
  2. Solution
    - Drop recursive policies temporarily
    - Keep only basic non-recursive policies for login
    - Users can view their own profile (no subquery needed)
    - Users can view other active users (no subquery needed)
  
  3. Security
    - Users still need to be authenticated
    - Only active, non-deleted users are visible
    - Each user can always see their own profile
*/

-- Drop recursive policies
DROP POLICY IF EXISTS "Admins view all" ON usuarios;
DROP POLICY IF EXISTS "Gerentes view office users" ON usuarios;

-- Keep these non-recursive policies:
-- 1. "Users view own profile" - uses auth.uid() directly, no subquery
-- 2. "Active users view each other" - checks usuario fields directly, no subquery
-- 3. "Users can update own profile" - uses auth.uid() directly, no subquery
-- 4. "Service role full access" - for service_role operations
-- 5. "Public view published profiles" - for public web pages

-- These policies are fine and don't cause recursion
