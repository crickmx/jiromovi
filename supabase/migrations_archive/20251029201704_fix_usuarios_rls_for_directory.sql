/*
  # Corregir RLS de Usuarios para el Directorio
  
  ## Problema
  Los usuarios nuevos no aparecen en el directorio porque las políticas RLS
  solo permiten ver el propio perfil, pero no hay políticas para que
  Administradores y Gerentes vean a otros usuarios.
  
  ## Solución
  Agregar políticas RLS que permitan:
  - Administradores: ver todos los usuarios
  - Gerentes: ver usuarios de su oficina
  - Empleados/Agentes: ver todos los usuarios (lectura pública del directorio)
  
  ## Cambios
  1. Agregar política para Administradores (ver todos)
  2. Agregar política para Gerentes (ver de su oficina)
  3. Agregar política para lectura general del directorio
*/

-- Eliminar políticas antiguas restrictivas
DROP POLICY IF EXISTS "Users can read own profile" ON usuarios;

-- POLÍTICA 1: Administradores pueden ver todos los usuarios
CREATE POLICY "Admins can read all users"
ON usuarios
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM usuarios u
    WHERE u.id = auth.uid()
    AND u.rol = 'Administrador'
  )
);

-- POLÍTICA 2: Gerentes pueden ver usuarios de su oficina
CREATE POLICY "Gerentes can read office users"
ON usuarios
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM usuarios gerente
    WHERE gerente.id = auth.uid()
    AND gerente.rol = 'Gerente'
    AND gerente.oficina_id = usuarios.oficina_id
  )
);

-- POLÍTICA 3: Todos pueden ver su propio perfil
CREATE POLICY "Users can read own profile"
ON usuarios
FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- POLÍTICA 4: Empleados y Agentes pueden ver el directorio completo (solo lectura)
CREATE POLICY "All authenticated users can read directory"
ON usuarios
FOR SELECT
TO authenticated
USING (true);

-- Log de confirmación
DO $$
BEGIN
  RAISE NOTICE '✅ Políticas RLS actualizadas para usuarios';
  RAISE NOTICE '✅ Administradores: pueden ver todos';
  RAISE NOTICE '✅ Gerentes: pueden ver su oficina';
  RAISE NOTICE '✅ Todos: pueden ver el directorio';
END $$;
