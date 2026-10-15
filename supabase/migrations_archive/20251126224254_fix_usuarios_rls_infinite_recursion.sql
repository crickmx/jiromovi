/*
  # Corregir Recursión Infinita en Políticas RLS de Usuarios
  
  ## Problema
  Las políticas SELECT causan recursión infinita porque consultan la tabla usuarios
  dentro de las mismas políticas de usuarios:
  
  ERROR: infinite recursion detected in policy for relation "usuarios"
  
  ## Causa
  ```sql
  EXISTS (
    SELECT 1 FROM usuarios u  -- ❌ Consulta usuarios dentro de política de usuarios
    WHERE u.id = auth.uid()
  )
  ```
  
  ## Solución
  Usar una función auxiliar que almacene en caché el rol y oficina del usuario
  para evitar consultar la tabla usuarios dentro de las políticas.
  
  ## Estrategia
  1. Crear función get_user_role_and_office() que use auth.uid()
  2. Usar SECURITY DEFINER para romper la recursión
  3. Cachear el resultado en la sesión
  4. Reescribir políticas sin EXISTS en usuarios
*/

-- Eliminar políticas que causan recursión
DROP POLICY IF EXISTS "Admins can view all users" ON usuarios;
DROP POLICY IF EXISTS "Gerentes can view own office users" ON usuarios;
DROP POLICY IF EXISTS "Employees and agents can view users" ON usuarios;

-- Crear función auxiliar que rompa la recursión
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT rol FROM public.usuarios WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.get_current_user_office()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT oficina_id FROM public.usuarios WHERE id = auth.uid();
$$;

-- Política 1: Administradores pueden ver todos los usuarios
CREATE POLICY "Admins view all users"
  ON usuarios
  FOR SELECT
  TO authenticated
  USING (
    get_current_user_role() = 'Administrador'
  );

-- Política 2: Gerentes pueden ver solo usuarios de su oficina
CREATE POLICY "Gerentes view own office users"
  ON usuarios
  FOR SELECT
  TO authenticated
  USING (
    get_current_user_role() = 'Gerente'
    AND oficina_id = get_current_user_office()
  );

-- Política 3: Empleados y Agentes pueden ver todos los usuarios
CREATE POLICY "Employees and agents view users"
  ON usuarios
  FOR SELECT
  TO authenticated
  USING (
    get_current_user_role() IN ('Empleado', 'Agente')
  );

-- Nota: La política "Users can read own profile" ya existe

-- Log de confirmación
DO $$
BEGIN
  RAISE NOTICE '✅ Políticas RLS corregidas sin recursión';
  RAISE NOTICE '✅ Usando funciones auxiliares con SECURITY DEFINER';
  RAISE NOTICE '✅ Administradores: acceso total';
  RAISE NOTICE '✅ Gerentes: solo su oficina';
  RAISE NOTICE '✅ Empleados/Agentes: acceso completo';
END $$;
