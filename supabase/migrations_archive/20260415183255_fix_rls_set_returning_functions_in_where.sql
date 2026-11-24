/*
  # Fix "set-returning functions are not allowed in WHERE" error

  ## Problem
  When PostgREST executes a JOIN between ticket_comentarios and usuarios,
  PostgreSQL evaluates all RLS policies. The chain was:
  
  1. ticket_comentarios SELECT policy → JOIN → usuarios
  2. usuarios "Anonymous: read published profiles" policy → EXISTS(SELECT FROM user_web_pages)
  3. user_web_pages "Users can update own web page config" → (user_id = (SELECT auth.uid() AS uid))
  
  The `(SELECT auth.uid() AS uid)` pattern is a set-returning subquery inside a WHERE
  clause, which PostgreSQL disallows during JOIN processing with RLS.

  ## Fix
  1. Drop the "Anonymous: read published profiles" policy from usuarios — it creates
     a cross-table RLS dependency chain that breaks JOINs
  2. Fix all (SELECT auth.uid() AS uid) patterns in user_web_pages policies
     to use auth.uid() directly
*/

-- 1. Drop the problematic anonymous policy on usuarios that chains into user_web_pages
DROP POLICY IF EXISTS "Anonymous: read published profiles" ON usuarios;

-- 2. Fix user_web_pages policies that use (SELECT auth.uid() AS uid) instead of auth.uid()
DROP POLICY IF EXISTS "Users can update own web page config" ON user_web_pages;
DROP POLICY IF EXISTS "Users can view own web page config" ON user_web_pages;
DROP POLICY IF EXISTS "Users can insert own web page config" ON user_web_pages;

CREATE POLICY "Users can view own web page config"
  ON user_web_pages
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own web page config"
  ON user_web_pages
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own web page config"
  ON user_web_pages
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
