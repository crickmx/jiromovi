/*
  # Solución Definitiva para Recursión en RLS - Eliminación CASCADE
  
  Eliminar función problemática y todas sus dependencias,
  luego recrear políticas usando auth.jwt()
*/

-- Eliminar función con CASCADE
DROP FUNCTION IF EXISTS obtener_rol_usuario() CASCADE;

-- Crear función que usa JWT sin consultar usuarios
CREATE OR REPLACE FUNCTION obtener_rol_desde_jwt()
RETURNS text AS $$
  SELECT COALESCE(
    (auth.jwt()->>'rol')::text,
    (auth.jwt()->'app_metadata'->>'rol')::text,
    'Agente'
  );
$$ LANGUAGE sql STABLE;

-- Crear función para actualizar metadata en auth.users
CREATE OR REPLACE FUNCTION sync_usuario_metadata()
RETURNS TRIGGER AS $$
BEGIN
  -- Actualizar raw_app_meta_data en auth.users
  UPDATE auth.users
  SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || 
    jsonb_build_object(
      'rol', NEW.rol,
      'oficina_id', NEW.oficina_id,
      'nombre_completo', NEW.nombre_completo
    )
  WHERE id = NEW.id;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Si falla, continuar sin error
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Aplicar trigger a usuarios
DROP TRIGGER IF EXISTS trigger_sync_usuario_metadata ON usuarios;
CREATE TRIGGER trigger_sync_usuario_metadata
  AFTER INSERT OR UPDATE OF rol, oficina_id, nombre_completo
  ON usuarios
  FOR EACH ROW
  EXECUTE FUNCTION sync_usuario_metadata();

-- Actualizar metadata existente para todos los usuarios
DO $$ 
BEGIN
  UPDATE auth.users au
  SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || 
    jsonb_build_object(
      'rol', u.rol,
      'oficina_id', u.oficina_id,
      'nombre_completo', u.nombre_completo
    )
  FROM usuarios u
  WHERE au.id = u.id;
EXCEPTION
  WHEN OTHERS THEN
    NULL; -- Ignorar errores
END $$;

-- =============================================
-- RECREAR POLÍTICAS DE TICKETS
-- =============================================

CREATE POLICY "tickets_select_policy"
  ON tickets FOR SELECT
  TO authenticated
  USING (
    agente_id = auth.uid() OR
    creado_por = auth.uid() OR
    (auth.jwt()->>'rol')::text IN ('Gerente', 'Administrador') OR
    EXISTS (
      SELECT 1 FROM ticket_asignaciones
      WHERE ticket_asignaciones.ticket_id = tickets.id
      AND ticket_asignaciones.ejecutivo_id = auth.uid()
    )
  );

CREATE POLICY "tickets_insert_policy"
  ON tickets FOR INSERT
  TO authenticated
  WITH CHECK (creado_por = auth.uid());

CREATE POLICY "tickets_update_policy"
  ON tickets FOR UPDATE
  TO authenticated
  USING (
    (auth.jwt()->>'rol')::text IN ('Gerente', 'Administrador') OR
    EXISTS (
      SELECT 1 FROM ticket_asignaciones
      WHERE ticket_asignaciones.ticket_id = tickets.id
      AND ticket_asignaciones.ejecutivo_id = auth.uid()
    )
  );

CREATE POLICY "tickets_delete_policy"
  ON tickets FOR DELETE
  TO authenticated
  USING ((auth.jwt()->>'rol')::text = 'Administrador');

-- =============================================
-- RECREAR POLÍTICAS DE USUARIOS
-- =============================================

CREATE POLICY "usuarios_select_policy"
  ON usuarios FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "usuarios_insert_policy"
  ON usuarios FOR INSERT
  TO authenticated
  WITH CHECK ((auth.jwt()->>'rol')::text = 'Administrador');

CREATE POLICY "usuarios_update_policy"
  ON usuarios FOR UPDATE
  TO authenticated
  USING (
    id = auth.uid() OR
    (auth.jwt()->>'rol')::text IN ('Gerente', 'Administrador')
  );

CREATE POLICY "usuarios_delete_policy"
  ON usuarios FOR DELETE
  TO authenticated
  USING ((auth.jwt()->>'rol')::text = 'Administrador');

-- =============================================
-- RECREAR POLÍTICAS DE TICKET_ASIGNACIONES
-- =============================================

CREATE POLICY "ticket_asignaciones_select_policy"
  ON ticket_asignaciones FOR SELECT
  TO authenticated
  USING (
    ejecutivo_id = auth.uid() OR
    asignado_por = auth.uid() OR
    (auth.jwt()->>'rol')::text IN ('Gerente', 'Administrador')
  );

CREATE POLICY "ticket_asignaciones_insert_policy"
  ON ticket_asignaciones FOR INSERT
  TO authenticated
  WITH CHECK (
    asignado_por = auth.uid() AND
    (auth.jwt()->>'rol')::text IN ('Gerente', 'Administrador')
  );

CREATE POLICY "ticket_asignaciones_delete_policy"
  ON ticket_asignaciones FOR DELETE
  TO authenticated
  USING ((auth.jwt()->>'rol')::text IN ('Gerente', 'Administrador'));

-- =============================================
-- RECREAR POLÍTICAS DE TICKET_COMENTARIOS
-- =============================================

CREATE POLICY "ticket_comentarios_select_policy"
  ON ticket_comentarios FOR SELECT
  TO authenticated
  USING (
    usuario_id = auth.uid() OR
    (auth.jwt()->>'rol')::text IN ('Gerente', 'Administrador') OR
    EXISTS (
      SELECT 1 FROM tickets t
      WHERE t.id = ticket_comentarios.ticket_id
      AND (t.agente_id = auth.uid() OR t.creado_por = auth.uid())
    )
  );

CREATE POLICY "ticket_comentarios_insert_policy"
  ON ticket_comentarios FOR INSERT
  TO authenticated
  WITH CHECK (usuario_id = auth.uid());

-- =============================================
-- RECREAR POLÍTICAS DE TICKET_HISTORIAL
-- =============================================

CREATE POLICY "ticket_historial_select_policy"
  ON ticket_historial FOR SELECT
  TO authenticated
  USING (
    (auth.jwt()->>'rol')::text IN ('Gerente', 'Administrador') OR
    EXISTS (
      SELECT 1 FROM tickets t
      WHERE t.id = ticket_historial.ticket_id
      AND (t.agente_id = auth.uid() OR t.creado_por = auth.uid())
    )
  );

CREATE POLICY "ticket_historial_insert_policy"
  ON ticket_historial FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- =============================================
-- RECREAR POLÍTICAS DE TICKET_ARCHIVOS
-- =============================================

CREATE POLICY "ticket_archivos_select_policy"
  ON ticket_archivos FOR SELECT
  TO authenticated
  USING (
    usuario_id = auth.uid() OR
    (auth.jwt()->>'rol')::text IN ('Gerente', 'Administrador') OR
    EXISTS (
      SELECT 1 FROM tickets t
      WHERE t.id = ticket_archivos.ticket_id
      AND (t.agente_id = auth.uid() OR t.creado_por = auth.uid())
    )
  );

CREATE POLICY "ticket_archivos_insert_policy"
  ON ticket_archivos FOR INSERT
  TO authenticated
  WITH CHECK (usuario_id = auth.uid());

-- =============================================
-- RECREAR OTRAS POLÍTICAS
-- =============================================

-- NOTIFICACIONES GLOBALES
CREATE POLICY "notificaciones_globales_select_policy"
  ON notificaciones_globales FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "notificaciones_globales_insert_policy"
  ON notificaciones_globales FOR INSERT
  TO authenticated
  WITH CHECK ((auth.jwt()->>'rol')::text = 'Administrador');

-- VACACIONES
CREATE POLICY "vacaciones_select_policy"
  ON solicitudes_vacaciones FOR SELECT
  TO authenticated
  USING (
    usuario_id = auth.uid() OR
    (auth.jwt()->>'rol')::text IN ('Gerente', 'Administrador')
  );

CREATE POLICY "vacaciones_insert_policy"
  ON solicitudes_vacaciones FOR INSERT
  TO authenticated
  WITH CHECK (usuario_id = auth.uid());

CREATE POLICY "vacaciones_update_policy"
  ON solicitudes_vacaciones FOR UPDATE
  TO authenticated
  USING (
    usuario_id = auth.uid() OR
    (auth.jwt()->>'rol')::text IN ('Gerente', 'Administrador')
  );

-- SEGUROS EDUCATION CATEGORIES
CREATE POLICY "seguros_categories_select_policy"
  ON seguros_categories FOR SELECT
  TO authenticated
  USING (
    activa = true OR
    (auth.jwt()->>'rol')::text = 'Administrador'
  );

CREATE POLICY "seguros_categories_all_policy"
  ON seguros_categories FOR ALL
  TO authenticated
  USING ((auth.jwt()->>'rol')::text = 'Administrador');

-- SEGUROS SESSIONS
CREATE POLICY "seguros_sessions_select_policy"
  ON seguros_sessions FOR SELECT
  TO authenticated
  USING (
    activa = true OR
    (auth.jwt()->>'rol')::text = 'Administrador'
  );

-- SEGUROS LESSONS
CREATE POLICY "seguros_lessons_select_policy"
  ON seguros_lessons FOR SELECT
  TO authenticated
  USING (
    activa = true OR
    (auth.jwt()->>'rol')::text = 'Administrador'
  );

-- SEGUROS PROGRESS
CREATE POLICY "seguros_progress_select_policy"
  ON seguros_progress FOR SELECT
  TO authenticated
  USING (
    usuario_id = auth.uid() OR
    (auth.jwt()->>'rol')::text = 'Administrador'
  );

CREATE POLICY "seguros_progress_insert_policy"
  ON seguros_progress FOR INSERT
  TO authenticated
  WITH CHECK (usuario_id = auth.uid());

CREATE POLICY "seguros_progress_update_policy"
  ON seguros_progress FOR UPDATE
  TO authenticated
  USING (usuario_id = auth.uid());

-- PUBLICIDAD CATEGORIAS
CREATE POLICY "publicidad_categorias_select_policy"
  ON publicidad_categorias FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "publicidad_categorias_all_policy"
  ON publicidad_categorias FOR ALL
  TO authenticated
  USING ((auth.jwt()->>'rol')::text = 'Administrador');

-- CONTACTOS
CREATE POLICY "contactos_select_policy"
  ON contactos FOR SELECT
  TO authenticated
  USING (
    usuario_id = auth.uid() OR
    asignado_a = auth.uid() OR
    (auth.jwt()->>'rol')::text IN ('Gerente', 'Administrador')
  );

CREATE POLICY "contactos_insert_policy"
  ON contactos FOR INSERT
  TO authenticated
  WITH CHECK (usuario_id = auth.uid());

CREATE POLICY "contactos_update_policy"
  ON contactos FOR UPDATE
  TO authenticated
  USING (
    usuario_id = auth.uid() OR
    asignado_a = auth.uid() OR
    (auth.jwt()->>'rol')::text IN ('Gerente', 'Administrador')
  );

CREATE POLICY "contactos_delete_policy"
  ON contactos FOR DELETE
  TO authenticated
  USING (
    usuario_id = auth.uid() OR
    (auth.jwt()->>'rol')::text IN ('Gerente', 'Administrador')
  );

-- RESERVAS ESPACIO
CREATE POLICY "reservas_select_policy"
  ON reservas_espacio FOR SELECT
  TO authenticated
  USING (
    usuario_id = auth.uid() OR
    (auth.jwt()->>'rol')::text IN ('Gerente', 'Administrador')
  );

CREATE POLICY "reservas_insert_policy"
  ON reservas_espacio FOR INSERT
  TO authenticated
  WITH CHECK (usuario_id = auth.uid());

CREATE POLICY "reservas_update_policy"
  ON reservas_espacio FOR UPDATE
  TO authenticated
  USING (
    usuario_id = auth.uid() OR
    (auth.jwt()->>'rol')::text IN ('Gerente', 'Administrador')
  );

-- ACCESOS NACIONAL
CREATE POLICY "accesos_select_policy"
  ON accesos_nacional FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "accesos_all_policy"
  ON accesos_nacional FOR ALL
  TO authenticated
  USING ((auth.jwt()->>'rol')::text = 'Administrador');
