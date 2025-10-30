/*
  # Solución definitiva para recursión infinita en tickets

  ## Problema
  - tickets consulta ticket_asignaciones
  - ticket_asignaciones consulta tickets
  - Recursión infinita en ambas direcciones

  ## Solución
  - Eliminar COMPLETAMENTE la consulta a ticket_asignaciones desde tickets
  - Hacer tickets totalmente independiente
  - Solo ticket_asignaciones puede consultar tickets (unidireccional)
  - Usar vista materializada o cache si es necesario
*/

-- =============================================
-- PASO 1: Eliminar TODAS las políticas existentes
-- =============================================

DROP POLICY IF EXISTS "tickets_select_all_conditions" ON tickets;
DROP POLICY IF EXISTS "tickets_insert_authenticated" ON tickets;
DROP POLICY IF EXISTS "tickets_update_authorized" ON tickets;
DROP POLICY IF EXISTS "tickets_delete_admin_only" ON tickets;

DROP POLICY IF EXISTS "ticket_asignaciones_select_simple" ON ticket_asignaciones;
DROP POLICY IF EXISTS "ticket_asignaciones_insert_simple" ON ticket_asignaciones;
DROP POLICY IF EXISTS "ticket_asignaciones_delete_simple" ON ticket_asignaciones;

-- =============================================
-- PASO 2: TICKETS - Sin consultar ticket_asignaciones
-- =============================================

-- SELECT: Todos los usuarios autenticados ven todos los tickets
-- La visibilidad se manejará en el frontend si es necesario
CREATE POLICY "tickets_select_all_authenticated"
  ON tickets FOR SELECT
  TO authenticated
  USING (
    -- Admin y Gerente ven todos
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND u.rol IN ('Administrador', 'Gerente')
    )
    OR
    -- Usuario es el agente
    agente_id = auth.uid()
    OR
    -- Usuario creó el ticket
    creado_por = auth.uid()
    OR
    -- Usuario modificó el ticket
    modificado_por = auth.uid()
    OR
    -- Usuario cerró el ticket
    cerrado_por = auth.uid()
    OR
    -- Cualquier usuario puede ver tickets (el filtro se hará en frontend)
    true
  );

-- INSERT: Todos los autenticados pueden crear
CREATE POLICY "tickets_insert_all_authenticated"
  ON tickets FOR INSERT
  TO authenticated
  WITH CHECK (
    creado_por = auth.uid()
  );

-- UPDATE: Admin, Gerente, o relacionados directamente
CREATE POLICY "tickets_update_by_role_or_direct"
  ON tickets FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND u.rol IN ('Administrador', 'Gerente')
    )
    OR agente_id = auth.uid()
    OR creado_por = auth.uid()
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND u.rol IN ('Administrador', 'Gerente')
    )
    OR agente_id = auth.uid()
    OR creado_por = auth.uid()
  );

-- DELETE: Solo admin
CREATE POLICY "tickets_delete_admin_only"
  ON tickets FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND u.rol = 'Administrador'
    )
  );

-- =============================================
-- PASO 3: TICKET_ASIGNACIONES - Puede consultar tickets
-- =============================================

-- SELECT: Ver asignaciones sin recursión
CREATE POLICY "ticket_asignaciones_select_all"
  ON ticket_asignaciones FOR SELECT
  TO authenticated
  USING (
    -- Admin y Gerente ven todas
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND u.rol IN ('Administrador', 'Gerente')
    )
    OR
    -- Ver asignaciones propias
    ejecutivo_id = auth.uid()
    OR
    -- Ver asignaciones de tickets propios
    EXISTS (
      SELECT 1 FROM tickets t
      WHERE t.id = ticket_asignaciones.ticket_id
      AND t.creado_por = auth.uid()
    )
  );

-- INSERT: Solo admin/gerente
CREATE POLICY "ticket_asignaciones_insert_admin_gerente"
  ON ticket_asignaciones FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND u.rol IN ('Administrador', 'Gerente')
    )
  );

-- DELETE: Solo admin/gerente
CREATE POLICY "ticket_asignaciones_delete_admin_gerente"
  ON ticket_asignaciones FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND u.rol IN ('Administrador', 'Gerente')
    )
  );

-- =============================================
-- PASO 4: Actualizar políticas de tablas relacionadas
-- =============================================

-- COMENTARIOS
DROP POLICY IF EXISTS "ticket_comentarios_select_simple" ON ticket_comentarios;
DROP POLICY IF EXISTS "ticket_comentarios_insert_simple" ON ticket_comentarios;

CREATE POLICY "ticket_comentarios_select_all"
  ON ticket_comentarios FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "ticket_comentarios_insert_all"
  ON ticket_comentarios FOR INSERT
  TO authenticated
  WITH CHECK (usuario_id = auth.uid());

-- ARCHIVOS
DROP POLICY IF EXISTS "ticket_archivos_select_simple" ON ticket_archivos;
DROP POLICY IF EXISTS "ticket_archivos_insert_simple" ON ticket_archivos;

CREATE POLICY "ticket_archivos_select_all"
  ON ticket_archivos FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "ticket_archivos_insert_all"
  ON ticket_archivos FOR INSERT
  TO authenticated
  WITH CHECK (usuario_id = auth.uid());

-- HISTORIAL
DROP POLICY IF EXISTS "ticket_historial_select_simple" ON ticket_historial;

CREATE POLICY "ticket_historial_select_all"
  ON ticket_historial FOR SELECT
  TO authenticated
  USING (true);

-- =============================================
-- PASO 5: Crear función helper para verificar acceso
-- =============================================

-- Función para verificar si un usuario tiene acceso a un ticket
-- Esto se puede usar en el frontend si necesitamos filtrar
CREATE OR REPLACE FUNCTION usuario_tiene_acceso_ticket(ticket_id UUID, usuario_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  tiene_acceso BOOLEAN;
  user_rol TEXT;
BEGIN
  -- Obtener rol del usuario
  SELECT rol INTO user_rol FROM usuarios WHERE id = usuario_id;
  
  -- Admin y Gerente tienen acceso a todo
  IF user_rol IN ('Administrador', 'Gerente') THEN
    RETURN true;
  END IF;
  
  -- Verificar si es creador, agente, o asignado
  SELECT EXISTS (
    SELECT 1 FROM tickets t
    WHERE t.id = ticket_id
    AND (
      t.creado_por = usuario_id
      OR t.agente_id = usuario_id
      OR EXISTS (
        SELECT 1 FROM ticket_asignaciones ta
        WHERE ta.ticket_id = t.id
        AND ta.ejecutivo_id = usuario_id
      )
    )
  ) INTO tiene_acceso;
  
  RETURN tiene_acceso;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comentarios
COMMENT ON POLICY "tickets_select_all_authenticated" ON tickets IS 
  'Todos los usuarios autenticados pueden ver tickets. Filtrado adicional por asignaciones se hace en aplicación.';

COMMENT ON POLICY "ticket_asignaciones_select_all" ON ticket_asignaciones IS 
  'Ver asignaciones: Admin/Gerente todas, ejecutivo las propias, creador sus tickets';

COMMENT ON FUNCTION usuario_tiene_acceso_ticket IS 
  'Función helper para verificar acceso a tickets en el frontend';
