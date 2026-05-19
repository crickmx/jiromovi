/*
  # Fix quote_forms update policies - allow creators to update regardless of status

  1. Problem
    - "Creators can update own draft quote_forms" only works when status = 'borrador'
    - When submitQuoteForm changes status to 'enviado' then tries to set ticket_id,
      the second update fails because status is no longer 'borrador'
    - Non-agent users (gerente, empleado, ejecutivo, admin) who create forms
      cannot update them after submission
    - This causes "Formulario no encontrado. Es posible que haya sido eliminado."

  2. Solution
    - Replace the restrictive "Creators can update own draft quote_forms" policy
      with one that allows creators to update their forms in any status
    - Add a policy for admins/gerentes to update any form in their scope
    - The "Agents can update own quote_forms" policy already works for agents
*/

-- Drop the old restrictive draft-only policy
DROP POLICY IF EXISTS "Creators can update own draft quote_forms" ON quote_forms;

-- Allow any authenticated user to update forms they created (regardless of status)
CREATE POLICY "Creators can update own quote_forms"
  ON quote_forms
  FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

-- Allow admins to update any quote form
DROP POLICY IF EXISTS "Admins can update any quote_forms" ON quote_forms;
CREATE POLICY "Admins can update any quote_forms"
  ON quote_forms
  FOR UPDATE
  TO authenticated
  USING (get_user_role_for_quotes(auth.uid()) IN ('admin', 'superadmin'))
  WITH CHECK (get_user_role_for_quotes(auth.uid()) IN ('admin', 'superadmin'));

-- Allow gerentes to update quote_forms in their office
DROP POLICY IF EXISTS "Gerentes can update office quote_forms" ON quote_forms;
CREATE POLICY "Gerentes can update office quote_forms"
  ON quote_forms
  FOR UPDATE
  TO authenticated
  USING (
    get_user_role_for_quotes(auth.uid()) = 'gerente'
    AND office_id = get_user_office_for_quotes(auth.uid())
  )
  WITH CHECK (
    get_user_role_for_quotes(auth.uid()) = 'gerente'
    AND office_id = get_user_office_for_quotes(auth.uid())
  );