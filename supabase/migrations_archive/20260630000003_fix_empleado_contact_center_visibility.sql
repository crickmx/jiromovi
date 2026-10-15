/*
  # Fix Empleado visibility in Centro de Contacto

  Empleado role must see only chats of agents assigned to them via open tramites
  (ticket_asignaciones), identical to how Ejecutivo works.

  Previously Empleado used office-based visibility (same as Gerente), which
  exposed all office conversations. The RPC was already correct; only the
  RLS policies on contact_center_messages needed updating.
*/

-- ── SELECT ───────────────────────────────────────────────────────────────────

-- Drop old office-based SELECT policy
DROP POLICY IF EXISTS "Empleados can view office contact center messages" ON contact_center_messages;

-- Drop old external-only SELECT policy (will be covered by the new comprehensive one)
DROP POLICY IF EXISTS "Empleados can view external contact center messages" ON contact_center_messages;

-- New policy: Empleado sees messages for agents in their ticket assignments + external contacts
CREATE POLICY "Empleados can view assigned agent contact center messages"
  ON contact_center_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u_self
      WHERE u_self.id = auth.uid()
        AND u_self.rol = 'Empleado'
        AND u_self.activo = true
    )
    AND (
      agent_user_id IS NULL
      OR EXISTS (
        SELECT 1 FROM ticket_asignaciones ta
        JOIN tickets t ON t.id = ta.ticket_id
        WHERE ta.ejecutivo_id = auth.uid()
          AND t.agente_usuario_id = contact_center_messages.agent_user_id
          AND t.cerrado = false
      )
    )
  );

-- ── INSERT ───────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Empleados can insert office contact center messages" ON contact_center_messages;

CREATE POLICY "Empleados can insert contact center messages"
  ON contact_center_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios u_self
      WHERE u_self.id = auth.uid()
        AND u_self.rol = 'Empleado'
        AND u_self.activo = true
    )
  );

-- ── UPDATE ───────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Empleados can update office contact center messages" ON contact_center_messages;

CREATE POLICY "Empleados can update contact center messages"
  ON contact_center_messages FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u_self
      WHERE u_self.id = auth.uid()
        AND u_self.rol = 'Empleado'
        AND u_self.activo = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios u_self
      WHERE u_self.id = auth.uid()
        AND u_self.rol = 'Empleado'
        AND u_self.activo = true
    )
  );
