/*
  # Permitir a todos los usuarios ver comentarios, archivos e historial de tickets
  
  1. Problema
    - Agentes y Empleados solo pueden ver sus propios comentarios/archivos
    - No pueden ver lo que otros usuarios publican en el mismo ticket
    
  2. Solución
    - Cambiar políticas SELECT para permitir ver todo si el usuario tiene acceso al ticket
    - Mantener políticas INSERT restrictivas (solo crear propios)
*/

-- =============================================
-- TICKET_COMENTARIOS: Permitir ver todos los comentarios de tickets accesibles
-- =============================================

DROP POLICY IF EXISTS "ticket_comentarios_select_simple" ON ticket_comentarios;

CREATE POLICY "ticket_comentarios_select_all_if_has_ticket_access"
  ON ticket_comentarios FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tickets t
      WHERE t.id = ticket_comentarios.ticket_id
      AND (
        t.agente_id = auth.uid() OR
        t.creado_por = auth.uid() OR
        (auth.jwt()->>'rol')::text IN ('Gerente', 'Administrador') OR
        EXISTS (
          SELECT 1 FROM ticket_asignaciones_cache tac
          WHERE tac.ticket_id = t.id
          AND auth.uid() = ANY(tac.ejecutivos_ids)
        )
      )
    )
  );

-- =============================================
-- TICKET_ARCHIVOS: Permitir ver todos los archivos de tickets accesibles
-- =============================================

DROP POLICY IF EXISTS "ticket_archivos_select_simple" ON ticket_archivos;

CREATE POLICY "ticket_archivos_select_all_if_has_ticket_access"
  ON ticket_archivos FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tickets t
      WHERE t.id = ticket_archivos.ticket_id
      AND (
        t.agente_id = auth.uid() OR
        t.creado_por = auth.uid() OR
        (auth.jwt()->>'rol')::text IN ('Gerente', 'Administrador') OR
        EXISTS (
          SELECT 1 FROM ticket_asignaciones_cache tac
          WHERE tac.ticket_id = t.id
          AND auth.uid() = ANY(tac.ejecutivos_ids)
        )
      )
    )
  );

-- =============================================
-- TICKET_HISTORIAL: Permitir ver todo el historial de tickets accesibles
-- =============================================

DROP POLICY IF EXISTS "ticket_historial_select_simple" ON ticket_historial;

CREATE POLICY "ticket_historial_select_all_if_has_ticket_access"
  ON ticket_historial FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tickets t
      WHERE t.id = ticket_historial.ticket_id
      AND (
        t.agente_id = auth.uid() OR
        t.creado_por = auth.uid() OR
        (auth.jwt()->>'rol')::text IN ('Gerente', 'Administrador') OR
        EXISTS (
          SELECT 1 FROM ticket_asignaciones_cache tac
          WHERE tac.ticket_id = t.id
          AND auth.uid() = ANY(tac.ejecutivos_ids)
        )
      )
    )
  );

-- Comentarios explicativos
COMMENT ON POLICY "ticket_comentarios_select_all_if_has_ticket_access" ON ticket_comentarios IS 
  'Permite ver todos los comentarios de un ticket si el usuario tiene acceso al ticket (agente, creador, asignado, o rol superior)';

COMMENT ON POLICY "ticket_archivos_select_all_if_has_ticket_access" ON ticket_archivos IS 
  'Permite ver todos los archivos de un ticket si el usuario tiene acceso al ticket (agente, creador, asignado, o rol superior)';

COMMENT ON POLICY "ticket_historial_select_all_if_has_ticket_access" ON ticket_historial IS 
  'Permite ver todo el historial de un ticket si el usuario tiene acceso al ticket (agente, creador, asignado, o rol superior)';
