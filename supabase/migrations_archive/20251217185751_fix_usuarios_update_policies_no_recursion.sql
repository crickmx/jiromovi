/*
  # Arreglar Políticas UPDATE de Usuarios sin Recursión

  1. Problema
    - La política "Gerentes can update office users roles" tiene subquery recursiva
    - Causa errores al actualizar perfiles de usuario
    - La subquery consulta la tabla usuarios dentro de la política de usuarios
  
  2. Solución
    - Eliminar políticas UPDATE con recursión
    - Recrear usando funciones helper (get_current_user_role, get_current_user_office)
    - Las funciones helper tienen SECURITY DEFINER que rompe la recursión
  
  3. Nuevas Políticas
    - Users can update own profile: Cualquier usuario puede actualizar su propio perfil
    - Admins can update any user: Administradores pueden actualizar cualquier usuario
    - Gerentes can update office users: Gerentes pueden actualizar usuarios de su oficina
*/

-- Eliminar políticas UPDATE existentes que pueden tener recursión
DROP POLICY IF EXISTS "Users can update own profile" ON usuarios;
DROP POLICY IF EXISTS "Admins can update any user" ON usuarios;
DROP POLICY IF EXISTS "Gerentes can update office users roles" ON usuarios;
DROP POLICY IF EXISTS "Authenticated users can update usuarios" ON usuarios;

-- Política 1: Usuarios pueden actualizar su propio perfil
CREATE POLICY "Users can update own profile"
  ON usuarios
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Política 2: Administradores pueden actualizar cualquier usuario
CREATE POLICY "Admins can update any user"
  ON usuarios
  FOR UPDATE
  TO authenticated
  USING (get_current_user_role() = 'Administrador')
  WITH CHECK (get_current_user_role() = 'Administrador');

-- Política 3: Gerentes pueden actualizar usuarios de su oficina
CREATE POLICY "Gerentes can update office users"
  ON usuarios
  FOR UPDATE
  TO authenticated
  USING (
    get_current_user_role() = 'Gerente'
    AND oficina_id = get_current_user_office()
    AND oficina_id IS NOT NULL
  )
  WITH CHECK (
    get_current_user_role() = 'Gerente'
    AND oficina_id = get_current_user_office()
    AND oficina_id IS NOT NULL
  );

-- Log de confirmación
DO $$
BEGIN
  RAISE NOTICE '✅ Políticas UPDATE de usuarios corregidas';
  RAISE NOTICE '✅ Sin recursión - usando funciones helper';
  RAISE NOTICE '✅ Usuarios: pueden actualizar su propio perfil';
  RAISE NOTICE '✅ Administradores: pueden actualizar cualquier usuario';
  RAISE NOTICE '✅ Gerentes: pueden actualizar usuarios de su oficina';
END $$;
