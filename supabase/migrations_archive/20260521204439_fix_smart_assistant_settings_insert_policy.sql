
/*
  # Fix contact_center_smart_assistant_settings INSERT policy

  The table only had SELECT and UPDATE policies, blocking INSERTs.
  Adds an INSERT policy restricted to Administrador role.
*/

CREATE POLICY "Smart settings — admin insert"
  ON contact_center_smart_assistant_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
        AND usuarios.rol = 'Administrador'
    )
  );
