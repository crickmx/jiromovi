/*
  # Limpiar y Corregir Políticas UPDATE de Usuarios

  ## Problema
  Existen 3 políticas UPDATE duplicadas/conflictivas:
  1. "Actualizar perfil propio" - solo para el propio usuario
  2. "Users can update own profile" - duplicada de la anterior
  3. "usuarios_update_policy" - para admins/gerentes pero sin WITH CHECK

  ## Solución
  Eliminar políticas duplicadas y crear una sola política clara que:
  - Permite a usuarios actualizar su propio perfil
  - Permite a Administradores actualizar cualquier usuario
  - Permite a Gerentes actualizar usuarios de su oficina
  
  ## Políticas Finales
  1. "Users can update own profile" - Usuarios pueden actualizar su perfil
  2. "Admins can update any user" - Administradores pueden actualizar cualquier usuario
  3. "Gerentes can update office users" - Gerentes pueden actualizar usuarios de su oficina
*/

-- Eliminar políticas UPDATE existentes
DROP POLICY IF EXISTS "Actualizar perfil propio" ON usuarios;
DROP POLICY IF EXISTS "Users can update own profile" ON usuarios;
DROP POLICY IF EXISTS "usuarios_update_policy" ON usuarios;

-- Política 1: Usuarios pueden actualizar su propio perfil
CREATE POLICY "Users can update own profile"
  ON usuarios
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Política 2: Administradores pueden actualizar cualquier usuario
CREATE POLICY "Admins can update any user"
  ON usuarios
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.raw_user_meta_data->>'rol' = 'Administrador'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.raw_user_meta_data->>'rol' = 'Administrador'
    )
  );

-- Política 3: Gerentes pueden actualizar usuarios de su oficina
CREATE POLICY "Gerentes can update office users"
  ON usuarios
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      JOIN usuarios gerente ON gerente.id = auth.users.id
      WHERE auth.users.id = auth.uid()
      AND auth.users.raw_user_meta_data->>'rol' = 'Gerente'
      AND gerente.oficina_id = usuarios.oficina_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users
      JOIN usuarios gerente ON gerente.id = auth.users.id
      WHERE auth.users.id = auth.uid()
      AND auth.users.raw_user_meta_data->>'rol' = 'Gerente'
      AND gerente.oficina_id = usuarios.oficina_id
    )
  );

-- Verificación
DO $$
BEGIN
  RAISE NOTICE '✅ Políticas UPDATE de usuarios limpiadas y reorganizadas';
  RAISE NOTICE '✅ Usuarios pueden actualizar su propio perfil';
  RAISE NOTICE '✅ Administradores pueden actualizar cualquier usuario';
  RAISE NOTICE '✅ Gerentes pueden actualizar usuarios de su oficina';
END $$;
