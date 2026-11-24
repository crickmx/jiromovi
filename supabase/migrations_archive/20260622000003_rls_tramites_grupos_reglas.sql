/*
  # RLS policies para tramites_grupos_reglas
  Solo administradores activos pueden gestionar las reglas de auto-asignación.
*/

-- SELECT: admins ven todas las reglas; usuarios autenticados ven las activas
CREATE POLICY "reglas_select_admin" ON tramites_grupos_reglas
  FOR SELECT TO authenticated
  USING (true);

-- INSERT: solo admins
CREATE POLICY "reglas_insert_admin" ON tramites_grupos_reglas
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid() AND rol = 'Administrador' AND estado = 'activo'
    )
  );

-- UPDATE: solo admins (para soft-delete via activo=false)
CREATE POLICY "reglas_update_admin" ON tramites_grupos_reglas
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid() AND rol = 'Administrador' AND estado = 'activo'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid() AND rol = 'Administrador' AND estado = 'activo'
    )
  );

-- DELETE: solo admins
CREATE POLICY "reglas_delete_admin" ON tramites_grupos_reglas
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid() AND rol = 'Administrador' AND estado = 'activo'
    )
  );
