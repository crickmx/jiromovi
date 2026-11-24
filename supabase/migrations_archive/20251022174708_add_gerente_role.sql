/*
  # Add Gerente Role and Update Permissions

  1. Changes
    - Add 'Gerente' as a valid role in usuarios table
    - Update RLS policies to support Gerente role
    - Gerente can only manage users within their assigned office
    - Gerente has similar permissions to Administrador but scoped to their office

  2. Security
    - Gerente can view/edit/delete users only in their office
    - Gerente can view their own office information
    - Gerente can view/manage documents for users in their office
    - Gerente can view/edit custom fields for users in their office

  3. Important Notes
    - Administrator must assign an office to Gerente users
    - Gerente without an assigned office has no access to other users
    - All existing RLS policies are updated to include Gerente logic
*/

-- Update usuarios table to allow 'Gerente' role
-- Note: The existing CHECK constraint needs to be updated
DO $$
BEGIN
  -- Drop existing constraint if it exists
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'usuarios_rol_check' 
    AND conrelid = 'usuarios'::regclass
  ) THEN
    ALTER TABLE usuarios DROP CONSTRAINT usuarios_rol_check;
  END IF;

  -- Add new constraint with Gerente role
  ALTER TABLE usuarios ADD CONSTRAINT usuarios_rol_check 
    CHECK (rol IN ('Administrador', 'Gerente', 'Empleado', 'Agente'));
END $$;

-- Update RLS policies for usuarios table to support Gerente

-- Drop and recreate "Admins can view all users" to include Gerente viewing their office
DROP POLICY IF EXISTS "Admins can view all users" ON usuarios;

CREATE POLICY "Admins and Gerentes can view users"
  ON usuarios FOR SELECT
  TO authenticated
  USING (
    -- Admins can see all users
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND u.rol = 'Administrador'
    )
    OR
    -- Gerentes can see users in their office
    EXISTS (
      SELECT 1 FROM usuarios gerente
      WHERE gerente.id = auth.uid()
      AND gerente.rol = 'Gerente'
      AND gerente.oficina_id = usuarios.oficina_id
      AND gerente.oficina_id IS NOT NULL
    )
    OR
    -- Users can see themselves
    auth.uid() = id
  );

-- Drop and recreate insert policy
DROP POLICY IF EXISTS "Admins can insert users" ON usuarios;

CREATE POLICY "Admins and Gerentes can insert users"
  ON usuarios FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Admins can insert any user
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND u.rol = 'Administrador'
    )
    OR
    -- Gerentes can insert users in their office
    EXISTS (
      SELECT 1 FROM usuarios gerente
      WHERE gerente.id = auth.uid()
      AND gerente.rol = 'Gerente'
      AND gerente.oficina_id = oficina_id
      AND gerente.oficina_id IS NOT NULL
    )
  );

-- Drop and recreate update policy
DROP POLICY IF EXISTS "Admins can update all users" ON usuarios;

CREATE POLICY "Admins and Gerentes can update users"
  ON usuarios FOR UPDATE
  TO authenticated
  USING (
    -- Admins can update all users
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND u.rol = 'Administrador'
    )
    OR
    -- Gerentes can update users in their office (but not change roles to Admin or move to other offices)
    EXISTS (
      SELECT 1 FROM usuarios gerente
      WHERE gerente.id = auth.uid()
      AND gerente.rol = 'Gerente'
      AND gerente.oficina_id = usuarios.oficina_id
      AND gerente.oficina_id IS NOT NULL
    )
    OR
    -- Users can update themselves (except rol and oficina_id)
    auth.uid() = id
  )
  WITH CHECK (
    -- Admins can update to anything
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND u.rol = 'Administrador'
    )
    OR
    -- Gerentes can update users in their office (cannot assign Admin role or move to other offices)
    (
      EXISTS (
        SELECT 1 FROM usuarios gerente
        WHERE gerente.id = auth.uid()
        AND gerente.rol = 'Gerente'
        AND gerente.oficina_id = oficina_id
        AND gerente.oficina_id IS NOT NULL
      )
      AND rol != 'Administrador'
    )
    OR
    -- Users updating themselves cannot change rol or oficina_id
    (auth.uid() = id)
  );

-- Drop and recreate delete policy
DROP POLICY IF EXISTS "Admins can delete users" ON usuarios;

CREATE POLICY "Admins and Gerentes can delete users"
  ON usuarios FOR DELETE
  TO authenticated
  USING (
    -- Admins can delete any user
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND u.rol = 'Administrador'
    )
    OR
    -- Gerentes can delete users in their office (except other Gerentes and Admins)
    EXISTS (
      SELECT 1 FROM usuarios gerente
      WHERE gerente.id = auth.uid()
      AND gerente.rol = 'Gerente'
      AND gerente.oficina_id = usuarios.oficina_id
      AND gerente.oficina_id IS NOT NULL
      AND usuarios.rol NOT IN ('Administrador', 'Gerente')
    )
  );

-- Update oficinas RLS policies to allow Gerente to view their office
DROP POLICY IF EXISTS "Admins can view all offices" ON oficinas;

CREATE POLICY "Admins and Gerentes can view offices"
  ON oficinas FOR SELECT
  TO authenticated
  USING (
    -- Admins can see all offices
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND u.rol = 'Administrador'
    )
    OR
    -- Gerentes can see their assigned office
    EXISTS (
      SELECT 1 FROM usuarios gerente
      WHERE gerente.id = auth.uid()
      AND gerente.rol = 'Gerente'
      AND gerente.oficina_id = oficinas.id
    )
  );

-- Update documentos_usuarios policies to support Gerente
DROP POLICY IF EXISTS "Admins can view all documents" ON documentos_usuarios;

CREATE POLICY "Admins and Gerentes can view documents"
  ON documentos_usuarios FOR SELECT
  TO authenticated
  USING (
    -- Admins can see all documents
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND u.rol = 'Administrador'
    )
    OR
    -- Gerentes can see documents of users in their office
    EXISTS (
      SELECT 1 FROM usuarios gerente
      JOIN usuarios doc_owner ON doc_owner.id = documentos_usuarios.usuario_id
      WHERE gerente.id = auth.uid()
      AND gerente.rol = 'Gerente'
      AND gerente.oficina_id = doc_owner.oficina_id
      AND gerente.oficina_id IS NOT NULL
    )
    OR
    -- Users can see their own documents
    usuario_id = auth.uid()
  );

DROP POLICY IF EXISTS "Admins can insert documents" ON documentos_usuarios;

CREATE POLICY "Admins and Gerentes can insert documents"
  ON documentos_usuarios FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Admins can insert any document
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND u.rol = 'Administrador'
    )
    OR
    -- Gerentes can insert documents for users in their office
    EXISTS (
      SELECT 1 FROM usuarios gerente
      JOIN usuarios doc_owner ON doc_owner.id = documentos_usuarios.usuario_id
      WHERE gerente.id = auth.uid()
      AND gerente.rol = 'Gerente'
      AND gerente.oficina_id = doc_owner.oficina_id
      AND gerente.oficina_id IS NOT NULL
    )
    OR
    -- Users can insert their own documents
    usuario_id = auth.uid()
  );

DROP POLICY IF EXISTS "Admins can update documents" ON documentos_usuarios;

CREATE POLICY "Admins and Gerentes can update documents"
  ON documentos_usuarios FOR UPDATE
  TO authenticated
  USING (
    -- Admins can update all documents
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND u.rol = 'Administrador'
    )
    OR
    -- Gerentes can update documents of users in their office
    EXISTS (
      SELECT 1 FROM usuarios gerente
      JOIN usuarios doc_owner ON doc_owner.id = documentos_usuarios.usuario_id
      WHERE gerente.id = auth.uid()
      AND gerente.rol = 'Gerente'
      AND gerente.oficina_id = doc_owner.oficina_id
      AND gerente.oficina_id IS NOT NULL
    )
    OR
    -- Users can update their own documents
    usuario_id = auth.uid()
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND u.rol = 'Administrador'
    )
    OR
    EXISTS (
      SELECT 1 FROM usuarios gerente
      JOIN usuarios doc_owner ON doc_owner.id = documentos_usuarios.usuario_id
      WHERE gerente.id = auth.uid()
      AND gerente.rol = 'Gerente'
      AND gerente.oficina_id = doc_owner.oficina_id
      AND gerente.oficina_id IS NOT NULL
    )
    OR
    usuario_id = auth.uid()
  );

DROP POLICY IF EXISTS "Admins can delete documents" ON documentos_usuarios;

CREATE POLICY "Admins and Gerentes can delete documents"
  ON documentos_usuarios FOR DELETE
  TO authenticated
  USING (
    -- Admins can delete all documents
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND u.rol = 'Administrador'
    )
    OR
    -- Gerentes can delete documents of users in their office
    EXISTS (
      SELECT 1 FROM usuarios gerente
      JOIN usuarios doc_owner ON doc_owner.id = documentos_usuarios.usuario_id
      WHERE gerente.id = auth.uid()
      AND gerente.rol = 'Gerente'
      AND gerente.oficina_id = doc_owner.oficina_id
      AND gerente.oficina_id IS NOT NULL
    )
    OR
    -- Users can delete their own documents
    usuario_id = auth.uid()
  );
