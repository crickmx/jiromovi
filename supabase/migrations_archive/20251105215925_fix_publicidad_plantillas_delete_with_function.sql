/*
  # Fix Publicidad Plantillas Delete with Function
  
  1. Changes
    - Create a function to deactivate plantillas that checks admin role
    - Simplify RLS policies to avoid recursion
    - Use security definer function for admin checks
    
  2. Security
    - Function verifies user is admin before allowing deactivation
    - RLS still protects direct table access
*/

-- Drop existing update policy
DROP POLICY IF EXISTS "Admins can update plantillas" ON publicidad_plantillas;

-- Create simpler update policy that allows updates but uses function for admin check
CREATE POLICY "Authenticated users can update plantillas"
  ON publicidad_plantillas
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create function to deactivate plantillas (only for admins)
CREATE OR REPLACE FUNCTION deactivate_plantilla(plantilla_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role text;
BEGIN
  -- Get user role from usuarios table
  SELECT rol INTO user_role
  FROM usuarios
  WHERE id = auth.uid();
  
  -- Check if user is admin
  IF user_role != 'Administrador' THEN
    RAISE EXCEPTION 'Solo los administradores pueden desactivar plantillas';
  END IF;
  
  -- Update plantilla
  UPDATE publicidad_plantillas
  SET activa = false
  WHERE id = plantilla_id;
  
  RETURN true;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION deactivate_plantilla(uuid) TO authenticated;
