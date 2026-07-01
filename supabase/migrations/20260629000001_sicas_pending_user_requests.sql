/*
  # Solicitudes pendientes de mapeo SICAS para usuarios no-admin

  Permite que cualquier usuario autenticado inserte un registro con
  status = 'pending_review' en sicas_vendor_user_mappings.
  Los administradores/gerentes siguen pudiendo insertar con cualquier status.
*/

-- Reemplazar la política de INSERT para incluir el caso pending_review
DROP POLICY IF EXISTS "Admin and gerente can insert sicas vendor mappings" ON sicas_vendor_user_mappings;

CREATE POLICY "Insert sicas vendor mappings"
  ON sicas_vendor_user_mappings FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Administrador / Gerente: cualquier status
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid()
        AND rol IN ('Administrador', 'Gerente')
        AND activo = true
        AND is_deleted = false
    )
    OR
    -- Cualquier usuario autenticado: solo puede solicitar (pending_review)
    status = 'pending_review'
  );
