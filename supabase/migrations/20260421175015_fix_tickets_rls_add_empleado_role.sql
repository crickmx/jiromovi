/*
  # Add Empleado role to tickets RLS policies

  1. Changes
    - Update `tickets_select_by_user_or_role` policy to include 'Empleado' role
    - Update `tickets_update_by_role_or_participant` policy to include 'Empleado' role
  
  2. Security
    - Administrador, Gerente, and Empleado can now view and edit all tickets
    - Agente users can still only access tickets where they are a participant
    - Delete remains restricted to Administrador only
    
  3. Notes
    - This enables the frontend canEdit logic that grants Empleado full edit/close capability
*/

-- Update SELECT policy to include Empleado
DROP POLICY IF EXISTS "tickets_select_by_user_or_role" ON tickets;
CREATE POLICY "tickets_select_by_user_or_role"
  ON tickets FOR SELECT
  TO authenticated
  USING (
    (EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = ANY(ARRAY['Administrador', 'Gerente', 'Empleado'])
    ))
    OR (
      creado_por = auth.uid()
      OR assigned_to_user_id = auth.uid()
      OR agente_id = auth.uid()
      OR agente_usuario_id = auth.uid()
      OR attending_user_id = auth.uid()
    )
  );

-- Update UPDATE policy to include Empleado
DROP POLICY IF EXISTS "tickets_update_by_role_or_participant" ON tickets;
CREATE POLICY "tickets_update_by_role_or_participant"
  ON tickets FOR UPDATE
  TO authenticated
  USING (
    (EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = ANY(ARRAY['Administrador', 'Gerente', 'Empleado'])
    ))
    OR (
      creado_por = auth.uid()
      OR assigned_to_user_id = auth.uid()
      OR agente_id = auth.uid()
      OR agente_usuario_id = auth.uid()
      OR attending_user_id = auth.uid()
    )
  )
  WITH CHECK (
    (EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = ANY(ARRAY['Administrador', 'Gerente', 'Empleado'])
    ))
    OR (
      creado_por = auth.uid()
      OR assigned_to_user_id = auth.uid()
      OR agente_id = auth.uid()
      OR agente_usuario_id = auth.uid()
      OR attending_user_id = auth.uid()
    )
  );
