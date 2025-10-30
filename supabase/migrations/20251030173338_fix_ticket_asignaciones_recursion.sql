/*
  # Eliminar recursión infinita en ticket_asignaciones

  ## Problema
  - Política de ticket_asignaciones consulta tickets
  - Política de tickets consulta ticket_asignaciones
  - Esto causa recursión infinita

  ## Solución
  - Simplificar políticas de ticket_asignaciones
  - Evitar subconsultas circulares
  - Usar solo verificaciones directas
*/

-- =============================================
-- TICKET_ASIGNACIONES: Eliminar recursión
-- =============================================

DROP POLICY IF EXISTS "ticket_asignaciones_select_with_ticket_access" ON ticket_asignaciones;
DROP POLICY IF EXISTS "ticket_asignaciones_insert_authorized" ON ticket_asignaciones;
DROP POLICY IF EXISTS "ticket_asignaciones_delete_authorized" ON ticket_asignaciones;

-- SELECT: Ver asignaciones propias o si es admin/gerente
CREATE POLICY "ticket_asignaciones_select_simple"
  ON ticket_asignaciones FOR SELECT
  TO authenticated
  USING (
    -- Administradores y Gerentes ven todas las asignaciones
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND u.rol IN ('Administrador', 'Gerente')
    )
    OR
    -- Ver asignaciones donde el usuario es el ejecutivo
    ejecutivo_id = auth.uid()
    OR
    -- Ver asignaciones de tickets que el usuario creó
    EXISTS (
      SELECT 1 FROM tickets t
      WHERE t.id = ticket_asignaciones.ticket_id
      AND t.creado_por = auth.uid()
    )
  );

-- INSERT: Solo admin y gerente
CREATE POLICY "ticket_asignaciones_insert_simple"
  ON ticket_asignaciones FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND u.rol IN ('Administrador', 'Gerente')
    )
  );

-- DELETE: Solo admin y gerente
CREATE POLICY "ticket_asignaciones_delete_simple"
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
-- ACTUALIZAR política SELECT de tickets para evitar recursión
-- =============================================

DROP POLICY IF EXISTS "tickets_select_all_conditions" ON tickets;

CREATE POLICY "tickets_select_all_conditions"
  ON tickets FOR SELECT
  TO authenticated
  USING (
    -- Administradores y Gerentes ven todos
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND u.rol IN ('Administrador', 'Gerente')
    )
    OR
    -- Usuario es el agente del ticket
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
    -- Ticket sin asignaciones (visible para todos los autenticados)
    NOT EXISTS (
      SELECT 1 FROM ticket_asignaciones ta
      WHERE ta.ticket_id = tickets.id
    )
    OR
    -- Usuario es ejecutivo asignado (SIN subconsulta compleja)
    EXISTS (
      SELECT 1 FROM ticket_asignaciones ta
      WHERE ta.ticket_id = tickets.id
      AND ta.ejecutivo_id = auth.uid()
    )
  );

-- =============================================
-- COMENTARIOS y ARCHIVOS: Simplificar también
-- =============================================

DROP POLICY IF EXISTS "ticket_comentarios_select_with_ticket_access" ON ticket_comentarios;
DROP POLICY IF EXISTS "ticket_comentarios_insert_with_ticket_access" ON ticket_comentarios;

CREATE POLICY "ticket_comentarios_select_simple"
  ON ticket_comentarios FOR SELECT
  TO authenticated
  USING (
    -- Admin/Gerente ven todos
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND u.rol IN ('Administrador', 'Gerente')
    )
    OR
    -- Ver comentarios propios
    usuario_id = auth.uid()
    OR
    -- Ver comentarios de tickets propios (creador)
    EXISTS (
      SELECT 1 FROM tickets t
      WHERE t.id = ticket_comentarios.ticket_id
      AND (t.creado_por = auth.uid() OR t.agente_id = auth.uid())
    )
    OR
    -- Ver comentarios de tickets asignados
    EXISTS (
      SELECT 1 FROM ticket_asignaciones ta
      WHERE ta.ticket_id = ticket_comentarios.ticket_id
      AND ta.ejecutivo_id = auth.uid()
    )
    OR
    -- Ver comentarios de tickets sin asignación
    NOT EXISTS (
      SELECT 1 FROM ticket_asignaciones ta
      WHERE ta.ticket_id = ticket_comentarios.ticket_id
    )
  );

CREATE POLICY "ticket_comentarios_insert_simple"
  ON ticket_comentarios FOR INSERT
  TO authenticated
  WITH CHECK (
    usuario_id = auth.uid()
  );

-- ARCHIVOS
DROP POLICY IF EXISTS "ticket_archivos_select_with_ticket_access" ON ticket_archivos;
DROP POLICY IF EXISTS "ticket_archivos_insert_with_ticket_access" ON ticket_archivos;

CREATE POLICY "ticket_archivos_select_simple"
  ON ticket_archivos FOR SELECT
  TO authenticated
  USING (
    -- Admin/Gerente ven todos
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND u.rol IN ('Administrador', 'Gerente')
    )
    OR
    -- Ver archivos propios
    usuario_id = auth.uid()
    OR
    -- Ver archivos de tickets propios
    EXISTS (
      SELECT 1 FROM tickets t
      WHERE t.id = ticket_archivos.ticket_id
      AND (t.creado_por = auth.uid() OR t.agente_id = auth.uid())
    )
    OR
    -- Ver archivos de tickets asignados
    EXISTS (
      SELECT 1 FROM ticket_asignaciones ta
      WHERE ta.ticket_id = ticket_archivos.ticket_id
      AND ta.ejecutivo_id = auth.uid()
    )
    OR
    -- Ver archivos de tickets sin asignación
    NOT EXISTS (
      SELECT 1 FROM ticket_asignaciones ta
      WHERE ta.ticket_id = ticket_archivos.ticket_id
    )
  );

CREATE POLICY "ticket_archivos_insert_simple"
  ON ticket_archivos FOR INSERT
  TO authenticated
  WITH CHECK (
    usuario_id = auth.uid()
  );

-- HISTORIAL
DROP POLICY IF EXISTS "ticket_historial_select_with_ticket_access" ON ticket_historial;

CREATE POLICY "ticket_historial_select_simple"
  ON ticket_historial FOR SELECT
  TO authenticated
  USING (
    -- Admin/Gerente ven todos
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND u.rol IN ('Administrador', 'Gerente')
    )
    OR
    -- Ver historial de tickets propios
    EXISTS (
      SELECT 1 FROM tickets t
      WHERE t.id = ticket_historial.ticket_id
      AND (t.creado_por = auth.uid() OR t.agente_id = auth.uid())
    )
    OR
    -- Ver historial de tickets asignados
    EXISTS (
      SELECT 1 FROM ticket_asignaciones ta
      WHERE ta.ticket_id = ticket_historial.ticket_id
      AND ta.ejecutivo_id = auth.uid()
    )
    OR
    -- Ver historial de tickets sin asignación
    NOT EXISTS (
      SELECT 1 FROM ticket_asignaciones ta
      WHERE ta.ticket_id = ticket_historial.ticket_id
    )
  );

-- Comentarios explicativos
COMMENT ON POLICY "ticket_asignaciones_select_simple" ON ticket_asignaciones IS 
  'Permite ver asignaciones: Admin/Gerente todas, ejecutivo sus asignaciones, creador sus tickets';

COMMENT ON POLICY "tickets_select_all_conditions" ON tickets IS 
  'Permite ver tickets: Admin/Gerente todos, usuario tickets propios/asignados/sin asignación';

COMMENT ON POLICY "ticket_comentarios_select_simple" ON ticket_comentarios IS 
  'Permite ver comentarios: Admin/Gerente todos, usuario comentarios de tickets accesibles';

COMMENT ON POLICY "ticket_archivos_select_simple" ON ticket_archivos IS 
  'Permite ver archivos: Admin/Gerente todos, usuario archivos de tickets accesibles';

COMMENT ON POLICY "ticket_historial_select_simple" ON ticket_historial IS 
  'Permite ver historial: Admin/Gerente todos, usuario historial de tickets accesibles';
