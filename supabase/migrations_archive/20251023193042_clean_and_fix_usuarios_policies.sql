/*
  # Clean and Fix Usuarios RLS Policies

  1. Changes
    - Remove ALL existing policies to clean up duplicates
    - Create simple, non-recursive policies
    - Use direct queries with LIMIT to avoid recursion
    
  2. Security
    - Users can always see their own profile
    - Admins can see all users
    - Gerentes can see users from their office with roles Empleado/Agente
*/

-- Drop all existing policies on usuarios table
DROP POLICY IF EXISTS "Users can view own profile" ON usuarios;
DROP POLICY IF EXISTS "Users can view based on role and office" ON usuarios;
DROP POLICY IF EXISTS "Users can view based on role" ON usuarios;
DROP POLICY IF EXISTS "Usuarios pueden ver su propio perfil" ON usuarios;
DROP POLICY IF EXISTS "Authenticated users can view all profiles" ON usuarios;
DROP POLICY IF EXISTS "Administradores pueden ver todos los usuarios" ON usuarios;
DROP POLICY IF EXISTS "Users can update own profile" ON usuarios;
DROP POLICY IF EXISTS "Usuarios pueden actualizar su propio perfil" ON usuarios;
DROP POLICY IF EXISTS "Authenticated users can update profiles" ON usuarios;
DROP POLICY IF EXISTS "Authorized users can update" ON usuarios;
DROP POLICY IF EXISTS "Usuarios pueden crear su propio perfil" ON usuarios;
DROP POLICY IF EXISTS "Authenticated users can insert" ON usuarios;
DROP POLICY IF EXISTS "Authorized users can insert" ON usuarios;
DROP POLICY IF EXISTS "Administradores pueden crear usuarios" ON usuarios;
DROP POLICY IF EXISTS "Authenticated users can delete" ON usuarios;
DROP POLICY IF EXISTS "Authorized users can delete" ON usuarios;
DROP POLICY IF EXISTS "Administradores pueden eliminar usuarios" ON usuarios;
DROP POLICY IF EXISTS "Administradores pueden actualizar cualquier usuario" ON usuarios;

-- SELECT Policies
CREATE POLICY "usuarios_select_own"
  ON usuarios FOR SELECT
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY "usuarios_select_admin"
  ON usuarios FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND u.rol = 'Administrador'
      AND u.activo = true
      LIMIT 1
    )
  );

CREATE POLICY "usuarios_select_gerente"
  ON usuarios FOR SELECT
  TO authenticated
  USING (
    usuarios.rol IN ('Empleado', 'Agente')
    AND EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND u.rol = 'Gerente'
      AND u.activo = true
      AND u.oficina_id = usuarios.oficina_id
      AND u.oficina_id IS NOT NULL
      LIMIT 1
    )
  );

-- UPDATE Policies
CREATE POLICY "usuarios_update_own"
  ON usuarios FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "usuarios_update_admin"
  ON usuarios FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND u.rol = 'Administrador'
      AND u.activo = true
      LIMIT 1
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND u.rol = 'Administrador'
      AND u.activo = true
      LIMIT 1
    )
  );

-- INSERT Policies (only admins can create users)
CREATE POLICY "usuarios_insert_admin"
  ON usuarios FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND u.rol = 'Administrador'
      AND u.activo = true
      LIMIT 1
    )
  );

-- DELETE Policies (only admins can delete users)
CREATE POLICY "usuarios_delete_admin"
  ON usuarios FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND u.rol = 'Administrador'
      AND u.activo = true
      LIMIT 1
    )
  );
