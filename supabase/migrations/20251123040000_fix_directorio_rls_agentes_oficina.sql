/*
  # Corregir RLS para Directorio JIRO - Agentes por Oficina
  
  ## Problema
  La política "All authenticated users can read directory" permite a TODOS los usuarios
  ver TODOS los perfiles usando USING (true). Esto hace que los Agentes vean empleados
  de todas las oficinas, no solo de la suya.
  
  ## Solución
  Reemplazar la política general con políticas específicas por rol:
  - Administradores: ven todos los usuarios
  - Gerentes: ven usuarios de su oficina
  - Empleados: ven todos los empleados (directorio completo)
  - Agentes: SOLO ven empleados de su propia oficina
  
  ## Cambios
  1. Eliminar política "All authenticated users can read directory"
  2. Crear política específica para Empleados
  3. Crear política específica para Agentes (filtrado por oficina)
*/

-- Eliminar política que permite ver todo
DROP POLICY IF EXISTS "All authenticated users can read directory" ON usuarios;

-- POLÍTICA 1: Empleados pueden ver el directorio completo
-- Los empleados necesitan ver a todos para colaboración
CREATE POLICY "Empleados can read all users"
ON usuarios
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM usuarios u
    WHERE u.id = auth.uid()
    AND u.rol = 'Empleado'
  )
);

-- POLÍTICA 2: Agentes SOLO pueden ver empleados de su propia oficina
-- Esto asegura que cada agente solo vea empleados de su oficina
CREATE POLICY "Agentes can read own office employees"
ON usuarios
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM usuarios agente
    WHERE agente.id = auth.uid()
    AND agente.rol = 'Agente'
    AND (
      -- El agente puede ver su propio perfil
      usuarios.id = auth.uid()
      OR
      -- El agente puede ver empleados de su oficina
      (
        usuarios.rol = 'Empleado' 
        AND usuarios.oficina_id = agente.oficina_id
        AND agente.oficina_id IS NOT NULL
      )
    )
  )
);

-- Log de confirmación
DO $$
BEGIN
  RAISE NOTICE '✅ Políticas RLS actualizadas para Directorio JIRO';
  RAISE NOTICE '✅ Administradores: pueden ver todos los usuarios';
  RAISE NOTICE '✅ Gerentes: pueden ver usuarios de su oficina';
  RAISE NOTICE '✅ Empleados: pueden ver todos los usuarios';
  RAISE NOTICE '✅ Agentes: SOLO pueden ver empleados de su oficina';
END $$;
