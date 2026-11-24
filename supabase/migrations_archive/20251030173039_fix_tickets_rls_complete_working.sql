/*
  # Arreglar completamente las políticas RLS de tickets

  ## Problema
  - Las políticas usan auth.jwt()->>'rol' pero el rol no está en el JWT
  - Los tickets no son visibles para ningún usuario
  - No se pueden crear tickets nuevos

  ## Solución
  - Usar subconsultas a la tabla usuarios para obtener el rol
  - Simplificar las políticas
  - Asegurar que tickets sin asignar sean visibles para todos
*/

-- =============================================
-- TICKETS: Políticas corregidas
-- =============================================

-- Eliminar políticas actuales
DROP POLICY IF EXISTS "tickets_select_by_role_and_assignment" ON tickets;
DROP POLICY IF EXISTS "tickets_insert_sin_recursion" ON tickets;
DROP POLICY IF EXISTS "tickets_update_by_role_and_assignment" ON tickets;
DROP POLICY IF EXISTS "tickets_delete_sin_recursion" ON tickets;

-- SELECT: Ver tickets según rol y asignación
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
    -- Usuario es ejecutivo asignado
    EXISTS (
      SELECT 1 FROM ticket_asignaciones ta
      WHERE ta.ticket_id = tickets.id
      AND ta.ejecutivo_id = auth.uid()
    )
    OR
    -- Ticket sin asignaciones (visible para todos los autenticados)
    NOT EXISTS (
      SELECT 1 FROM ticket_asignaciones ta
      WHERE ta.ticket_id = tickets.id
    )
  );

-- INSERT: Crear tickets (todos los autenticados)
CREATE POLICY "tickets_insert_authenticated"
  ON tickets FOR INSERT
  TO authenticated
  WITH CHECK (
    creado_por = auth.uid()
  );

-- UPDATE: Actualizar tickets según rol y asignación
CREATE POLICY "tickets_update_authorized"
  ON tickets FOR UPDATE
  TO authenticated
  USING (
    -- Administradores y Gerentes pueden actualizar todos
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND u.rol IN ('Administrador', 'Gerente')
    )
    OR
    -- Ejecutivos asignados pueden actualizar
    EXISTS (
      SELECT 1 FROM ticket_asignaciones ta
      WHERE ta.ticket_id = tickets.id
      AND ta.ejecutivo_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND u.rol IN ('Administrador', 'Gerente')
    )
    OR
    EXISTS (
      SELECT 1 FROM ticket_asignaciones ta
      WHERE ta.ticket_id = tickets.id
      AND ta.ejecutivo_id = auth.uid()
    )
  );

-- DELETE: Solo administradores
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
-- TICKET_ASIGNACIONES: Políticas corregidas
-- =============================================

DROP POLICY IF EXISTS "ticket_asignaciones_select_if_can_see_ticket" ON ticket_asignaciones;
DROP POLICY IF EXISTS "ticket_asignaciones_insert_if_admin_or_gerente" ON ticket_asignaciones;
DROP POLICY IF EXISTS "ticket_asignaciones_delete_simple" ON ticket_asignaciones;

CREATE POLICY "ticket_asignaciones_select_with_ticket_access"
  ON ticket_asignaciones FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tickets t
      WHERE t.id = ticket_asignaciones.ticket_id
      AND (
        EXISTS (
          SELECT 1 FROM usuarios u
          WHERE u.id = auth.uid()
          AND u.rol IN ('Administrador', 'Gerente')
        )
        OR t.agente_id = auth.uid()
        OR t.creado_por = auth.uid()
        OR ticket_asignaciones.ejecutivo_id = auth.uid()
        OR NOT EXISTS (
          SELECT 1 FROM ticket_asignaciones ta2
          WHERE ta2.ticket_id = t.id
        )
      )
    )
  );

CREATE POLICY "ticket_asignaciones_insert_authorized"
  ON ticket_asignaciones FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND u.rol IN ('Administrador', 'Gerente')
    )
  );

CREATE POLICY "ticket_asignaciones_delete_authorized"
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
-- TICKET_COMENTARIOS: Políticas corregidas
-- =============================================

DROP POLICY IF EXISTS "ticket_comentarios_select_if_can_see_ticket" ON ticket_comentarios;
DROP POLICY IF EXISTS "ticket_comentarios_insert_if_can_see_ticket" ON ticket_comentarios;

CREATE POLICY "ticket_comentarios_select_with_ticket_access"
  ON ticket_comentarios FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tickets t
      WHERE t.id = ticket_comentarios.ticket_id
      AND (
        EXISTS (
          SELECT 1 FROM usuarios u
          WHERE u.id = auth.uid()
          AND u.rol IN ('Administrador', 'Gerente')
        )
        OR t.agente_id = auth.uid()
        OR t.creado_por = auth.uid()
        OR EXISTS (
          SELECT 1 FROM ticket_asignaciones ta
          WHERE ta.ticket_id = t.id
          AND ta.ejecutivo_id = auth.uid()
        )
        OR NOT EXISTS (
          SELECT 1 FROM ticket_asignaciones ta
          WHERE ta.ticket_id = t.id
        )
      )
    )
  );

CREATE POLICY "ticket_comentarios_insert_with_ticket_access"
  ON ticket_comentarios FOR INSERT
  TO authenticated
  WITH CHECK (
    usuario_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM tickets t
      WHERE t.id = ticket_comentarios.ticket_id
      AND (
        EXISTS (
          SELECT 1 FROM usuarios u
          WHERE u.id = auth.uid()
          AND u.rol IN ('Administrador', 'Gerente')
        )
        OR t.agente_id = auth.uid()
        OR t.creado_por = auth.uid()
        OR EXISTS (
          SELECT 1 FROM ticket_asignaciones ta
          WHERE ta.ticket_id = t.id
          AND ta.ejecutivo_id = auth.uid()
        )
        OR NOT EXISTS (
          SELECT 1 FROM ticket_asignaciones ta
          WHERE ta.ticket_id = t.id
        )
      )
    )
  );

-- =============================================
-- TICKET_ARCHIVOS: Políticas corregidas
-- =============================================

DROP POLICY IF EXISTS "ticket_archivos_select_if_can_see_ticket" ON ticket_archivos;
DROP POLICY IF EXISTS "ticket_archivos_insert_if_can_see_ticket" ON ticket_archivos;

CREATE POLICY "ticket_archivos_select_with_ticket_access"
  ON ticket_archivos FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tickets t
      WHERE t.id = ticket_archivos.ticket_id
      AND (
        EXISTS (
          SELECT 1 FROM usuarios u
          WHERE u.id = auth.uid()
          AND u.rol IN ('Administrador', 'Gerente')
        )
        OR t.agente_id = auth.uid()
        OR t.creado_por = auth.uid()
        OR EXISTS (
          SELECT 1 FROM ticket_asignaciones ta
          WHERE ta.ticket_id = t.id
          AND ta.ejecutivo_id = auth.uid()
        )
        OR NOT EXISTS (
          SELECT 1 FROM ticket_asignaciones ta
          WHERE ta.ticket_id = t.id
        )
      )
    )
  );

CREATE POLICY "ticket_archivos_insert_with_ticket_access"
  ON ticket_archivos FOR INSERT
  TO authenticated
  WITH CHECK (
    usuario_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM tickets t
      WHERE t.id = ticket_archivos.ticket_id
      AND (
        EXISTS (
          SELECT 1 FROM usuarios u
          WHERE u.id = auth.uid()
          AND u.rol IN ('Administrador', 'Gerente')
        )
        OR t.agente_id = auth.uid()
        OR t.creado_por = auth.uid()
        OR EXISTS (
          SELECT 1 FROM ticket_asignaciones ta
          WHERE ta.ticket_id = t.id
          AND ta.ejecutivo_id = auth.uid()
        )
        OR NOT EXISTS (
          SELECT 1 FROM ticket_asignaciones ta
          WHERE ta.ticket_id = t.id
        )
      )
    )
  );

-- =============================================
-- TICKET_HISTORIAL: Políticas corregidas
-- =============================================

DROP POLICY IF EXISTS "ticket_historial_select_if_can_see_ticket" ON ticket_historial;
DROP POLICY IF EXISTS "ticket_historial_insert_system" ON ticket_historial;

CREATE POLICY "ticket_historial_select_with_ticket_access"
  ON ticket_historial FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tickets t
      WHERE t.id = ticket_historial.ticket_id
      AND (
        EXISTS (
          SELECT 1 FROM usuarios u
          WHERE u.id = auth.uid()
          AND u.rol IN ('Administrador', 'Gerente')
        )
        OR t.agente_id = auth.uid()
        OR t.creado_por = auth.uid()
        OR EXISTS (
          SELECT 1 FROM ticket_asignaciones ta
          WHERE ta.ticket_id = t.id
          AND ta.ejecutivo_id = auth.uid()
        )
        OR NOT EXISTS (
          SELECT 1 FROM ticket_asignaciones ta
          WHERE ta.ticket_id = t.id
        )
      )
    )
  );

CREATE POLICY "ticket_historial_insert_all"
  ON ticket_historial FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Comentarios
COMMENT ON POLICY "tickets_select_all_conditions" ON tickets IS 
  'Permite ver tickets según rol (Admin/Gerente ven todos), asignación, o sin asignaciones (todos)';

COMMENT ON POLICY "tickets_insert_authenticated" ON tickets IS 
  'Todos los usuarios autenticados pueden crear tickets';

COMMENT ON POLICY "tickets_update_authorized" ON tickets IS 
  'Admin, Gerente y ejecutivos asignados pueden actualizar tickets';

COMMENT ON POLICY "tickets_delete_admin_only" ON tickets IS 
  'Solo administradores pueden eliminar tickets';
