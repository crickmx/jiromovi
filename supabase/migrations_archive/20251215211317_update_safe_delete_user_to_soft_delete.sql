/*
  # Update safe_delete_user to Soft Delete

  1. Changes
    - Convert safe_delete_user from hard delete to soft delete
    - Mark user as deleted instead of removing from database
    - Preserve all historical data and references
    - Add audit log entry
    - Validate cannot delete self
    - Validate cannot delete last active admin
    - Return detailed information about the operation
    
  2. Security
    - SECURITY DEFINER to bypass RLS
    - Only callable by admins (enforced in edge function)
*/

-- Drop existing function
DROP FUNCTION IF EXISTS safe_delete_user(uuid);

-- Create new soft delete function
CREATE OR REPLACE FUNCTION safe_delete_user(
  user_id_to_delete uuid,
  deleted_by_admin_id uuid,
  deletion_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_user RECORD;
  admin_user RECORD;
  active_admin_count integer;
  result jsonb;
BEGIN
  -- Get target user info
  SELECT * INTO target_user
  FROM usuarios
  WHERE id = user_id_to_delete;

  -- Verify user exists
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Usuario no encontrado',
      'error_code', 'USER_NOT_FOUND'
    );
  END IF;

  -- Verify user is not already deleted
  IF target_user.is_deleted = true THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Usuario ya está eliminado',
      'error_code', 'USER_ALREADY_DELETED'
    );
  END IF;

  -- Verify admin exists and is active
  SELECT * INTO admin_user
  FROM usuarios
  WHERE id = deleted_by_admin_id;

  IF NOT FOUND OR admin_user.rol != 'Administrador' OR admin_user.is_deleted = true THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Administrador inválido o no autorizado',
      'error_code', 'INVALID_ADMIN'
    );
  END IF;

  -- Prevent self-deletion
  IF user_id_to_delete = deleted_by_admin_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'No puedes eliminarte a ti mismo',
      'error_code', 'CANNOT_DELETE_SELF'
    );
  END IF;

  -- If deleting an admin, check if it's the last active admin
  IF target_user.rol = 'Administrador' THEN
    SELECT COUNT(*) INTO active_admin_count
    FROM usuarios
    WHERE rol = 'Administrador'
      AND is_deleted = false
      AND activo = true
      AND id != user_id_to_delete;

    IF active_admin_count = 0 THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'No se puede eliminar el último administrador activo',
        'error_code', 'LAST_ADMIN'
      );
    END IF;
  END IF;

  -- Perform soft delete
  UPDATE usuarios
  SET 
    is_deleted = true,
    deleted_at = now(),
    deleted_by_user_id = deleted_by_admin_id,
    estado = 'eliminado',
    activo = false
  WHERE id = user_id_to_delete;

  -- Create audit log entry
  INSERT INTO audit_logs (
    action,
    performed_by,
    target_user_id,
    target_resource_type,
    target_resource_id,
    details
  ) VALUES (
    'USER_DELETE',
    deleted_by_admin_id,
    user_id_to_delete,
    'usuario',
    user_id_to_delete,
    jsonb_build_object(
      'user_name', target_user.nombre,
      'user_rol', target_user.rol,
      'user_email_laboral', target_user.email_laboral,
      'deletion_reason', deletion_reason,
      'deletion_type', 'soft_delete'
    )
  );

  -- Build success response
  result := jsonb_build_object(
    'success', true,
    'message', 'Usuario eliminado correctamente',
    'deletion_type', 'soft_delete',
    'user', jsonb_build_object(
      'id', target_user.id,
      'nombre', target_user.nombre,
      'rol', target_user.rol
    ),
    'deleted_at', now(),
    'deleted_by', jsonb_build_object(
      'id', admin_user.id,
      'nombre', admin_user.nombre
    )
  );

  RETURN result;

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Error inesperado durante la eliminación',
      'error_code', 'UNEXPECTED_ERROR',
      'sqlstate', SQLSTATE,
      'message', SQLERRM
    );
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION safe_delete_user(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION safe_delete_user(uuid, uuid, text) TO service_role;

-- Add comment
COMMENT ON FUNCTION safe_delete_user IS 'Realiza soft delete de un usuario con validaciones y auditoría completa';
