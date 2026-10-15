/*
  # Ajustar visibilidad de tickets para todos los empleados

  ## Reglas de negocio
  1. Todos los empleados autenticados pueden ver tickets sin asignar
  2. Una vez asignado un ejecutivo, solo pueden ver:
     - El creador del ticket (agente)
     - El ejecutivo asignado
     - Gerentes
     - Administradores (SIEMPRE pueden ver todos)
  3. Administradores siempre pueden ver y trabajar en cualquier ticket

  ## Cambios
  - Actualizar política SELECT de tickets
  - Permitir acceso a tickets no asignados a todos
  - Restringir acceso a tickets asignados según reglas
*/

-- Eliminar política actual
DROP POLICY IF EXISTS "tickets_select_sin_recursion" ON tickets;

-- Nueva política con lógica correcta
CREATE POLICY "tickets_select_by_role_and_assignment"
  ON tickets FOR SELECT
  TO authenticated
  USING (
    -- Administradores pueden ver TODOS los tickets
    (auth.jwt()->>'rol')::text = 'Administrador'
    OR
    -- Gerentes pueden ver todos los tickets
    (auth.jwt()->>'rol')::text = 'Gerente'
    OR
    -- El usuario es el creador del ticket (agente)
    agente_id = auth.uid()
    OR
    creado_por = auth.uid()
    OR
    -- El usuario es ejecutivo asignado al ticket
    EXISTS (
      SELECT 1 FROM ticket_asignaciones_cache tac
      WHERE tac.ticket_id = tickets.id
      AND auth.uid() = ANY(tac.ejecutivos_ids)
    )
    OR
    -- NUEVO: Tickets SIN ASIGNACIÓN son visibles para TODOS los empleados
    NOT EXISTS (
      SELECT 1 FROM ticket_asignaciones
      WHERE ticket_asignaciones.ticket_id = tickets.id
    )
  );

-- Actualizar política de UPDATE para permitir a todos editar tickets no asignados
DROP POLICY IF EXISTS "tickets_update_sin_recursion" ON tickets;

CREATE POLICY "tickets_update_by_role_and_assignment"
  ON tickets FOR UPDATE
  TO authenticated
  USING (
    -- Administradores pueden actualizar TODOS los tickets
    (auth.jwt()->>'rol')::text = 'Administrador'
    OR
    -- Gerentes pueden actualizar todos los tickets
    (auth.jwt()->>'rol')::text = 'Gerente'
    OR
    -- Ejecutivos asignados pueden actualizar
    EXISTS (
      SELECT 1 FROM ticket_asignaciones_cache tac
      WHERE tac.ticket_id = tickets.id
      AND auth.uid() = ANY(tac.ejecutivos_ids)
    )
  )
  WITH CHECK (
    -- Mismo criterio para el WITH CHECK
    (auth.jwt()->>'rol')::text = 'Administrador'
    OR
    (auth.jwt()->>'rol')::text = 'Gerente'
    OR
    EXISTS (
      SELECT 1 FROM ticket_asignaciones_cache tac
      WHERE tac.ticket_id = tickets.id
      AND auth.uid() = ANY(tac.ejecutivos_ids)
    )
  );

-- Actualizar políticas de tablas relacionadas para permitir acceso a tickets no asignados

-- TICKET_ASIGNACIONES: Permitir ver y crear asignaciones para tickets visibles
DROP POLICY IF EXISTS "ticket_asignaciones_select_simple" ON ticket_asignaciones;
DROP POLICY IF EXISTS "ticket_asignaciones_insert_simple" ON ticket_asignaciones;

CREATE POLICY "ticket_asignaciones_select_if_can_see_ticket"
  ON ticket_asignaciones FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tickets t
      WHERE t.id = ticket_asignaciones.ticket_id
      AND (
        (auth.jwt()->>'rol')::text = 'Administrador'
        OR (auth.jwt()->>'rol')::text = 'Gerente'
        OR t.agente_id = auth.uid()
        OR t.creado_por = auth.uid()
        OR EXISTS (
          SELECT 1 FROM ticket_asignaciones_cache tac
          WHERE tac.ticket_id = t.id
          AND auth.uid() = ANY(tac.ejecutivos_ids)
        )
        OR NOT EXISTS (
          SELECT 1 FROM ticket_asignaciones ta2
          WHERE ta2.ticket_id = t.id
        )
      )
    )
  );

CREATE POLICY "ticket_asignaciones_insert_if_admin_or_gerente"
  ON ticket_asignaciones FOR INSERT
  TO authenticated
  WITH CHECK (
    (auth.jwt()->>'rol')::text IN ('Administrador', 'Gerente')
  );

-- TICKET_COMENTARIOS: Permitir acceso según visibilidad del ticket
DROP POLICY IF EXISTS "ticket_comentarios_select_all_if_has_ticket_access" ON ticket_comentarios;
DROP POLICY IF EXISTS "ticket_comentarios_insert_simple" ON ticket_comentarios;

CREATE POLICY "ticket_comentarios_select_if_can_see_ticket"
  ON ticket_comentarios FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tickets t
      WHERE t.id = ticket_comentarios.ticket_id
      AND (
        (auth.jwt()->>'rol')::text = 'Administrador'
        OR (auth.jwt()->>'rol')::text = 'Gerente'
        OR t.agente_id = auth.uid()
        OR t.creado_por = auth.uid()
        OR EXISTS (
          SELECT 1 FROM ticket_asignaciones_cache tac
          WHERE tac.ticket_id = t.id
          AND auth.uid() = ANY(tac.ejecutivos_ids)
        )
        OR NOT EXISTS (
          SELECT 1 FROM ticket_asignaciones ta
          WHERE ta.ticket_id = t.id
        )
      )
    )
  );

CREATE POLICY "ticket_comentarios_insert_if_can_see_ticket"
  ON ticket_comentarios FOR INSERT
  TO authenticated
  WITH CHECK (
    usuario_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM tickets t
      WHERE t.id = ticket_comentarios.ticket_id
      AND (
        (auth.jwt()->>'rol')::text = 'Administrador'
        OR (auth.jwt()->>'rol')::text = 'Gerente'
        OR t.agente_id = auth.uid()
        OR t.creado_por = auth.uid()
        OR EXISTS (
          SELECT 1 FROM ticket_asignaciones_cache tac
          WHERE tac.ticket_id = t.id
          AND auth.uid() = ANY(tac.ejecutivos_ids)
        )
        OR NOT EXISTS (
          SELECT 1 FROM ticket_asignaciones ta
          WHERE ta.ticket_id = t.id
        )
      )
    )
  );

-- TICKET_ARCHIVOS: Permitir acceso según visibilidad del ticket
DROP POLICY IF EXISTS "ticket_archivos_select_all_if_has_ticket_access" ON ticket_archivos;
DROP POLICY IF EXISTS "ticket_archivos_insert_simple" ON ticket_archivos;

CREATE POLICY "ticket_archivos_select_if_can_see_ticket"
  ON ticket_archivos FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tickets t
      WHERE t.id = ticket_archivos.ticket_id
      AND (
        (auth.jwt()->>'rol')::text = 'Administrador'
        OR (auth.jwt()->>'rol')::text = 'Gerente'
        OR t.agente_id = auth.uid()
        OR t.creado_por = auth.uid()
        OR EXISTS (
          SELECT 1 FROM ticket_asignaciones_cache tac
          WHERE tac.ticket_id = t.id
          AND auth.uid() = ANY(tac.ejecutivos_ids)
        )
        OR NOT EXISTS (
          SELECT 1 FROM ticket_asignaciones ta
          WHERE ta.ticket_id = t.id
        )
      )
    )
  );

CREATE POLICY "ticket_archivos_insert_if_can_see_ticket"
  ON ticket_archivos FOR INSERT
  TO authenticated
  WITH CHECK (
    usuario_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM tickets t
      WHERE t.id = ticket_archivos.ticket_id
      AND (
        (auth.jwt()->>'rol')::text = 'Administrador'
        OR (auth.jwt()->>'rol')::text = 'Gerente'
        OR t.agente_id = auth.uid()
        OR t.creado_por = auth.uid()
        OR EXISTS (
          SELECT 1 FROM ticket_asignaciones_cache tac
          WHERE tac.ticket_id = t.id
          AND auth.uid() = ANY(tac.ejecutivos_ids)
        )
        OR NOT EXISTS (
          SELECT 1 FROM ticket_asignaciones ta
          WHERE ta.ticket_id = t.id
        )
      )
    )
  );

-- TICKET_HISTORIAL: Permitir acceso según visibilidad del ticket
DROP POLICY IF EXISTS "ticket_historial_select_all_if_has_ticket_access" ON ticket_historial;
DROP POLICY IF EXISTS "ticket_historial_insert_simple" ON ticket_historial;

CREATE POLICY "ticket_historial_select_if_can_see_ticket"
  ON ticket_historial FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tickets t
      WHERE t.id = ticket_historial.ticket_id
      AND (
        (auth.jwt()->>'rol')::text = 'Administrador'
        OR (auth.jwt()->>'rol')::text = 'Gerente'
        OR t.agente_id = auth.uid()
        OR t.creado_por = auth.uid()
        OR EXISTS (
          SELECT 1 FROM ticket_asignaciones_cache tac
          WHERE tac.ticket_id = t.id
          AND auth.uid() = ANY(tac.ejecutivos_ids)
        )
        OR NOT EXISTS (
          SELECT 1 FROM ticket_asignaciones ta
          WHERE ta.ticket_id = t.id
        )
      )
    )
  );

CREATE POLICY "ticket_historial_insert_system"
  ON ticket_historial FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Comentarios explicativos
COMMENT ON POLICY "tickets_select_by_role_and_assignment" ON tickets IS 
  'Permite ver tickets: Admins ven todos, empleados ven tickets sin asignar, asignados ven sus tickets';

COMMENT ON POLICY "tickets_update_by_role_and_assignment" ON tickets IS 
  'Permite actualizar tickets: Admins, Gerentes, y ejecutivos asignados';

COMMENT ON POLICY "ticket_asignaciones_select_if_can_see_ticket" ON ticket_asignaciones IS 
  'Permite ver asignaciones si el usuario puede ver el ticket';

COMMENT ON POLICY "ticket_comentarios_select_if_can_see_ticket" ON ticket_comentarios IS 
  'Permite ver comentarios si el usuario puede ver el ticket';

COMMENT ON POLICY "ticket_archivos_select_if_can_see_ticket" ON ticket_archivos IS 
  'Permite ver archivos si el usuario puede ver el ticket';

COMMENT ON POLICY "ticket_historial_select_if_can_see_ticket" ON ticket_historial IS 
  'Permite ver historial si el usuario puede ver el ticket';
