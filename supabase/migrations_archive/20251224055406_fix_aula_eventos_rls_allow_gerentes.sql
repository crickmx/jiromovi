/*
  # Permitir a Gerentes crear eventos en Aula Digital

  1. Cambios
    - Actualizar políticas de INSERT, UPDATE y DELETE en aula_eventos
    - Permitir a usuarios con rol 'Administrador' o 'Gerente' gestionar eventos
    - Mantener las restricciones de visualización existentes

  2. Seguridad
    - Solo Administradores y Gerentes pueden crear/editar/eliminar eventos
    - Los usuarios siguen viendo solo eventos para los que tienen permiso
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Administradores pueden crear eventos" ON aula_eventos;
DROP POLICY IF EXISTS "Administradores pueden actualizar eventos" ON aula_eventos;
DROP POLICY IF EXISTS "Administradores pueden eliminar eventos" ON aula_eventos;
DROP POLICY IF EXISTS "Administradores pueden crear permisos" ON aula_eventos_permisos;
DROP POLICY IF EXISTS "Administradores pueden eliminar permisos" ON aula_eventos_permisos;

-- Recreate policies allowing both Administrador and Gerente roles

-- Administradores y Gerentes pueden crear eventos
CREATE POLICY "Administradores y Gerentes pueden crear eventos"
  ON aula_eventos
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol IN ('Administrador', 'Gerente')
    )
  );

-- Administradores y Gerentes pueden actualizar eventos
CREATE POLICY "Administradores y Gerentes pueden actualizar eventos"
  ON aula_eventos
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol IN ('Administrador', 'Gerente')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol IN ('Administrador', 'Gerente')
    )
  );

-- Administradores y Gerentes pueden eliminar eventos
CREATE POLICY "Administradores y Gerentes pueden eliminar eventos"
  ON aula_eventos
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol IN ('Administrador', 'Gerente')
    )
  );

-- Administradores y Gerentes pueden crear permisos
CREATE POLICY "Administradores y Gerentes pueden crear permisos"
  ON aula_eventos_permisos
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol IN ('Administrador', 'Gerente')
    )
  );

-- Administradores y Gerentes pueden eliminar permisos
CREATE POLICY "Administradores y Gerentes pueden eliminar permisos"
  ON aula_eventos_permisos
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol IN ('Administrador', 'Gerente')
    )
  );
