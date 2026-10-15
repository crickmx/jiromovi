/*
  # Restringir Gerentes a Ver Solo Su Oficina
  
  ## Problema
  Los Gerentes pueden ver a todos los usuarios del sistema debido a la política:
  "All authenticated users can read directory" con USING (true).
  
  Solo los Administradores deben ver todos los usuarios.
  Los Gerentes solo deben ver usuarios de su misma oficina.
  
  ## Solución
  Reemplazar la política SELECT actual con dos políticas específicas:
  1. Administradores: pueden ver todos los usuarios
  2. Gerentes: solo pueden ver usuarios de su oficina
  3. Empleados/Agentes: solo pueden ver su propio perfil y otros usuarios (para chat/directorio básico)
  
  ## Cambios
  1. Eliminar política permisiva actual: "All authenticated users can read directory"
  2. Agregar política para Administradores: acceso total
  3. Agregar política para Gerentes: solo su oficina
  4. Agregar política para otros roles: lectura básica para funcionalidad (chat, directorio público)
  
  ## Seguridad
  - Administradores: ven todos los usuarios (rol = 'Administrador')
  - Gerentes: ven solo usuarios con misma oficina_id
  - Empleados/Agentes: ven todos para funcionalidad básica (chat, comunicados)
  - Todos pueden ver su propio perfil
*/

-- Eliminar la política permisiva actual
DROP POLICY IF EXISTS "All authenticated users can read directory" ON usuarios;

-- Política 1: Administradores pueden ver todos los usuarios
CREATE POLICY "Admins can view all users"
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

-- Política 2: Gerentes pueden ver solo usuarios de su oficina
CREATE POLICY "Gerentes can view own office users"
  ON usuarios
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND u.rol = 'Gerente'
      AND u.oficina_id = usuarios.oficina_id
    )
  );

-- Política 3: Empleados y Agentes pueden ver otros usuarios (para chat, directorio público)
-- IMPORTANTE: Esta política permite lectura básica para funcionalidades como:
-- - Chat entre usuarios
-- - Ver nombres en comunicados
-- - Directorio público de contactos
CREATE POLICY "Employees and agents can view users"
  ON usuarios
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND u.rol IN ('Empleado', 'Agente')
    )
  );

-- Nota: La política "Users can read own profile" ya existe y permite que cada usuario vea su propio perfil

-- Log de confirmación
DO $$
BEGIN
  RAISE NOTICE '✅ Políticas SELECT restringidas por rol';
  RAISE NOTICE '✅ Administradores: acceso total';
  RAISE NOTICE '✅ Gerentes: solo su oficina';
  RAISE NOTICE '✅ Empleados/Agentes: acceso a todos (para chat y funcionalidad)';
  RAISE NOTICE '✅ Todos: pueden ver su propio perfil';
END $$;
