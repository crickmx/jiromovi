/*
  # Fix contact center external messages visibility

  Adds SELECT and UPDATE policies so that Gerentes and Empleados can see
  messages where agent_user_id IS NULL (external contacts) — messages that
  arrived from unknown senders not yet linked to any agent.

  Also adds Ejecutivo role SELECT/INSERT/UPDATE policies so that users with
  that role can see messages in the Centro de Contacto bandeja.
*/

-- Allow Admins to also see external contact messages (agent_user_id IS NULL)
-- Their existing policy already uses USING (EXISTS (... rol = 'Administrador')) which covers all rows,
-- so we only need to add policies for Gerente/Empleado for external contacts.

-- Gerentes can view external contact messages (no agent yet assigned)
CREATE POLICY "Gerentes can view external contact center messages"
  ON contact_center_messages FOR SELECT
  TO authenticated
  USING (
    agent_user_id IS NULL
    AND EXISTS (
      SELECT 1 FROM usuarios u_self
      WHERE u_self.id = auth.uid()
        AND u_self.rol = 'Gerente'
        AND u_self.activo = true
    )
  );

-- Empleados can view external contact messages
CREATE POLICY "Empleados can view external contact center messages"
  ON contact_center_messages FOR SELECT
  TO authenticated
  USING (
    agent_user_id IS NULL
    AND EXISTS (
      SELECT 1 FROM usuarios u_self
      WHERE u_self.id = auth.uid()
        AND u_self.rol = 'Empleado'
        AND u_self.activo = true
    )
  );

-- Ejecutivo role: view messages for agents in their assigned tramites
CREATE POLICY "Ejecutivos can view assigned agent contact center messages"
  ON contact_center_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u_self
      WHERE u_self.id = auth.uid()
        AND u_self.rol = 'Ejecutivo'
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

CREATE POLICY "Ejecutivos can insert contact center messages"
  ON contact_center_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios u_self
      WHERE u_self.id = auth.uid()
        AND u_self.rol = 'Ejecutivo'
        AND u_self.activo = true
    )
  );

CREATE POLICY "Ejecutivos can update contact center messages"
  ON contact_center_messages FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u_self
      WHERE u_self.id = auth.uid()
        AND u_self.rol = 'Ejecutivo'
        AND u_self.activo = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios u_self
      WHERE u_self.id = auth.uid()
        AND u_self.rol = 'Ejecutivo'
        AND u_self.activo = true
    )
  );
