/*
  # Fix quote_forms agent update policy

  1. Problem
    - "Agents can update own draft quote_forms" only allows updates when status='borrador'
    - submitQuoteForm changes status to 'enviado' then needs to set ticket_id
    - The second update fails because status is no longer 'borrador'

  2. Solution
    - Replace the restrictive policy with one that allows agents to update
      their own forms regardless of status (they are the owner)
*/

DROP POLICY IF EXISTS "Agents can update own draft quote_forms" ON quote_forms;

CREATE POLICY "Agents can update own quote_forms"
  ON quote_forms FOR UPDATE TO authenticated
  USING (
    (agent_id = auth.uid() OR created_by = auth.uid())
    AND get_user_role_for_quotes(auth.uid()) = 'agente'
  )
  WITH CHECK (
    agent_id = auth.uid() OR created_by = auth.uid()
  );