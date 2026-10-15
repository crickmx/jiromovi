/*
  # Corregir recursión infinita en políticas RLS de Aula Virtual

  1. Cambios
    - Eliminar políticas recursivas que causan el problema
    - Crear nuevas políticas simplificadas sin recursión
    - Todos los usuarios autenticados pueden ver sesiones
    - Solo instructores y admins pueden modificar sesiones
    - Simplificar acceso a participantes

  2. Seguridad
    - Mantener RLS habilitado
    - Políticas basadas en rol y ownership
    - Sin recursión entre tablas relacionadas
*/

-- Eliminar políticas existentes que causan recursión
DROP POLICY IF EXISTS "Usuarios pueden ver sesiones donde participan" ON aula_virtual_sesiones;
DROP POLICY IF EXISTS "Usuarios pueden ver participantes de sus sesiones" ON aula_virtual_participantes;
DROP POLICY IF EXISTS "Instructores y admins pueden crear sesiones" ON aula_virtual_sesiones;
DROP POLICY IF EXISTS "Instructores y admins pueden actualizar sus sesiones" ON aula_virtual_sesiones;
DROP POLICY IF EXISTS "Instructores y admins pueden eliminar sus sesiones" ON aula_virtual_sesiones;
DROP POLICY IF EXISTS "Participantes pueden actualizar su propio estado" ON aula_virtual_participantes;
DROP POLICY IF EXISTS "Sistema puede insertar participantes" ON aula_virtual_participantes;

-- Políticas para aula_virtual_sesiones (sin recursión)
CREATE POLICY "Usuarios autenticados pueden ver todas las sesiones"
  ON aula_virtual_sesiones FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Instructores y admins pueden crear sesiones"
  ON aula_virtual_sesiones FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = instructor_id 
    OR (auth.jwt()->>'app_metadata')::jsonb->>'rol' = 'Administrador'
  );

CREATE POLICY "Instructores y admins pueden actualizar sesiones"
  ON aula_virtual_sesiones FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = instructor_id 
    OR (auth.jwt()->>'app_metadata')::jsonb->>'rol' = 'Administrador'
  );

CREATE POLICY "Instructores y admins pueden eliminar sesiones"
  ON aula_virtual_sesiones FOR DELETE
  TO authenticated
  USING (
    auth.uid() = instructor_id 
    OR (auth.jwt()->>'app_metadata')::jsonb->>'rol' = 'Administrador'
  );

-- Políticas para aula_virtual_participantes (sin recursión)
CREATE POLICY "Usuarios autenticados pueden ver participantes"
  ON aula_virtual_participantes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Sistema puede insertar participantes"
  ON aula_virtual_participantes FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Usuarios pueden actualizar su propio estado"
  ON aula_virtual_participantes FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = usuario_id 
    OR (auth.jwt()->>'app_metadata')::jsonb->>'rol' = 'Administrador'
  );

CREATE POLICY "Admins pueden eliminar participantes"
  ON aula_virtual_participantes FOR DELETE
  TO authenticated
  USING ((auth.jwt()->>'app_metadata')::jsonb->>'rol' = 'Administrador');
