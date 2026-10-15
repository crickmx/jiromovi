-- Add UPDATE policy for admins/gerentes on ia_bandeja
CREATE POLICY "Admins and gerentes can update ia_bandeja"
  ON ia_bandeja
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
        AND usuarios.rol = ANY (ARRAY['Administrador', 'Gerente'])
        AND usuarios.deleted_at IS NULL
        AND usuarios.estado = 'activo'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
        AND usuarios.rol = ANY (ARRAY['Administrador', 'Gerente'])
        AND usuarios.deleted_at IS NULL
        AND usuarios.estado = 'activo'
    )
  );

-- Add INSERT policy for admins/gerentes on ia_bandeja
CREATE POLICY "Admins and gerentes can insert ia_bandeja"
  ON ia_bandeja
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
        AND usuarios.rol = ANY (ARRAY['Administrador', 'Gerente'])
        AND usuarios.deleted_at IS NULL
        AND usuarios.estado = 'activo'
    )
  );

-- Add DELETE policy for admins/gerentes on ia_bandeja
CREATE POLICY "Admins and gerentes can delete ia_bandeja"
  ON ia_bandeja
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
        AND usuarios.rol = ANY (ARRAY['Administrador', 'Gerente'])
        AND usuarios.deleted_at IS NULL
        AND usuarios.estado = 'activo'
    )
  );
