/*
  # Fix quote_forms update policy for form creators

  1. Problem
    - Users with 'empleado' or 'ejecutivo' roles cannot update forms they created
    - The agent policy requires role = 'agente'
    - The empleado policy requires assigned_to = auth.uid()
    - But assigned_to is null on draft forms created by the user themselves

  2. Solution
    - Add a policy that allows any authenticated user to update forms they created
      as long as the form is still in draft status
*/

DROP POLICY IF EXISTS "Creators can update own draft quote_forms" ON quote_forms;

CREATE POLICY "Creators can update own draft quote_forms"
  ON quote_forms
  FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid() AND status = 'borrador')
  WITH CHECK (created_by = auth.uid());
