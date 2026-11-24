/*
  # Restrict Gerente Access to Office Users

  1. Changes
    - Update usuarios RLS policies to restrict Gerentes to only view users from their office
    - Gerentes can only see Empleados and Agentes from their assigned office
    - Admins continue to have full access
    
  2. Security
    - DROP existing policies that conflict
    - CREATE new restrictive policies for Gerentes
    - Maintain admin access for all operations
*/

-- Drop existing SELECT policy for usuarios
DROP POLICY IF EXISTS "Usuarios can view based on role" ON usuarios;

-- Create new SELECT policy with office restriction for Gerentes
CREATE POLICY "Users can view based on role and office"
  ON usuarios FOR SELECT
  TO authenticated
  USING (
    -- Admins can see all users
    (
      EXISTS (
        SELECT 1 FROM usuarios AS u
        WHERE u.id = auth.uid()
        AND u.rol = 'Administrador'
      )
    )
    OR
    -- Gerentes can only see Empleados and Agentes from their office
    (
      EXISTS (
        SELECT 1 FROM usuarios AS u
        WHERE u.id = auth.uid()
        AND u.rol = 'Gerente'
        AND u.oficina_id IS NOT NULL
        AND usuarios.oficina_id = u.oficina_id
        AND usuarios.rol IN ('Empleado', 'Agente')
      )
    )
    OR
    -- Users can see their own profile
    (usuarios.id = auth.uid())
  );

-- Drop existing oficinas SELECT policy
DROP POLICY IF EXISTS "Gerentes and Admins can view offices" ON oficinas;

-- Create new SELECT policy for oficinas with office restriction for Gerentes
CREATE POLICY "Users can view offices based on role"
  ON oficinas FOR SELECT
  TO authenticated
  USING (
    -- Admins can see all offices
    (
      EXISTS (
        SELECT 1 FROM usuarios
        WHERE usuarios.id = auth.uid()
        AND usuarios.rol = 'Administrador'
      )
    )
    OR
    -- Gerentes can only see their assigned office
    (
      EXISTS (
        SELECT 1 FROM usuarios
        WHERE usuarios.id = auth.uid()
        AND usuarios.rol = 'Gerente'
        AND usuarios.oficina_id = oficinas.id
      )
    )
  );
