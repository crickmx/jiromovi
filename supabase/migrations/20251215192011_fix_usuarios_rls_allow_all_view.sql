/*
  # Permitir a todos los usuarios ver la lista completa de usuarios activos
  
  1. Cambios
    - Simplificar las políticas RLS para SELECT en usuarios
    - Permitir que todos los usuarios autenticados vean todos los usuarios activos
    - Esto es necesario para funciones como asignación de vendedores, directorio, etc.
  
  2. Seguridad
    - Solo usuarios autenticados pueden ver los datos
    - Solo se expone información no sensible (nombre, email laboral/personal, rol)
    - Los datos sensibles (passwords, configuraciones) siguen protegidos por columnas específicas
*/

-- Eliminar las políticas restrictivas de SELECT existentes
DROP POLICY IF EXISTS "Employees and agents view employees and gerentes" ON usuarios;
DROP POLICY IF EXISTS "Gerentes view employees and gerentes" ON usuarios;

-- Crear una nueva política que permita a todos los usuarios autenticados ver todos los usuarios activos
CREATE POLICY "Authenticated users can view all active users"
  ON usuarios
  FOR SELECT
  TO authenticated
  USING (activo = true);
