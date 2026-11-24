/*
  # Permitir a administradores leer todos los usuarios
  
  1. Cambios
    - Agregar política para que Administradores puedan leer TODOS los usuarios
    - Esta política es crítica para el módulo de Mapeo de Vendedores
    - Los administradores necesitan ver la lista completa de usuarios para asignar mapeos
  
  2. Seguridad
    - Solo afecta la lectura (SELECT)
    - Solo usuarios con rol 'Administrador' pueden leer todos
    - Otros usuarios siguen viendo solo su propio perfil
*/

-- Agregar política para que administradores lean todos los usuarios
DROP POLICY IF EXISTS "Admins can read all users" ON usuarios;
CREATE POLICY "Admins can read all users" ON usuarios
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND u.rol = 'Administrador'
    )
  );
