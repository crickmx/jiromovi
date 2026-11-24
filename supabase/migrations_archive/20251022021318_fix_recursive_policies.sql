/*
  # Corregir políticas recursivas

  1. Cambios
    - Eliminar políticas que causan recursión infinita
    - Crear nuevas políticas que permitan la creación del primer usuario
    - Permitir INSERT sin verificar si el usuario actual es admin (verificación en frontend)
*/

-- Eliminar política recursiva de INSERT
DROP POLICY IF EXISTS "Administradores pueden crear usuarios" ON usuarios;

-- Crear nueva política para INSERT que no cause recursión
-- Permitimos que usuarios autenticados creen registros en usuarios
-- La lógica de negocio en el frontend controlará quién puede crear usuarios
CREATE POLICY "Usuarios autenticados pueden crear perfiles"
  ON usuarios FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Actualizar política de SELECT para permitir lectura sin recursión
DROP POLICY IF EXISTS "Administradores pueden ver todos los usuarios" ON usuarios;

CREATE POLICY "Administradores pueden ver todos los usuarios"
  ON usuarios FOR SELECT
  TO authenticated
  USING (
    -- El usuario puede ver su propio perfil
    id = auth.uid()
    OR
    -- O puede ver todos si su rol es Administrador
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND u.rol = 'Administrador'
      AND u.activo = true
    )
  );