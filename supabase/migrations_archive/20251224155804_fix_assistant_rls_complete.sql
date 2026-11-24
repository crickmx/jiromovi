/*
  # Fix Assistant RLS Complete

  1. Changes
    - Ensure service_role has full access to all necessary tables
    - Fix usuarios RLS to allow service_role access without recursion
    - Fix oficinas RLS to allow joins from service_role
    - Add explicit policies for edge functions

  2. Security
    - Service role has full access (this is expected for edge functions)
    - Regular users still have restricted access via existing policies
*/

-- Fix usuarios policies for service_role (no recursion)
DROP POLICY IF EXISTS "Service role can read all users" ON usuarios;
CREATE POLICY "Service role can read all users"
  ON usuarios FOR SELECT
  USING (
    (auth.jwt() ->> 'role')::text = 'service_role'
  );

-- Fix oficinas policies for service_role
DROP POLICY IF EXISTS "Service role can read all oficinas" ON oficinas;
CREATE POLICY "Service role can read all oficinas"
  ON oficinas FOR SELECT
  USING (
    (auth.jwt() ->> 'role')::text = 'service_role'
  );

-- Fix conversaciones_chatgpt policies for service_role
DROP POLICY IF EXISTS "Service role full access conversaciones" ON conversaciones_chatgpt;
CREATE POLICY "Service role full access conversaciones"
  ON conversaciones_chatgpt FOR ALL
  USING (
    (auth.jwt() ->> 'role')::text = 'service_role'
  );

-- Fix mensajes_chatgpt policies for service_role
DROP POLICY IF EXISTS "Service role full access mensajes" ON mensajes_chatgpt;
CREATE POLICY "Service role full access mensajes"
  ON mensajes_chatgpt FOR ALL
  USING (
    (auth.jwt() ->> 'role')::text = 'service_role'
  );