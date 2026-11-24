-- Allow all authenticated users (any role) to read ia_bandeja and ia_robots
-- This is needed because the AutomatizacionIA page is accessible to Admin, Gerente, and Empleado

-- Fix ia_bandeja SELECT policy to allow all authenticated
DROP POLICY IF EXISTS "Admins and gerentes can read ia_bandeja" ON ia_bandeja;
CREATE POLICY "Authenticated users can read ia_bandeja" ON ia_bandeja
  FOR SELECT TO authenticated
  USING (true);

-- Fix ia_robots SELECT policy to allow all authenticated
DROP POLICY IF EXISTS "Admins and gerentes can read ia_robots" ON ia_robots;
CREATE POLICY "Authenticated users can read ia_robots" ON ia_robots
  FOR SELECT TO authenticated
  USING (true);
