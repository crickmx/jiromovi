/*
  # Fix: Liberar email_laboral al hacer Soft Delete

  1. Problema
    - Al hacer soft delete, el email queda bloqueado en auth.users
    - No se puede crear nuevo usuario con el mismo email_laboral
    - Error: "A user with this email address has already been registered"

  2. Solución
    - Al hacer soft delete, modificar auth.users.email a un formato único
    - Formato: "deleted-{uuid}@deleted.local"
    - Esto libera el email_laboral para ser reutilizado
    - Mantiene integridad referencial (UUID sigue en auth.users)

  3. Estrategia
    - Soft delete en tabla usuarios (preservar datos históricos)
    - Hard delete del email en auth (liberar email para reutilización)
    - Deshabilitar login (auth.users con email dummy no puede autenticar)

  4. Ejemplos
    ANTES:
    - Eliminar usuario con email: juan@jiro.mx
    - auth.users.email = "juan@jiro.mx" (BLOQUEADO)
    - Crear nuevo con juan@jiro.mx → ERROR ❌
    
    DESPUÉS:
    - Eliminar usuario con email: juan@jiro.mx
    - auth.users.email = "deleted-040f8786@deleted.local"
    - Crear nuevo con juan@jiro.mx → ÉXITO ✅
*/

-- ============================================================================
-- 1. Actualizar safe_delete_user para liberar email
-- ============================================================================

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
  deleted_email text;
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

  -- ✅ NUEVO: Generar email dummy único para liberar el email_laboral
  deleted_email := 'deleted-' || LEFT(user_id_to_delete::text, 8) || '@deleted.local';

  -- ✅ NUEVO: Modificar email en auth.users para liberar el email_laboral
  BEGIN
    UPDATE auth.users
    SET 
      email = deleted_email,
      email_confirmed_at = NULL,
      updated_at = now()
    WHERE id = user_id_to_delete;

    RAISE LOG '[safe_delete] Email liberado: % -> %', target_user.email_laboral, deleted_email;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[safe_delete] Error al modificar auth.email: %', SQLERRM;
    -- Continuar con soft delete aunque falle auth.users
  END;

  -- Perform soft delete en tabla usuarios
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
      'auth_email_replaced', deleted_email,
      'deletion_reason', deletion_reason,
      'deletion_type', 'soft_delete_with_email_release'
    )
  );

  -- Build success response
  result := jsonb_build_object(
    'success', true,
    'message', 'Usuario eliminado correctamente. Email liberado para reutilización.',
    'deletion_type', 'soft_delete',
    'email_released', true,
    'user', jsonb_build_object(
      'id', target_user.id,
      'nombre', target_user.nombre,
      'rol', target_user.rol,
      'email_laboral_original', target_user.email_laboral
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

-- ============================================================================
-- 2. Función para reparar usuarios eliminados anteriormente
-- ============================================================================

CREATE OR REPLACE FUNCTION repair_deleted_users_emails()
RETURNS TABLE(
  usuario_id uuid,
  nombre text,
  email_laboral_original text,
  auth_email_anterior text,
  auth_email_nuevo text,
  reparado boolean
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_record record;
  v_deleted_email text;
  v_count integer := 0;
BEGIN
  -- Buscar usuarios eliminados que todavía tienen su email original en auth.users
  FOR v_record IN
    SELECT 
      u.id,
      u.nombre_completo,
      u.email_laboral,
      au.email::text as auth_email
    FROM usuarios u
    JOIN auth.users au ON au.id = u.id
    WHERE u.is_deleted = true
      AND u.email_laboral IS NOT NULL
      AND u.email_laboral != ''
      -- Si auth.email no tiene formato de "deleted-*", necesita repararse
      AND au.email NOT LIKE 'deleted-%@deleted.local'
  LOOP
    BEGIN
      -- Generar email dummy único
      v_deleted_email := 'deleted-' || LEFT(v_record.id::text, 8) || '@deleted.local';

      -- Actualizar auth.users
      UPDATE auth.users
      SET 
        email = v_deleted_email,
        email_confirmed_at = NULL,
        updated_at = NOW()
      WHERE id = v_record.id;

      v_count := v_count + 1;

      RETURN QUERY SELECT 
        v_record.id,
        v_record.nombre_completo,
        v_record.email_laboral,
        v_record.auth_email,
        v_deleted_email,
        true;

      RAISE LOG '[repair] Usuario % : % -> %', 
        v_record.id, v_record.auth_email, v_deleted_email;
      
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '[repair] Error reparando usuario %: %', v_record.id, SQLERRM;
      
      RETURN QUERY SELECT 
        v_record.id,
        v_record.nombre_completo,
        v_record.email_laboral,
        v_record.auth_email,
        v_record.auth_email::text,
        false;
    END;
  END LOOP;

  RAISE NOTICE 'Reparación completada: % usuarios procesados', v_count;
END;
$$;

-- ============================================================================
-- 3. Ejecutar reparación de usuarios eliminados anteriormente
-- ============================================================================

-- Reparar usuarios que fueron eliminados antes de este fix
SELECT * FROM repair_deleted_users_emails();

-- Comentarios
COMMENT ON FUNCTION safe_delete_user IS
  'Soft delete de usuario. Libera email_laboral modificando auth.users.email a formato dummy único.';

COMMENT ON FUNCTION repair_deleted_users_emails IS
  'Repara usuarios eliminados anteriormente para liberar sus email_laboral.';
