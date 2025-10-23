/*
  # Add Policy for Users to View Their Own Emails

  1. Security Changes
    - Add SELECT policy on `historial_correos` table for all authenticated users
    - Users can only view emails where they are the recipient (destinatario_id matches auth.uid())
    - This allows Agentes, Empleados, Gerentes, and Administradores to view their received emails

  2. Important Notes
    - Policy is restrictive: users can ONLY see emails sent to them
    - Uses auth.uid() to match destinatario_id
    - Does not interfere with existing admin/gerente policies for viewing all emails
*/

-- Allow all authenticated users to view their own emails
CREATE POLICY "Users can view their own received emails"
  ON historial_correos FOR SELECT
  TO authenticated
  USING (destinatario_id = auth.uid());
