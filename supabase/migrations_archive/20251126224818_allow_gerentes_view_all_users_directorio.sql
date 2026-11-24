/*
  # Permitir a Gerentes Ver Todos los Usuarios en Directorio
  
  ## Problema
  La política "Gerentes view own office users" restringe a los Gerentes
  a ver solo usuarios de su oficina, pero el frontend del Directorio
  requiere que vean todos los usuarios (como Empleado/Agente).
  
  ## Solución
  Modificar la política de Gerentes para permitir ver todos los usuarios,
  igual que Empleados y Agentes.
  
  ## Cambios
  - Eliminar política restrictiva "Gerentes view own office users"
  - Crear nueva política "Gerentes view all users in directory"
  - Gerentes ahora ven todos los usuarios para funcionalidad de directorio
  
  ## Seguridad
  - Los Gerentes solo tienen acceso de LECTURA
  - No pueden crear, editar o eliminar usuarios (controlado por frontend)
  - Las políticas UPDATE/DELETE siguen siendo restrictivas
*/

-- Eliminar política restrictiva de Gerentes
DROP POLICY IF EXISTS "Gerentes view own office users" ON usuarios;

-- Crear nueva política: Gerentes pueden ver todos los usuarios
CREATE POLICY "Gerentes view all users in directory"
  ON usuarios
  FOR SELECT
  TO authenticated
  USING (
    get_current_user_role() = 'Gerente'
  );

-- Log de confirmación
DO $$
BEGIN
  RAISE NOTICE '✅ Política de Gerentes actualizada';
  RAISE NOTICE '✅ Gerentes ahora pueden ver todos los usuarios';
  RAISE NOTICE '✅ Acceso de solo lectura mantenido en frontend';
END $$;
