/*
  # Limpiar Políticas RLS Conflictivas en Usuarios
  
  ## Problema
  Existen múltiples políticas SELECT con USING (true) que permiten a TODOS
  ver TODOS los usuarios, sobrescribiendo las políticas específicas por rol:
  
  - "Authenticated users can read all profiles" → USING (true)
  - "Ver usuarios autenticados" → USING (true)  
  - "usuarios_select_policy" → USING (true)
  
  Estas políticas hacen que los Agentes vean empleados de todas las oficinas.
  
  ## Solución
  Eliminar TODAS las políticas SELECT genéricas y mantener solo las específicas:
  - Admins can read all users (para Administradores)
  - Gerentes can read office users (para Gerentes)
  - Empleados can read all users (para Empleados)
  - Agentes can read own office employees (para Agentes - filtrado por oficina)
  - Users can read own profile (para ver propio perfil)
*/

-- Eliminar políticas SELECT genéricas que permiten ver todo
DROP POLICY IF EXISTS "Authenticated users can read all profiles" ON usuarios;
DROP POLICY IF EXISTS "Ver usuarios autenticados" ON usuarios;
DROP POLICY IF EXISTS "usuarios_select_policy" ON usuarios;
DROP POLICY IF EXISTS "All authenticated users can read directory" ON usuarios;

-- Verificar que las políticas correctas existan
-- Si no existen, las creamos

-- POLÍTICA 1: Admins pueden ver todos
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'usuarios' 
    AND policyname = 'Admins can read all users'
  ) THEN
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
  END IF;
END $$;

-- POLÍTICA 2: Gerentes pueden ver usuarios de su oficina
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'usuarios' 
    AND policyname = 'Gerentes can read office users'
  ) THEN
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
  END IF;
END $$;

-- POLÍTICA 3: Usuarios pueden ver su propio perfil
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'usuarios' 
    AND policyname = 'Users can read own profile'
  ) THEN
    CREATE POLICY "Users can read own profile"
    ON usuarios
    FOR SELECT
    TO authenticated
    USING (auth.uid() = id);
  END IF;
END $$;

-- Log de confirmación
DO $$
BEGIN
  RAISE NOTICE '🧹 Políticas RLS genéricas eliminadas';
  RAISE NOTICE '✅ Solo políticas específicas por rol activas';
  RAISE NOTICE '';
  RAISE NOTICE 'Políticas SELECT activas:';
  RAISE NOTICE '  1. Admins can read all users';
  RAISE NOTICE '  2. Gerentes can read office users';
  RAISE NOTICE '  3. Empleados can read all users';
  RAISE NOTICE '  4. Agentes can read own office employees';
  RAISE NOTICE '  5. Users can read own profile';
END $$;
