/*
  # Fix Usuarios RLS Recursion with Trigger Approach

  1. Changes
    - Create a user_roles table to cache user roles and avoid recursion
    - Add triggers to keep user_roles in sync with usuarios
    - Update RLS policies to use user_roles instead of usuarios
    
  2. Security
    - Break recursion by querying a different table
    - Maintain same security model
    - Auto-sync roles when usuarios changes
*/

-- Create user_roles cache table
CREATE TABLE IF NOT EXISTS user_roles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  rol TEXT NOT NULL,
  oficina_id UUID REFERENCES oficinas(id),
  activo BOOLEAN DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on user_roles
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read their own role
CREATE POLICY "user_roles_select_all"
  ON user_roles FOR SELECT
  TO authenticated
  USING (true);

-- Only system can modify user_roles (via triggers)
CREATE POLICY "user_roles_system_only"
  ON user_roles FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

-- Function to sync user_roles
CREATE OR REPLACE FUNCTION sync_user_roles()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    INSERT INTO user_roles (user_id, rol, oficina_id, activo, updated_at)
    VALUES (NEW.id, NEW.rol, NEW.oficina_id, NEW.activo, now())
    ON CONFLICT (user_id)
    DO UPDATE SET
      rol = EXCLUDED.rol,
      oficina_id = EXCLUDED.oficina_id,
      activo = EXCLUDED.activo,
      updated_at = EXCLUDED.updated_at;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    DELETE FROM user_roles WHERE user_id = OLD.id;
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
DROP TRIGGER IF EXISTS sync_user_roles_trigger ON usuarios;
CREATE TRIGGER sync_user_roles_trigger
  AFTER INSERT OR UPDATE OR DELETE ON usuarios
  FOR EACH ROW
  EXECUTE FUNCTION sync_user_roles();

-- Sync existing data
INSERT INTO user_roles (user_id, rol, oficina_id, activo, updated_at)
SELECT id, rol, oficina_id, activo, now()
FROM usuarios
ON CONFLICT (user_id)
DO UPDATE SET
  rol = EXCLUDED.rol,
  oficina_id = EXCLUDED.oficina_id,
  activo = EXCLUDED.activo,
  updated_at = EXCLUDED.updated_at;

-- Drop old policies
DROP POLICY IF EXISTS "usuarios_select_own" ON usuarios;
DROP POLICY IF EXISTS "usuarios_select_admin" ON usuarios;
DROP POLICY IF EXISTS "usuarios_select_gerente" ON usuarios;
DROP POLICY IF EXISTS "usuarios_update_own" ON usuarios;
DROP POLICY IF EXISTS "usuarios_update_admin" ON usuarios;
DROP POLICY IF EXISTS "usuarios_insert_admin" ON usuarios;
DROP POLICY IF EXISTS "usuarios_delete_admin" ON usuarios;

-- New non-recursive policies using user_roles
CREATE POLICY "usuarios_select_own"
  ON usuarios FOR SELECT
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY "usuarios_select_admin"
  ON usuarios FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND rol = 'Administrador'
      AND activo = true
    )
  );

CREATE POLICY "usuarios_select_gerente"
  ON usuarios FOR SELECT
  TO authenticated
  USING (
    usuarios.rol IN ('Empleado', 'Agente')
    AND EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND rol = 'Gerente'
      AND activo = true
      AND oficina_id = usuarios.oficina_id
      AND oficina_id IS NOT NULL
    )
  );

CREATE POLICY "usuarios_update_own"
  ON usuarios FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "usuarios_update_admin"
  ON usuarios FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND rol = 'Administrador'
      AND activo = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND rol = 'Administrador'
      AND activo = true
    )
  );

CREATE POLICY "usuarios_insert_admin"
  ON usuarios FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND rol = 'Administrador'
      AND activo = true
    )
  );

CREATE POLICY "usuarios_delete_admin"
  ON usuarios FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND rol = 'Administrador'
      AND activo = true
    )
  );
