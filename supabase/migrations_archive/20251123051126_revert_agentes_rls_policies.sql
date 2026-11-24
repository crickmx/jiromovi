/*
  # Revertir Políticas RLS de Agentes
  
  ## Cambios
  1. Eliminar políticas específicas para Agentes y Empleados
  2. Restaurar política general que permite a todos ver el directorio
  
  ## Resultado
  Todos los usuarios autenticados pueden ver todos los perfiles nuevamente
*/

-- Eliminar políticas específicas creadas
DROP POLICY IF EXISTS "Agentes can read own office employees" ON usuarios;
DROP POLICY IF EXISTS "Empleados can read all users" ON usuarios;

-- Restaurar política general para directorio
CREATE POLICY "All authenticated users can read directory"
ON usuarios
FOR SELECT
TO authenticated
USING (true);

-- Log de confirmación
DO $$
BEGIN
  RAISE NOTICE '↩️ Políticas RLS revertidas';
  RAISE NOTICE '✅ Todos los usuarios autenticados pueden ver el directorio completo';
END $$;
