/*
  # Fix crm_contactos SELECT policy
  Allow Administrador and Gerente roles to read all contacts,
  not just their own.
*/

DROP POLICY IF EXISTS "Usuarios solo ven sus propios contactos" ON crm_contactos;

CREATE POLICY "Users can view contacts based on role"
  ON crm_contactos FOR SELECT
  TO authenticated
  USING (
    creado_por = auth.uid()
    OR EXISTS (
      SELECT 1 FROM usuarios u
       WHERE u.id = auth.uid()
         AND u.rol IN ('Administrador', 'Gerente')
    )
  );
