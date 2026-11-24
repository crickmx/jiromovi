/*
  # Corregir Recursión en Todas las Políticas RLS
  
  1. Problema
    - Múltiples tablas pueden tener subconsultas recursivas a usuarios
    
  2. Solución
    - Usar la función obtener_rol_usuario() en todas las políticas
    - Simplificar políticas complejas
*/

-- =============================================
-- CORREGIR NOTIFICACIONES
-- =============================================

DROP POLICY IF EXISTS "Usuarios pueden ver sus notificaciones" ON notificaciones;
DROP POLICY IF EXISTS "Solo admin puede enviar notificaciones globales" ON notificaciones;

CREATE POLICY "Ver notificaciones propias"
  ON notificaciones FOR SELECT
  TO authenticated
  USING (usuario_id = auth.uid());

CREATE POLICY "Crear notificaciones"
  ON notificaciones FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Actualizar notificaciones propias"
  ON notificaciones FOR UPDATE
  TO authenticated
  USING (usuario_id = auth.uid())
  WITH CHECK (usuario_id = auth.uid());

CREATE POLICY "Eliminar notificaciones propias"
  ON notificaciones FOR DELETE
  TO authenticated
  USING (usuario_id = auth.uid());

-- =============================================
-- CORREGIR NOTIFICACIONES GLOBALES
-- =============================================

DROP POLICY IF EXISTS "Todos pueden ver notificaciones globales" ON notificaciones_globales;
DROP POLICY IF EXISTS "Solo admin puede crear notificaciones globales" ON notificaciones_globales;

CREATE POLICY "Ver notificaciones globales"
  ON notificaciones_globales FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Crear notificaciones globales admin"
  ON notificaciones_globales FOR INSERT
  TO authenticated
  WITH CHECK (obtener_rol_usuario() = 'Administrador');

-- =============================================
-- CORREGIR CHAT
-- =============================================

DROP POLICY IF EXISTS "Miembros pueden ver sus chats" ON chats;
DROP POLICY IF EXISTS "Usuarios pueden crear chats" ON chats;

CREATE POLICY "Ver chats donde soy miembro"
  ON chats FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM chat_miembros
      WHERE chat_miembros.chat_id = chats.id
      AND chat_miembros.usuario_id = auth.uid()
    )
  );

CREATE POLICY "Crear chats"
  ON chats FOR INSERT
  TO authenticated
  WITH CHECK (creador_id = auth.uid());

CREATE POLICY "Actualizar chats donde soy miembro"
  ON chats FOR UPDATE
  TO authenticated
  USING (
    creador_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM chat_miembros
      WHERE chat_miembros.chat_id = chats.id
      AND chat_miembros.usuario_id = auth.uid()
      AND chat_miembros.rol = 'admin'
    )
  );

-- =============================================
-- CORREGIR CHAT_MENSAJES
-- =============================================

DROP POLICY IF EXISTS "Miembros pueden ver mensajes de sus chats" ON chat_mensajes;
DROP POLICY IF EXISTS "Usuarios pueden enviar mensajes" ON chat_mensajes;

CREATE POLICY "Ver mensajes de chats donde soy miembro"
  ON chat_mensajes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM chat_miembros
      WHERE chat_miembros.chat_id = chat_mensajes.chat_id
      AND chat_miembros.usuario_id = auth.uid()
    )
  );

CREATE POLICY "Enviar mensajes a chats donde soy miembro"
  ON chat_mensajes FOR INSERT
  TO authenticated
  WITH CHECK (
    remitente_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM chat_miembros
      WHERE chat_miembros.chat_id = chat_mensajes.chat_id
      AND chat_miembros.usuario_id = auth.uid()
    )
  );

CREATE POLICY "Actualizar mensajes propios"
  ON chat_mensajes FOR UPDATE
  TO authenticated
  USING (remitente_id = auth.uid())
  WITH CHECK (remitente_id = auth.uid());

CREATE POLICY "Eliminar mensajes propios"
  ON chat_mensajes FOR DELETE
  TO authenticated
  USING (remitente_id = auth.uid());

-- =============================================
-- CORREGIR CHAT_MIEMBROS
-- =============================================

DROP POLICY IF EXISTS "Miembros pueden ver otros miembros" ON chat_miembros;
DROP POLICY IF EXISTS "Agregar miembros a chats" ON chat_miembros;

CREATE POLICY "Ver miembros de chats donde participo"
  ON chat_miembros FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM chat_miembros cm
      WHERE cm.chat_id = chat_miembros.chat_id
      AND cm.usuario_id = auth.uid()
    )
  );

CREATE POLICY "Agregar miembros a chats"
  ON chat_miembros FOR INSERT
  TO authenticated
  WITH CHECK (
    usuario_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM chats
      WHERE chats.id = chat_miembros.chat_id
      AND chats.creador_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM chat_miembros cm
      WHERE cm.chat_id = chat_miembros.chat_id
      AND cm.usuario_id = auth.uid()
      AND cm.rol = 'admin'
    )
  );

-- =============================================
-- CORREGIR VACACIONES
-- =============================================

DROP POLICY IF EXISTS "Usuarios pueden ver sus vacaciones" ON solicitudes_vacaciones;
DROP POLICY IF EXISTS "Gerentes pueden ver vacaciones" ON solicitudes_vacaciones;

CREATE POLICY "Ver vacaciones propias o gestionar"
  ON solicitudes_vacaciones FOR SELECT
  TO authenticated
  USING (
    usuario_id = auth.uid() OR
    obtener_rol_usuario() IN ('Gerente', 'Administrador')
  );

CREATE POLICY "Crear solicitudes de vacaciones"
  ON solicitudes_vacaciones FOR INSERT
  TO authenticated
  WITH CHECK (usuario_id = auth.uid());

CREATE POLICY "Actualizar vacaciones si es gerente o admin"
  ON solicitudes_vacaciones FOR UPDATE
  TO authenticated
  USING (
    usuario_id = auth.uid() OR
    obtener_rol_usuario() IN ('Gerente', 'Administrador')
  );

-- =============================================
-- CORREGIR SEGUROS EDUCATION
-- =============================================

DROP POLICY IF EXISTS "Ver categorías activas" ON seguros_categories;

CREATE POLICY "Ver categorías activas"
  ON seguros_categories FOR SELECT
  TO authenticated
  USING (activa = true OR obtener_rol_usuario() = 'Administrador');

CREATE POLICY "Gestionar categorías admin"
  ON seguros_categories FOR ALL
  TO authenticated
  USING (obtener_rol_usuario() = 'Administrador');

DROP POLICY IF EXISTS "Ver sesiones asignadas" ON seguros_sessions;

CREATE POLICY "Ver sesiones activas"
  ON seguros_sessions FOR SELECT
  TO authenticated
  USING (activa = true OR obtener_rol_usuario() = 'Administrador');

DROP POLICY IF EXISTS "Ver lecciones asignadas" ON seguros_lessons;

CREATE POLICY "Ver lecciones activas"
  ON seguros_lessons FOR SELECT
  TO authenticated
  USING (activa = true OR obtener_rol_usuario() = 'Administrador');

DROP POLICY IF EXISTS "Ver progreso propio" ON seguros_progress;

CREATE POLICY "Ver progreso propio o admin"
  ON seguros_progress FOR SELECT
  TO authenticated
  USING (
    usuario_id = auth.uid() OR
    obtener_rol_usuario() = 'Administrador'
  );

CREATE POLICY "Actualizar progreso propio"
  ON seguros_progress FOR INSERT
  TO authenticated
  WITH CHECK (usuario_id = auth.uid());

CREATE POLICY "Modificar progreso propio"
  ON seguros_progress FOR UPDATE
  TO authenticated
  USING (usuario_id = auth.uid())
  WITH CHECK (usuario_id = auth.uid());

-- =============================================
-- CORREGIR PUBLICIDAD
-- =============================================

DROP POLICY IF EXISTS "Todos pueden ver categorías" ON publicidad_categorias;
DROP POLICY IF EXISTS "Solo admin puede crear categorías" ON publicidad_categorias;
DROP POLICY IF EXISTS "Solo admin puede actualizar categorías" ON publicidad_categorias;
DROP POLICY IF EXISTS "Solo admin puede eliminar categorías" ON publicidad_categorias;

CREATE POLICY "Ver categorías de publicidad"
  ON publicidad_categorias FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Gestionar categorías admin"
  ON publicidad_categorias FOR ALL
  TO authenticated
  USING (obtener_rol_usuario() = 'Administrador');

-- =============================================
-- CORREGIR CONTACTOS
-- =============================================

DROP POLICY IF EXISTS "Ver contactos propios" ON contactos;
DROP POLICY IF EXISTS "Gerentes pueden ver todos los contactos" ON contactos;

CREATE POLICY "Ver contactos propios o gestionar"
  ON contactos FOR SELECT
  TO authenticated
  USING (
    usuario_id = auth.uid() OR
    asignado_a = auth.uid() OR
    obtener_rol_usuario() IN ('Gerente', 'Administrador')
  );

CREATE POLICY "Crear contactos"
  ON contactos FOR INSERT
  TO authenticated
  WITH CHECK (usuario_id = auth.uid());

CREATE POLICY "Actualizar contactos propios"
  ON contactos FOR UPDATE
  TO authenticated
  USING (
    usuario_id = auth.uid() OR
    asignado_a = auth.uid() OR
    obtener_rol_usuario() IN ('Gerente', 'Administrador')
  );

CREATE POLICY "Eliminar contactos propios"
  ON contactos FOR DELETE
  TO authenticated
  USING (
    usuario_id = auth.uid() OR
    obtener_rol_usuario() IN ('Gerente', 'Administrador')
  );

-- =============================================
-- CORREGIR MEETINGS
-- =============================================

DROP POLICY IF EXISTS "Ver meetings propios" ON meetings;
DROP POLICY IF EXISTS "Participantes pueden ver meetings" ON meetings;

CREATE POLICY "Ver meetings donde participo"
  ON meetings FOR SELECT
  TO authenticated
  USING (
    host_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM meeting_participants
      WHERE meeting_participants.meeting_id = meetings.id
      AND meeting_participants.usuario_id = auth.uid()
    )
  );

CREATE POLICY "Crear meetings"
  ON meetings FOR INSERT
  TO authenticated
  WITH CHECK (host_id = auth.uid());

CREATE POLICY "Actualizar meetings propios"
  ON meetings FOR UPDATE
  TO authenticated
  USING (host_id = auth.uid())
  WITH CHECK (host_id = auth.uid());

-- =============================================
-- CORREGIR RESERVAS ESPACIO
-- =============================================

DROP POLICY IF EXISTS "Ver reservas propias" ON reservas_espacio;
DROP POLICY IF EXISTS "Gerentes pueden ver todas las reservas" ON reservas_espacio;

CREATE POLICY "Ver reservas propias o gestionar"
  ON reservas_espacio FOR SELECT
  TO authenticated
  USING (
    usuario_id = auth.uid() OR
    obtener_rol_usuario() IN ('Gerente', 'Administrador')
  );

CREATE POLICY "Crear reservas"
  ON reservas_espacio FOR INSERT
  TO authenticated
  WITH CHECK (usuario_id = auth.uid());

CREATE POLICY "Actualizar reservas propias"
  ON reservas_espacio FOR UPDATE
  TO authenticated
  USING (
    usuario_id = auth.uid() OR
    obtener_rol_usuario() IN ('Gerente', 'Administrador')
  );

-- =============================================
-- CORREGIR ACCESOS NACIONAL
-- =============================================

DROP POLICY IF EXISTS "Usuarios autenticados pueden ver accesos" ON accesos_nacional;

CREATE POLICY "Ver accesos nacional"
  ON accesos_nacional FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Gestionar accesos admin"
  ON accesos_nacional FOR ALL
  TO authenticated
  USING (obtener_rol_usuario() = 'Administrador');
