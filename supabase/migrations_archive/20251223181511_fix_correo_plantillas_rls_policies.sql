/*
  # Corregir políticas RLS de correo_plantillas y correo_tipos_notificacion

  1. Cambios
    - Eliminar políticas que usan tabla `user_roles` inexistente
    - Crear nuevas políticas usando tabla `usuarios` con rol 'Administrador'
    - Alinear con las políticas de otras tablas del sistema

  2. Seguridad
    - Solo administradores pueden ver y gestionar tipos de notificación
    - Solo administradores pueden ver y gestionar plantillas de correo
    - Service role mantiene acceso completo para funciones edge
*/

-- Eliminar políticas antiguas de correo_tipos_notificacion
DROP POLICY IF EXISTS "Admins can manage correo_tipos_notificacion" ON correo_tipos_notificacion;

-- Crear nuevas políticas para correo_tipos_notificacion
CREATE POLICY "Admins can view notification types"
  ON correo_tipos_notificacion
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = (select auth.uid())
        AND usuarios.rol = 'Administrador'
    )
  );

CREATE POLICY "Admins can insert notification types"
  ON correo_tipos_notificacion
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = (select auth.uid())
        AND usuarios.rol = 'Administrador'
    )
  );

CREATE POLICY "Admins can update notification types"
  ON correo_tipos_notificacion
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = (select auth.uid())
        AND usuarios.rol = 'Administrador'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = (select auth.uid())
        AND usuarios.rol = 'Administrador'
    )
  );

CREATE POLICY "Admins can delete notification types"
  ON correo_tipos_notificacion
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = (select auth.uid())
        AND usuarios.rol = 'Administrador'
    )
  );

-- Service role full access
CREATE POLICY "Service role full access to notification types"
  ON correo_tipos_notificacion
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Eliminar políticas antiguas de correo_plantillas
DROP POLICY IF EXISTS "Admins can manage correo_plantillas" ON correo_plantillas;

-- Crear nuevas políticas para correo_plantillas
CREATE POLICY "Admins can view templates"
  ON correo_plantillas
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = (select auth.uid())
        AND usuarios.rol = 'Administrador'
    )
  );

CREATE POLICY "Admins can insert templates"
  ON correo_plantillas
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = (select auth.uid())
        AND usuarios.rol = 'Administrador'
    )
  );

CREATE POLICY "Admins can update templates"
  ON correo_plantillas
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = (select auth.uid())
        AND usuarios.rol = 'Administrador'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = (select auth.uid())
        AND usuarios.rol = 'Administrador'
    )
  );

CREATE POLICY "Admins can delete templates"
  ON correo_plantillas
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = (select auth.uid())
        AND usuarios.rol = 'Administrador'
    )
  );

-- Service role full access
CREATE POLICY "Service role full access to templates"
  ON correo_plantillas
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
