/*
  # Corregir políticas RLS para evitar recursión infinita

  1. Cambios
    - Eliminar todas las políticas existentes
    - Crear políticas simples sin subconsultas recursivas
    - Usar una tabla separada para roles si es necesario
*/

-- Eliminar todas las políticas existentes
DROP POLICY IF EXISTS "Usuarios pueden ver su propio perfil" ON usuarios;
DROP POLICY IF EXISTS "Administradores pueden ver todos los usuarios" ON usuarios;
DROP POLICY IF EXISTS "Usuarios pueden actualizar su propio perfil" ON usuarios;
DROP POLICY IF EXISTS "Administradores pueden actualizar cualquier usuario" ON usuarios;
DROP POLICY IF EXISTS "Usuarios autenticados pueden crear perfiles" ON usuarios;
DROP POLICY IF EXISTS "Administradores pueden eliminar usuarios" ON usuarios;

-- Política para SELECT: Los usuarios pueden ver su propio perfil
CREATE POLICY "Usuarios pueden ver su propio perfil"
  ON usuarios FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- Política para INSERT: Permitir crear perfil propio
CREATE POLICY "Usuarios pueden crear su propio perfil"
  ON usuarios FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

-- Política para UPDATE: Los usuarios pueden actualizar su propio perfil
CREATE POLICY "Usuarios pueden actualizar su propio perfil"
  ON usuarios FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Crear una función para verificar si el usuario es admin sin causar recursión
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
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

-- Política para que administradores vean todos los usuarios
CREATE POLICY "Administradores pueden ver todos los usuarios"
  ON usuarios FOR SELECT
  TO authenticated
  USING (is_admin());

-- Política para que administradores actualicen cualquier usuario
CREATE POLICY "Administradores pueden actualizar cualquier usuario"
  ON usuarios FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- Política para que administradores creen usuarios
CREATE POLICY "Administradores pueden crear usuarios"
  ON usuarios FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

-- Política para que administradores eliminen usuarios
CREATE POLICY "Administradores pueden eliminar usuarios"
  ON usuarios FOR DELETE
  TO authenticated
  USING (is_admin());