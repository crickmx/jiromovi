/*
  # Fix quote_forms RLS role case sensitivity

  1. Problem
    - The `get_user_role_for_quotes` function returns the raw `rol` column
      which stores values like 'Administrador', 'Gerente', 'Agente', 'Empleado'
    - RLS policies compare against lowercase values like 'admin', 'gerente', 'agente'
    - This mismatch means NO policy ever matches, blocking all operations

  2. Solution
    - Update `get_user_role_for_quotes` to normalize roles to the values
      expected by RLS policies ('admin', 'gerente', 'agente', 'empleado', 'ejecutivo')
*/

CREATE OR REPLACE FUNCTION get_user_role_for_quotes(user_uuid uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    CASE LOWER(rol)
      WHEN 'administrador' THEN 'admin'
      WHEN 'gerente' THEN 'gerente'
      WHEN 'agente' THEN 'agente'
      WHEN 'empleado' THEN 'empleado'
      WHEN 'ejecutivo' THEN 'ejecutivo'
      ELSE LOWER(rol)
    END
  FROM usuarios
  WHERE id = user_uuid AND activo = true
  LIMIT 1;
$$;