/*
  # Optimización RLS - Parte 3 Simplificada

  Optimización de políticas RLS para tablas críticas sin errores
*/

-- CONFIGURACION_SISTEMA
DROP POLICY IF EXISTS "Admin puede gestionar configuración" ON configuracion_sistema;
CREATE POLICY "Admin puede gestionar configuración"
  ON configuracion_sistema
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = (select auth.uid()) AND rol = 'Administrador'
    )
  );

-- AULA_VIRTUAL_SESIONES
DROP POLICY IF EXISTS "Instructores y admins pueden actualizar sesiones" ON aula_virtual_sesiones;
CREATE POLICY "Instructores y admins pueden actualizar sesiones"
  ON aula_virtual_sesiones
  FOR UPDATE
  TO authenticated
  USING (
    instructor_id = (select auth.uid())
    OR EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = (select auth.uid()) AND rol = 'Administrador'
    )
  );

DROP POLICY IF EXISTS "Instructores y admins pueden crear sesiones" ON aula_virtual_sesiones;
CREATE POLICY "Instructores y admins pueden crear sesiones"
  ON aula_virtual_sesiones
  FOR INSERT
  TO authenticated
  WITH CHECK (
    instructor_id = (select auth.uid())
    OR EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = (select auth.uid()) AND rol = 'Administrador'
    )
  );

DROP POLICY IF EXISTS "Instructores y admins pueden eliminar sesiones" ON aula_virtual_sesiones;
CREATE POLICY "Instructores y admins pueden eliminar sesiones"
  ON aula_virtual_sesiones
  FOR DELETE
  TO authenticated
  USING (
    instructor_id = (select auth.uid())
    OR EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = (select auth.uid()) AND rol = 'Administrador'
    )
  );

-- AULA_VIRTUAL_GRABACIONES  
DROP POLICY IF EXISTS "Usuarios pueden ver grabaciones de sus sesiones" ON aula_virtual_grabaciones;
CREATE POLICY "Usuarios pueden ver grabaciones de sus sesiones"
  ON aula_virtual_grabaciones
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM aula_virtual_participantes avp
      WHERE avp.sesion_id = aula_virtual_grabaciones.sesion_id
        AND avp.usuario_id = (select auth.uid())
    )
  );

-- AULA_VIRTUAL_CHAT
DROP POLICY IF EXISTS "Participantes pueden enviar mensajes" ON aula_virtual_chat;
CREATE POLICY "Participantes pueden enviar mensajes"
  ON aula_virtual_chat
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM aula_virtual_participantes
      WHERE sesion_id = aula_virtual_chat.sesion_id
        AND usuario_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Participantes pueden ver chat de su sesión" ON aula_virtual_chat;
CREATE POLICY "Participantes pueden ver chat de su sesión"
  ON aula_virtual_chat
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM aula_virtual_participantes
      WHERE sesion_id = aula_virtual_chat.sesion_id
        AND usuario_id = (select auth.uid())
    )
  );

-- AULA_VIRTUAL_EVENTOS
DROP POLICY IF EXISTS "Usuarios pueden ver eventos de sus sesiones" ON aula_virtual_eventos;
CREATE POLICY "Usuarios pueden ver eventos de sus sesiones"
  ON aula_virtual_eventos
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM aula_virtual_participantes
      WHERE sesion_id = aula_virtual_eventos.sesion_id
        AND usuario_id = (select auth.uid())
    )
  );

-- AULA_VIRTUAL_PARTICIPANTES
DROP POLICY IF EXISTS "Admins pueden eliminar participantes" ON aula_virtual_participantes;
CREATE POLICY "Admins pueden eliminar participantes"
  ON aula_virtual_participantes
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = (select auth.uid()) AND rol = 'Administrador'
    )
  );

DROP POLICY IF EXISTS "Usuarios pueden actualizar su propio estado" ON aula_virtual_participantes;
CREATE POLICY "Usuarios pueden actualizar su propio estado"
  ON aula_virtual_participantes
  FOR UPDATE
  TO authenticated
  USING (usuario_id = (select auth.uid()));

-- PRODUCTION_OFFICES
DROP POLICY IF EXISTS "Admins can insert offices" ON production_offices;
CREATE POLICY "Admins can insert offices"
  ON production_offices
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = (select auth.uid()) AND rol = 'Administrador'
    )
  );

DROP POLICY IF EXISTS "Admins can update offices" ON production_offices;
CREATE POLICY "Admins can update offices"
  ON production_offices
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = (select auth.uid()) AND rol = 'Administrador'
    )
  );

DROP POLICY IF EXISTS "Admins can view all offices" ON production_offices;
CREATE POLICY "Admins can view all offices"
  ON production_offices
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = (select auth.uid()) AND rol = 'Administrador'
    )
  );

-- PRODUCTION_MANAGEMENTS
DROP POLICY IF EXISTS "Admins can insert managements" ON production_managements;
CREATE POLICY "Admins can insert managements"
  ON production_managements
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = (select auth.uid()) AND rol = 'Administrador'
    )
  );

DROP POLICY IF EXISTS "Admins can update managements" ON production_managements;
CREATE POLICY "Admins can update managements"
  ON production_managements
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = (select auth.uid()) AND rol = 'Administrador'
    )
  );

-- PRODUCTION_IMPORT_LOGS
DROP POLICY IF EXISTS "Admins can insert import logs" ON production_import_logs;
CREATE POLICY "Admins can insert import logs"
  ON production_import_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = (select auth.uid()) AND rol = 'Administrador'
    )
  );

-- EMAIL_CONFIG_GLOBAL
DROP POLICY IF EXISTS "Only admins can modify email config" ON email_config_global;
CREATE POLICY "Only admins can modify email config"
  ON email_config_global
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = (select auth.uid()) AND rol = 'Administrador'
    )
  );

-- WHATSAPP_CONFIGURACION
DROP POLICY IF EXISTS "Admins can manage whatsapp_configuracion" ON whatsapp_configuracion;
CREATE POLICY "Admins can manage whatsapp_configuracion"
  ON whatsapp_configuracion
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = (select auth.uid()) AND rol = 'Administrador'
    )
  );

-- PRODUCTION_OFFICE_MAPPING
DROP POLICY IF EXISTS "Admins can delete office mappings" ON production_office_mapping;
CREATE POLICY "Admins can delete office mappings"
  ON production_office_mapping
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = (select auth.uid()) AND rol = 'Administrador'
    )
  );

DROP POLICY IF EXISTS "Admins can insert office mappings" ON production_office_mapping;
CREATE POLICY "Admins can insert office mappings"
  ON production_office_mapping
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = (select auth.uid()) AND rol = 'Administrador'
    )
  );

DROP POLICY IF EXISTS "Admins can update office mappings" ON production_office_mapping;
CREATE POLICY "Admins can update office mappings"
  ON production_office_mapping
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = (select auth.uid()) AND rol = 'Administrador'
    )
  );
