/*
  # Fix toggle_user_active_status to sync estado field
  
  1. Changes
    - When setting activo=true, also set estado='activo'
    - When setting activo=false, also set estado='inactivo'
    - This ensures the notify() function works correctly
  
  2. Security
    - Function remains SECURITY DEFINER
    - Same authorization checks
*/

CREATE OR REPLACE FUNCTION toggle_user_active_status(p_user_id uuid, p_activo boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_caller_id uuid;
  v_caller_rol text;
  v_caller_estado text;
  v_target_email text;
  v_target_nombre text;
  v_old_activo boolean;
  v_old_estado text;
  v_target_deleted_at timestamptz;
  v_new_estado text;
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
  SELECT email_laboral, nombre_completo, activo, estado, deleted_at
  INTO v_target_email, v_target_nombre, v_old_activo, v_old_estado, v_target_deleted_at
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
  
  -- Determine new estado value
  v_new_estado := CASE WHEN p_activo THEN 'activo' ELSE 'inactivo' END;
  
  -- Update the user (both activo and estado fields)
  UPDATE usuarios
  SET 
    activo = p_activo,
    estado = v_new_estado,
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
      'old_activo', v_old_activo,
      'new_activo', p_activo,
      'old_estado', v_old_estado,
      'new_estado', v_new_estado
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
      'activo', p_activo,
      'estado', v_new_estado
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

COMMENT ON FUNCTION toggle_user_active_status IS 
  'Toggles user active status, syncing both activo (boolean) and estado (text) fields';
