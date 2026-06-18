/*
  # Fix Trámites: Ejecutivo role UPDATE access

  ## Problem
  The tickets UPDATE RLS policy did not include the 'Ejecutivo' role.
  Ejecutivos who are assigned to a ticket (assigned_to_user_id = auth.uid())
  or who created it (creado_por = auth.uid()) cannot save changes or reopen
  the ticket because the UPDATE is blocked at the DB level.

  ## Changes
  - Drop and recreate the tickets UPDATE policy to include 'Ejecutivo'
    alongside Administrador, Gerente, and Empleado.
  - Ejecutivos can only UPDATE tickets they created OR are assigned to
    (same ownership check already applied to the other roles in this condition).

  ## Security
  - The new policy is strictly scoped: Ejecutivos can only touch their own
    tickets. They cannot update arbitrary tickets.
  - Admins still bypass via the broader admin policy that already exists.
*/

-- Drop the existing update policy that excludes Ejecutivo
DROP POLICY IF EXISTS "tickets_update_by_role" ON tickets;
DROP POLICY IF EXISTS "Tickets: users can update their own or assigned" ON tickets;
DROP POLICY IF EXISTS "Empleados y superiores pueden actualizar tickets" ON tickets;

-- Recreate update policy including Ejecutivo
CREATE POLICY "tickets_update_by_role"
  ON tickets
  FOR UPDATE
  TO authenticated
  USING (
    (
      -- Admins can update any ticket
      (SELECT rol FROM usuarios WHERE id = auth.uid()) = 'Administrador'
    ) OR (
      -- Gerentes can update tickets in their office
      (SELECT rol FROM usuarios WHERE id = auth.uid()) = 'Gerente'
      AND (
        agente_id IN (SELECT id FROM usuarios WHERE oficina_id = (SELECT oficina_id FROM usuarios WHERE id = auth.uid()))
        OR creado_por = auth.uid()
        OR assigned_to_user_id = auth.uid()
      )
    ) OR (
      -- Empleados, Ejecutivos can update tickets they own or are assigned to
      (SELECT rol FROM usuarios WHERE id = auth.uid()) IN ('Empleado', 'Ejecutivo')
      AND (
        creado_por = auth.uid()
        OR assigned_to_user_id = auth.uid()
        OR agente_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    (
      (SELECT rol FROM usuarios WHERE id = auth.uid()) = 'Administrador'
    ) OR (
      (SELECT rol FROM usuarios WHERE id = auth.uid()) = 'Gerente'
    ) OR (
      (SELECT rol FROM usuarios WHERE id = auth.uid()) IN ('Empleado', 'Ejecutivo')
      AND (
        creado_por = auth.uid()
        OR assigned_to_user_id = auth.uid()
        OR agente_id = auth.uid()
      )
    )
  );
