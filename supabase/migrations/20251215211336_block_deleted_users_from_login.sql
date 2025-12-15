/*
  # Block Deleted Users From Login

  1. New Function
    - `check_user_can_login` - Verifica si un usuario puede iniciar sesión
    - Retorna error si el usuario está eliminado o inactivo
    
  2. Usage
    - Esta función debe ser llamada después del login en el frontend
    - Revoca la sesión si el usuario no puede acceder
*/

-- Create function to check if user can login
CREATE OR REPLACE FUNCTION check_user_can_login(user_id_to_check uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_record RECORD;
BEGIN
  -- Get user info
  SELECT 
    id,
    nombre,
    rol,
    activo,
    is_deleted,
    estado,
    deleted_at
  INTO user_record
  FROM usuarios
  WHERE id = user_id_to_check;

  -- User not found in usuarios table
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'can_login', false,
      'error', 'Usuario no encontrado en el sistema',
      'error_code', 'USER_NOT_FOUND'
    );
  END IF;

  -- User is soft deleted
  IF user_record.is_deleted = true THEN
    RETURN jsonb_build_object(
      'can_login', false,
      'error', 'Tu cuenta ha sido desactivada. Contacta al administrador.',
      'error_code', 'USER_DELETED',
      'deleted_at', user_record.deleted_at
    );
  END IF;

  -- User is inactive
  IF user_record.activo = false THEN
    RETURN jsonb_build_object(
      'can_login', false,
      'error', 'Tu cuenta está inactiva. Contacta al administrador.',
      'error_code', 'USER_INACTIVE'
    );
  END IF;

  -- User is suspended
  IF user_record.estado = 'suspendido' THEN
    RETURN jsonb_build_object(
      'can_login', false,
      'error', 'Tu cuenta está suspendida. Contacta al administrador.',
      'error_code', 'USER_SUSPENDED'
    );
  END IF;

  -- User can login
  RETURN jsonb_build_object(
    'can_login', true,
    'user_id', user_record.id,
    'user_name', user_record.nombre,
    'user_rol', user_record.rol
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'can_login', false,
      'error', 'Error al verificar acceso',
      'error_code', 'UNEXPECTED_ERROR',
      'message', SQLERRM
    );
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION check_user_can_login(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION check_user_can_login(uuid) TO anon;

-- Add comment
COMMENT ON FUNCTION check_user_can_login IS 'Verifica si un usuario puede iniciar sesión (no eliminado, activo, no suspendido)';
