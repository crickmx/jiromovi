/*
  # Fix Usuarios Update RLS for Estado Field

  ## Problema
  Las políticas de UPDATE tienen subconsultas que causan problemas de RLS recursivo
  cuando un Admin intenta actualizar el campo 'estado' de otros usuarios.

  ## Solución
  Usar la función helper get_my_rol() que ya está en cache para evitar recursión.

  ## Cambios
  1. Reemplazar subconsultas con función helper
  2. Asegurar que Admins puedan actualizar cualquier campo incluyendo 'estado'
  3. Asegurar que Gerentes puedan actualizar usuarios de su oficina
*/

-- Eliminar políticas existentes de UPDATE
DROP POLICY IF EXISTS "Admins: update all users" ON usuarios;
DROP POLICY IF EXISTS "Gerentes: update office users" ON usuarios;
DROP POLICY IF EXISTS "Users: update own profile" ON usuarios;

-- Crear función helper para obtener rol del usuario actual (si no existe)
CREATE OR REPLACE FUNCTION get_my_rol()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT rol
  FROM usuarios
  WHERE id = auth.uid()
  LIMIT 1;
$$;

-- Crear función helper para obtener oficina del usuario actual (si no existe)
CREATE OR REPLACE FUNCTION get_my_oficina_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT oficina_id
  FROM usuarios
  WHERE id = auth.uid()
  LIMIT 1;
$$;

-- Política 1: Administradores pueden actualizar cualquier usuario
CREATE POLICY "Admins can update all users"
  ON usuarios
  FOR UPDATE
  TO authenticated
  USING (
    get_my_rol() = 'Administrador'
  );

-- Política 2: Gerentes pueden actualizar usuarios de su oficina
CREATE POLICY "Gerentes can update office users"
  ON usuarios
  FOR UPDATE
  TO authenticated
  USING (
    get_my_rol() = 'Gerente'
    AND oficina_id = get_my_oficina_id()
  );

-- Política 3: Usuarios pueden actualizar su propio perfil
CREATE POLICY "Users can update own profile"
  ON usuarios
  FOR UPDATE
  TO authenticated
  USING (
    id = auth.uid()
  );

-- Comentarios
COMMENT ON POLICY "Admins can update all users" ON usuarios IS
  'Administradores pueden actualizar cualquier campo de cualquier usuario, incluyendo estado';

COMMENT ON POLICY "Gerentes can update office users" ON usuarios IS
  'Gerentes pueden actualizar usuarios de su oficina';

COMMENT ON POLICY "Users can update own profile" ON usuarios IS
  'Usuarios pueden actualizar su propio perfil';
