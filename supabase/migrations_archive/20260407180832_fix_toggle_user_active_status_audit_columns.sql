/*
  # Fix Toggle User Active Status Function - Correct Audit Columns
  
  1. Changes
    - Replace audit_logs columns with correct names:
      - usuario_id → performed_by
      - accion → action
      - tabla → target_resource_type
      - registro_id → target_resource_id
      - detalles → details
  
  2. No Security Changes
    - All security logic remains the same
    - Only fixing column name references for audit logging
*/

-- Drop and recreate the function with correct audit column names
DROP FUNCTION IF EXISTS toggle_user_active_status(uuid, boolean);

CREATE OR REPLACE FUNCTION toggle_user_active_status(
  p_user_id uuid,
  p_activo boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id uuid;
  v_caller_rol text;
  v_caller_estado text;
  v_target_email text;
  v_target_nombre text;
  v_old_activo boolean;
  v_target_deleted_at timestamptz;
BEGIN
  -- Get caller's ID
  v_caller_id := auth.uid();
  
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'No autenticado'
    );
  END IF;
  
  -- Validate caller is an active Administrator
  SELECT rol, estado INTO v_caller_rol, v_caller_estado
  FROM usuarios
  WHERE id = v_caller_id AND deleted_at IS NULL;
  
  IF v_caller_rol IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Usuario no encontrado'
    );
  END IF;
  
  IF v_caller_rol != 'Administrador' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'No autorizado. Solo administradores pueden realizar esta acción.'
    );
  END IF;
  
  IF v_caller_estado != 'activo' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Tu cuenta no está activa'
    );
  END IF;
  
  -- Prevent self-deactivation
  IF v_caller_id = p_user_id AND p_activo = false THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'No puedes desactivar tu propia cuenta'
    );
  END IF;
  
  -- Get target user info
  SELECT email_laboral, nombre_completo, activo, deleted_at
  INTO v_target_email, v_target_nombre, v_old_activo, v_target_deleted_at
  FROM usuarios
  WHERE id = p_user_id;
  
  IF v_target_email IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Usuario objetivo no encontrado'
    );
  END IF;
  
  IF v_target_deleted_at IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'No se puede modificar un usuario eliminado'
    );
  END IF;
  
  -- Check if already in desired state
  IF v_old_activo = p_activo THEN
    RETURN jsonb_build_object(
      'success', true,
      'message', 'El usuario ya tiene el estado deseado',
      'changed', false
    );
  END IF;
  
  -- Update the user
  UPDATE usuarios
  SET 
    activo = p_activo,
    updated_at = now()
  WHERE id = p_user_id;
  
  -- Log the change with correct column names
  INSERT INTO audit_logs (
    performed_by,
    action,
    target_user_id,
    target_resource_type,
    target_resource_id,
    details
  ) VALUES (
    v_caller_id,
    CASE 
      WHEN p_activo THEN 'activate_user'
      ELSE 'deactivate_user'
    END,
    p_user_id,
    'usuarios',
    p_user_id,
    jsonb_build_object(
      'target_email', v_target_email,
      'target_nombre', v_target_nombre,
      'old_value', v_old_activo,
      'new_value', p_activo
    )
  );
  
  -- Return success
  RETURN jsonb_build_object(
    'success', true,
    'message', CASE 
      WHEN p_activo THEN 'Usuario activado exitosamente'
      ELSE 'Usuario desactivado exitosamente'
    END,
    'changed', true,
    'user', jsonb_build_object(
      'id', p_user_id,
      'email_laboral', v_target_email,
      'nombre', v_target_nombre,
      'activo', p_activo
    )
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Error al actualizar usuario: ' || SQLERRM
    );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION toggle_user_active_status(uuid, boolean) TO authenticated;

-- Add comment
COMMENT ON FUNCTION toggle_user_active_status IS 
  'Securely toggles user active status. Only administrators can execute. Logs all changes.';
