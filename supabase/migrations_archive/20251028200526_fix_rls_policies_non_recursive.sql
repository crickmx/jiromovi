/*
  # Corrección de Políticas RLS Recursivas en Usuarios

  ## Problema Identificado
  Las políticas de SELECT en la tabla usuarios tienen recursión que causa fallos:
  - usuarios_select_admin: Consulta la tabla usuarios para verificar si el usuario es admin
  - usuarios_select_gerente: Consulta la tabla usuarios para verificar si el usuario es gerente
  
  Esto crea una recursión infinita que bloquea el acceso.

  ## Solución
  1. Eliminar todas las políticas actuales
  2. Crear políticas simples y directas sin recursión
  3. Usar security definer functions para operaciones complejas cuando sea necesario

  ## Cambios
  - Elimina todas las políticas recursivas
  - Crea políticas nuevas sin recursión
  - Permite que los usuarios vean su propio perfil
  - Los administradores pueden ver todos los perfiles usando una función segura
*/

-- Eliminar todas las políticas actuales de usuarios
DROP POLICY IF EXISTS "usuarios_select_own" ON usuarios;
DROP POLICY IF EXISTS "usuarios_select_admin" ON usuarios;
DROP POLICY IF EXISTS "usuarios_select_gerente" ON usuarios;
DROP POLICY IF EXISTS "usuarios_insert_admin" ON usuarios;
DROP POLICY IF EXISTS "usuarios_update_own" ON usuarios;
DROP POLICY IF EXISTS "usuarios_update_admin" ON usuarios;
DROP POLICY IF EXISTS "usuarios_delete_admin" ON usuarios;

-- Política 1: Los usuarios pueden ver su propio perfil (sin recursión)
CREATE POLICY "Users can view own profile"
  ON usuarios
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Política 2: Los usuarios pueden actualizar su propio perfil
CREATE POLICY "Users can update own profile"
  ON usuarios
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Crear una función segura para verificar si un usuario es administrador
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM usuarios 
    WHERE id = auth.uid() 
    AND rol = 'Administrador'
    AND activo = true
  );
$$;

-- Crear una función segura para verificar si un usuario es gerente
CREATE OR REPLACE FUNCTION is_gerente()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM usuarios 
    WHERE id = auth.uid() 
    AND rol = 'Gerente'
    AND activo = true
  );
$$;

-- Crear una función para obtener la oficina del usuario actual
CREATE OR REPLACE FUNCTION get_user_oficina_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT oficina_id 
  FROM usuarios 
  WHERE id = auth.uid() 
  LIMIT 1;
$$;

-- Política 3: Los administradores pueden ver todos los usuarios
CREATE POLICY "Admins can view all users"
  ON usuarios
  FOR SELECT
  TO authenticated
  USING (is_admin());

-- Política 4: Los gerentes pueden ver usuarios de su oficina
CREATE POLICY "Gerentes can view office users"
  ON usuarios
  FOR SELECT
  TO authenticated
  USING (
    is_gerente() 
    AND oficina_id = get_user_oficina_id()
  );

-- Política 5: Los administradores pueden insertar usuarios
CREATE POLICY "Admins can insert users"
  ON usuarios
  FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

-- Política 6: Los administradores pueden actualizar cualquier usuario
CREATE POLICY "Admins can update all users"
  ON usuarios
  FOR UPDATE
  TO authenticated
  USING (is_admin());

-- Política 7: Los administradores pueden eliminar usuarios
CREATE POLICY "Admins can delete users"
  ON usuarios
  FOR DELETE
  TO authenticated
  USING (is_admin());

-- Verificar que RLS esté habilitado
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;

-- Crear índices para mejorar el rendimiento
CREATE INDEX IF NOT EXISTS idx_usuarios_rol ON usuarios(rol);
CREATE INDEX IF NOT EXISTS idx_usuarios_activo ON usuarios(activo);
CREATE INDEX IF NOT EXISTS idx_usuarios_oficina_id ON usuarios(oficina_id);
