/*
  # Scope ticket_asignaciones SELECT to parent ticket visibility

  1. Problem
    - Two SELECT policies on ticket_asignaciones give Gerente blanket access 
      to ALL assignments regardless of office
    - ticket_asignaciones_select_all: Admin/Gerente see all
    - ticket_asignaciones_select_simple: Admin/Gerente see all

  2. Changes
    - Replace both with a single policy that delegates to the parent tickets 
      table RLS via EXISTS subquery
    - Participants (ejecutivo_id, asignado_por) can always see their own assignments

  3. Security
    - Visibility now inherits from the parent ticket's office-scoped policy
*/

-- Drop the two old SELECT policies
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'ticket_asignaciones_select_all' AND polrelid = 'ticket_asignaciones'::regclass) THEN
    DROP POLICY "ticket_asignaciones_select_all" ON ticket_asignaciones;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'ticket_asignaciones_select_simple' AND polrelid = 'ticket_asignaciones'::regclass) THEN
    DROP POLICY "ticket_asignaciones_select_simple" ON ticket_asignaciones;
  END IF;
END $$;

-- New unified SELECT policy: cascade through parent ticket RLS
CREATE POLICY "ticket_asignaciones_select_via_ticket"
  ON ticket_asignaciones
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tickets t WHERE t.id = ticket_asignaciones.ticket_id
    )
    OR ejecutivo_id = auth.uid()
    OR asignado_por = auth.uid()
  );
