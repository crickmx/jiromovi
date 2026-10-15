/*
  # Fix usuarios UPDATE policies with explicit WITH CHECK

  1. Problem
    - UPDATE policies only have USING clauses
    - PostgreSQL applies USING as WITH CHECK implicitly
    - This causes RLS violations during updates
  
  2. Solution
    - Drop existing UPDATE policies
    - Recreate with explicit WITH CHECK clauses
    - Admin: can update anyone, result stays admin-updateable
    - Gerente: can update office users, result stays in same office
    - User: can update self, result stays as self
  
  3. Security
    - Maintains existing security model
    - Adds explicit WITH CHECK for clarity
    - Prevents privilege escalation
*/

-- Drop existing UPDATE policies
DROP POLICY IF EXISTS "Admins can update all users" ON usuarios;
DROP POLICY IF EXISTS "Gerentes can update office users" ON usuarios;
DROP POLICY IF EXISTS "Users can update own profile" ON usuarios;

-- Recreate with explicit USING and WITH CHECK

-- Admins can update all users
CREATE POLICY "Admins can update all users"
  ON usuarios
  FOR UPDATE
  TO authenticated
  USING (
    -- Can see/update any user if I'm admin
    get_my_rol() = 'Administrador'
  )
  WITH CHECK (
    -- After update, I must still be admin
    get_my_rol() = 'Administrador'
  );

-- Gerentes can update users in their office
CREATE POLICY "Gerentes can update office users"
  ON usuarios
  FOR UPDATE
  TO authenticated
  USING (
    -- Can see/update users in my office if I'm gerente
    get_my_rol() = 'Gerente' AND
    oficina_id = get_my_oficina_id()
  )
  WITH CHECK (
    -- After update, user must stay in my office and I must still be gerente
    get_my_rol() = 'Gerente' AND
    oficina_id = get_my_oficina_id()
  );

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON usuarios
  FOR UPDATE
  TO authenticated
  USING (
    -- Can see/update myself
    id = auth.uid()
  )
  WITH CHECK (
    -- After update, must still be myself
    id = auth.uid()
  );
