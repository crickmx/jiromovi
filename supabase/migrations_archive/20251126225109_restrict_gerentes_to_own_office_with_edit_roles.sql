/*
  # Restringir Gerentes a Su Oficina con Permisos de Edición de Roles
  
  ## Problema
  Gerentes actualmente pueden ver todos los usuarios, pero necesitan:
  1. Ver SOLO usuarios de su oficina (Empleado, Agente, Gerente)
  2. Poder editar el rol de estos usuarios (solo Agente o Empleado)
  
  ## Solución
  1. Revertir política SELECT para Gerentes (solo su oficina)
  2. Agregar política UPDATE para que Gerentes puedan editar usuarios de su oficina
  3. Restringir cambios de rol solo a Agente o Empleado
  
  ## Cambios
  - SELECT: Gerentes ven solo usuarios de su oficina
  - UPDATE: Gerentes pueden actualizar usuarios de su oficina
  - Restricción: Solo pueden asignar roles Agente o Empleado
  
  ## Seguridad
  - Gerentes NO pueden verse a sí mismos en las actualizaciones
  - Gerentes NO pueden cambiar roles a Administrador o Gerente
  - Solo pueden editar usuarios de su misma oficina
*/

-- Eliminar política permisiva de Gerentes
DROP POLICY IF EXISTS "Gerentes view all users in directory" ON usuarios;

-- Política SELECT: Gerentes ven solo usuarios de su oficina
CREATE POLICY "Gerentes view own office users only"
  ON usuarios
  FOR SELECT
  TO authenticated
  USING (
    get_current_user_role() = 'Gerente'
    AND oficina_id = get_current_user_office()
  );

-- Eliminar política UPDATE permisiva actual
DROP POLICY IF EXISTS "Authenticated users can update usuarios" ON usuarios;

-- Política UPDATE: Usuarios pueden actualizar su propio perfil
CREATE POLICY "Users can update own profile"
  ON usuarios
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND rol = (SELECT rol FROM usuarios WHERE id = auth.uid()) -- No pueden cambiar su propio rol
  );

-- Política UPDATE: Gerentes pueden actualizar usuarios de su oficina
CREATE POLICY "Gerentes can update office users roles"
  ON usuarios
  FOR UPDATE
  TO authenticated
  USING (
    get_current_user_role() = 'Gerente'
    AND oficina_id = get_current_user_office()
    AND auth.uid() != id -- No pueden editarse a sí mismos
  )
  WITH CHECK (
    get_current_user_role() = 'Gerente'
    AND oficina_id = get_current_user_office()
    AND auth.uid() != id
    AND rol IN ('Agente', 'Empleado') -- Solo pueden asignar Agente o Empleado
  );

-- Política UPDATE: Administradores pueden actualizar cualquier usuario
CREATE POLICY "Admins can update any user"
  ON usuarios
  FOR UPDATE
  TO authenticated
  USING (get_current_user_role() = 'Administrador')
  WITH CHECK (get_current_user_role() = 'Administrador');

-- Log de confirmación
DO $$
BEGIN
  RAISE NOTICE '✅ Políticas de Gerente actualizadas correctamente';
  RAISE NOTICE '✅ SELECT: Gerentes ven solo su oficina';
  RAISE NOTICE '✅ UPDATE: Gerentes pueden editar usuarios de su oficina';
  RAISE NOTICE '✅ Restricción: Solo roles Agente o Empleado';
  RAISE NOTICE '✅ Gerentes NO pueden editarse a sí mismos';
END $$;
