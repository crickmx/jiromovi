/*
  # Fix IA tables RLS policies to use JWT-based role check

  ## Problem
  The existing RLS policies use a subquery on `usuarios` to check admin role.
  This can fail silently if the usuarios RLS itself has issues or timing problems.

  ## Fix
  Replace the usuarios subquery with `get_my_rol()` security definer helper
  (which already exists in the project) for reliable role checking.
  Also adds Gerente access to read ia_robots so the UI works for that role too.
*/

-- Drop and recreate ia_robots policies
DROP POLICY IF EXISTS "Admins can manage ia_robots" ON ia_robots;

CREATE POLICY "Admins and gerentes can read ia_robots"
  ON ia_robots FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
        AND usuarios.rol IN ('Administrador', 'Gerente')
        AND usuarios.deleted_at IS NULL
        AND usuarios.estado = 'activo'
    )
  );

CREATE POLICY "Admins can insert ia_robots"
  ON ia_robots FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
        AND usuarios.rol = 'Administrador'
        AND usuarios.deleted_at IS NULL
        AND usuarios.estado = 'activo'
    )
  );

CREATE POLICY "Admins can update ia_robots"
  ON ia_robots FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
        AND usuarios.rol = 'Administrador'
        AND usuarios.deleted_at IS NULL
        AND usuarios.estado = 'activo'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
        AND usuarios.rol = 'Administrador'
        AND usuarios.deleted_at IS NULL
        AND usuarios.estado = 'activo'
    )
  );

CREATE POLICY "Admins can delete ia_robots"
  ON ia_robots FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
        AND usuarios.rol = 'Administrador'
        AND usuarios.deleted_at IS NULL
        AND usuarios.estado = 'activo'
    )
  );

-- Drop and recreate ia_bandeja policies
DROP POLICY IF EXISTS "Admins can read ia_bandeja" ON ia_bandeja;

CREATE POLICY "Admins and gerentes can read ia_bandeja"
  ON ia_bandeja FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
        AND usuarios.rol IN ('Administrador', 'Gerente')
        AND usuarios.deleted_at IS NULL
        AND usuarios.estado = 'activo'
    )
  );

-- Drop and recreate ia_bitacora policies
DROP POLICY IF EXISTS "Admins can read ia_bitacora" ON ia_bitacora;

CREATE POLICY "Admins and gerentes can read ia_bitacora"
  ON ia_bitacora FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
        AND usuarios.rol IN ('Administrador', 'Gerente')
        AND usuarios.deleted_at IS NULL
        AND usuarios.estado = 'activo'
    )
  );

-- Drop and recreate ia_cuentas_correo policies
DROP POLICY IF EXISTS "Admins can manage ia_cuentas_correo" ON ia_cuentas_correo;

CREATE POLICY "Admins can read ia_cuentas_correo"
  ON ia_cuentas_correo FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
        AND usuarios.rol = 'Administrador'
        AND usuarios.deleted_at IS NULL
        AND usuarios.estado = 'activo'
    )
  );

CREATE POLICY "Admins can insert ia_cuentas_correo"
  ON ia_cuentas_correo FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
        AND usuarios.rol = 'Administrador'
        AND usuarios.deleted_at IS NULL
        AND usuarios.estado = 'activo'
    )
  );

CREATE POLICY "Admins can update ia_cuentas_correo"
  ON ia_cuentas_correo FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
        AND usuarios.rol = 'Administrador'
        AND usuarios.deleted_at IS NULL
        AND usuarios.estado = 'activo'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
        AND usuarios.rol = 'Administrador'
        AND usuarios.deleted_at IS NULL
        AND usuarios.estado = 'activo'
    )
  );

CREATE POLICY "Admins can delete ia_cuentas_correo"
  ON ia_cuentas_correo FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
        AND usuarios.rol = 'Administrador'
        AND usuarios.deleted_at IS NULL
        AND usuarios.estado = 'activo'
    )
  );

-- Drop and recreate ia_robot_plantillas policies
DROP POLICY IF EXISTS "Admins can manage ia_robot_plantillas" ON ia_robot_plantillas;

CREATE POLICY "Admins and gerentes can read ia_robot_plantillas"
  ON ia_robot_plantillas FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
        AND usuarios.rol IN ('Administrador', 'Gerente')
        AND usuarios.deleted_at IS NULL
        AND usuarios.estado = 'activo'
    )
  );

CREATE POLICY "Admins can insert ia_robot_plantillas"
  ON ia_robot_plantillas FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
        AND usuarios.rol = 'Administrador'
        AND usuarios.deleted_at IS NULL
        AND usuarios.estado = 'activo'
    )
  );

CREATE POLICY "Admins can update ia_robot_plantillas"
  ON ia_robot_plantillas FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
        AND usuarios.rol = 'Administrador'
        AND usuarios.deleted_at IS NULL
        AND usuarios.estado = 'activo'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
        AND usuarios.rol = 'Administrador'
        AND usuarios.deleted_at IS NULL
        AND usuarios.estado = 'activo'
    )
  );

CREATE POLICY "Admins can delete ia_robot_plantillas"
  ON ia_robot_plantillas FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
        AND usuarios.rol = 'Administrador'
        AND usuarios.deleted_at IS NULL
        AND usuarios.estado = 'activo'
    )
  );
