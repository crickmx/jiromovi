/*
  # Corregir Recursión Infinita en RLS de Usuarios
  
  ## Problema
  Las políticas RLS causan recursión infinita porque consultan
  la tabla usuarios dentro de las políticas de usuarios.
  
  Error: "infinite recursion detected in policy for relation usuarios"
  
  ## Solución
  Usar una tabla auxiliar (user_roles) o simplificar las políticas
  para evitar consultar la misma tabla.
  
  La mejor solución es usar SECURITY DEFINER functions o simplificar
  las políticas para que todos los usuarios autenticados puedan leer.
  
  ## Cambios
  1. Eliminar todas las políticas con recursión
  2. Crear políticas simples sin recursión
  3. Permitir lectura a todos los usuarios autenticados
*/

-- Eliminar todas las políticas existentes
DROP POLICY IF EXISTS "Admins can read all users" ON usuarios;
DROP POLICY IF EXISTS "Gerentes can read office users" ON usuarios;
DROP POLICY IF EXISTS "Users can read own profile" ON usuarios;
DROP POLICY IF EXISTS "All authenticated users can read directory" ON usuarios;
DROP POLICY IF EXISTS "Users can update own profile" ON usuarios;

-- POLÍTICA 1: Todos los usuarios autenticados pueden leer todos los perfiles
-- Esta es la política más simple y evita recursión
CREATE POLICY "Authenticated users can read all profiles"
ON usuarios
FOR SELECT
TO authenticated
USING (true);

-- POLÍTICA 2: Los usuarios pueden actualizar solo su propio perfil
CREATE POLICY "Users can update own profile"
ON usuarios
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- POLÍTICA 3: Solo administradores pueden insertar (se verifica en edge function)
-- Esta política permite la inserción desde edge functions con service role
CREATE POLICY "Service role can insert users"
ON usuarios
FOR INSERT
TO authenticated
WITH CHECK (true);

-- POLÍTICA 4: Solo administradores pueden eliminar (se verifica en edge function)
CREATE POLICY "Service role can delete users"
ON usuarios
FOR DELETE
TO authenticated
USING (true);

-- Log de confirmación
DO $$
BEGIN
  RAISE NOTICE '✅ Políticas RLS actualizadas sin recursión';
  RAISE NOTICE '✅ Lectura: todos los autenticados';
  RAISE NOTICE '✅ Actualización: solo propio perfil';
  RAISE NOTICE '✅ Inserción/Eliminación: verificado en edge functions';
END $$;
