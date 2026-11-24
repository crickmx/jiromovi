-- Replace ia_bandeja SELECT policy with one using SECURITY DEFINER helper to avoid nested RLS
DROP POLICY IF EXISTS "Admins and gerentes can read ia_bandeja" ON ia_bandeja;
CREATE POLICY "Admins and gerentes can read ia_bandeja" ON ia_bandeja
  FOR SELECT TO authenticated
  USING (
    get_user_role_for_rls(auth.uid()) IN ('Administrador', 'Gerente')
  );

-- Replace UPDATE policy similarly
DROP POLICY IF EXISTS "Admins and gerentes can update ia_bandeja" ON ia_bandeja;
CREATE POLICY "Admins and gerentes can update ia_bandeja" ON ia_bandeja
  FOR UPDATE TO authenticated
  USING (get_user_role_for_rls(auth.uid()) IN ('Administrador', 'Gerente'))
  WITH CHECK (get_user_role_for_rls(auth.uid()) IN ('Administrador', 'Gerente'));

-- Replace INSERT policy similarly
DROP POLICY IF EXISTS "Admins and gerentes can insert ia_bandeja" ON ia_bandeja;
CREATE POLICY "Admins and gerentes can insert ia_bandeja" ON ia_bandeja
  FOR INSERT TO authenticated
  WITH CHECK (get_user_role_for_rls(auth.uid()) IN ('Administrador', 'Gerente'));

-- Replace DELETE policy similarly
DROP POLICY IF EXISTS "Admins and gerentes can delete ia_bandeja" ON ia_bandeja;
CREATE POLICY "Admins and gerentes can delete ia_bandeja" ON ia_bandeja
  FOR DELETE TO authenticated
  USING (get_user_role_for_rls(auth.uid()) IN ('Administrador', 'Gerente'));

-- Also fix ia_robots SELECT policy
DROP POLICY IF EXISTS "Admins and gerentes can read ia_robots" ON ia_robots;
CREATE POLICY "Admins and gerentes can read ia_robots" ON ia_robots
  FOR SELECT TO authenticated
  USING (get_user_role_for_rls(auth.uid()) IN ('Administrador', 'Gerente'));
