/*
  # Corregir Recursión Infinita en Políticas RLS de Usuarios
  
  ## Problema
  Las políticas "Admins can read all users" y "Gerentes can read office users"
  causan recursión infinita porque hacen consultas a la tabla usuarios dentro
  de las políticas de la misma tabla usuarios.
  
  Cuando un usuario intenta leer la tabla usuarios:
  1. RLS evalúa la política
  2. La política hace EXISTS (SELECT 1 FROM usuarios...)
  3. Esto requiere leer usuarios nuevamente
  4. Lo cual activa RLS otra vez
  5. → Recursión infinita
  
  ## Solución
  Eliminar las políticas que causan recursión. La política 
  "All authenticated users can read directory" con USING (true) 
  es suficiente para permitir el acceso al directorio sin causar recursión.
  
  ## Políticas que se mantienen
  - "Users can read own profile" → auth.uid() = id (sin recursión)
  - "All authenticated users can read directory" → true (sin recursión)
  - Políticas UPDATE que no causan problemas
*/

-- Eliminar políticas SELECT que causan recursión infinita
DROP POLICY IF EXISTS "Admins can read all users" ON usuarios;
DROP POLICY IF EXISTS "Gerentes can read office users" ON usuarios;

-- Verificar que RLS esté habilitado
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;

-- Log de confirmación
DO $$
BEGIN
  RAISE NOTICE '✅ Políticas recursivas eliminadas';
  RAISE NOTICE '✅ Solo políticas seguras activas:';
  RAISE NOTICE '   - Users can read own profile (auth.uid() = id)';
  RAISE NOTICE '   - All authenticated users can read directory (true)';
  RAISE NOTICE '✅ Login debería funcionar ahora';
END $$;
