/*
  # Purgar y Liberar Emails de Usuarios Anteriores / Eliminados

  1. Limpia registros huérfanos o eliminados de cuentas como contacto.calvillo@jiro.mx y contacto.agsnorte@jiro.mx
  2. Libera auth.users y public.usuarios para permitir re-registro
  3. Actualiza safe_delete_user para liberar email_laboral y email_personal
*/

-- 1. Purgar usuarios anteriores de prueba específicos
DO $$
DECLARE
  v_user_ids uuid[];
  v_id uuid;
BEGIN
  SELECT ARRAY_AGG(DISTINCT id) INTO v_user_ids
  FROM (
    SELECT id FROM public.usuarios 
    WHERE LOWER(email_laboral) IN ('contacto.calvillo@jiro.mx', 'contacto.agsnorte@jiro.mx')
       OR LOWER(email_personal) IN ('contacto.calvillo@jiro.mx', 'contacto.agsnorte@jiro.mx')
    UNION
    SELECT id FROM auth.users 
    WHERE LOWER(email) IN ('contacto.calvillo@jiro.mx', 'contacto.agsnorte@jiro.mx')
  ) t;

  IF v_user_ids IS NOT NULL AND array_length(v_user_ids, 1) > 0 THEN
    FOREACH v_id IN ARRAY v_user_ids LOOP
      DELETE FROM public.auditoria_usuarios WHERE usuario_id = v_id;
      DELETE FROM public.destinatarios_notificacion WHERE usuario_id = v_id;
      DELETE FROM public.tramites_grupos_reglas WHERE usuario_id = v_id;
      DELETE FROM public.tramites_grupos_miembros WHERE usuario_id = v_id;
      DELETE FROM public.tramites_reglas_por_tipo WHERE usuario_id = v_id;
      
      DELETE FROM public.usuarios WHERE id = v_id;
      DELETE FROM auth.users WHERE id = v_id;
      
      RAISE NOTICE 'Usuario purgado: %', v_id;
    END LOOP;
  END IF;
END $$;

-- 2. Liberar emails de todos los usuarios marcados como soft-deleted en public.usuarios
UPDATE public.usuarios
SET 
  email_laboral = 'deleted-' || LEFT(id::text, 8) || '@deleted.local',
  email_personal = NULL
WHERE (is_deleted = true OR estado = 'eliminado')
  AND (email_laboral NOT LIKE 'deleted-%@deleted.local' OR email_personal IS NOT NULL);

-- 3. Liberar emails en auth.users para usuarios con soft delete
UPDATE auth.users au
SET 
  email = 'deleted-' || LEFT(au.id::text, 8) || '@deleted.local',
  email_confirmed_at = NULL,
  updated_at = NOW()
FROM public.usuarios u
WHERE au.id = u.id
  AND (u.is_deleted = true OR u.estado = 'eliminado')
  AND au.email NOT LIKE 'deleted-%@deleted.local';

-- 4. Actualizar safe_delete_user para liberar email_laboral y email_personal
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
  deleted_dummy_email text;
  result jsonb;
BEGIN
  SELECT * INTO target_user FROM usuarios WHERE id = user_id_to_delete;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Usuario no encontrado', 'error_code', 'USER_NOT_FOUND');
  END IF;

  IF target_user.is_deleted = true THEN
    RETURN jsonb_build_object('success', false, 'error', 'Usuario ya está eliminado', 'error_code', 'USER_ALREADY_DELETED');
  END IF;

  SELECT * INTO admin_user FROM usuarios WHERE id = deleted_by_admin_id;

  IF NOT FOUND OR admin_user.rol != 'Administrador' OR admin_user.is_deleted = true THEN
    RETURN jsonb_build_object('success', false, 'error', 'Administrador no autorizado', 'error_code', 'INVALID_ADMIN');
  END IF;

  IF user_id_to_delete = deleted_by_admin_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'No puedes eliminarte a ti mismo', 'error_code', 'CANNOT_DELETE_SELF');
  END IF;

  IF target_user.rol = 'Administrador' THEN
    SELECT COUNT(*) INTO active_admin_count FROM usuarios WHERE rol = 'Administrador' AND is_deleted = false AND activo = true AND id != user_id_to_delete;
    IF active_admin_count = 0 THEN
      RETURN jsonb_build_object('success', false, 'error', 'No se puede eliminar el último administrador activo', 'error_code', 'LAST_ADMIN');
    END IF;
  END IF;

  deleted_dummy_email := 'deleted-' || LEFT(user_id_to_delete::text, 8) || '@deleted.local';

  BEGIN
    UPDATE auth.users
    SET email = deleted_dummy_email, email_confirmed_at = NULL, updated_at = now()
    WHERE id = user_id_to_delete;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[safe_delete] Error modificando auth.email: %', SQLERRM;
  END;

  UPDATE usuarios
  SET 
    is_deleted = true,
    deleted_at = now(),
    deleted_by_user_id = deleted_by_admin_id,
    estado = 'eliminado',
    activo = false,
    email_laboral = deleted_dummy_email,
    email_personal = NULL
  WHERE id = user_id_to_delete;

  INSERT INTO audit_logs (
    action, performed_by, target_user_id, target_resource_type, target_resource_id, details
  ) VALUES (
    'USER_DELETE', deleted_by_admin_id, user_id_to_delete, 'usuario', user_id_to_delete,
    jsonb_build_object(
      'user_name', target_user.nombre,
      'user_rol', target_user.rol,
      'email_laboral_original', target_user.email_laboral,
      'email_personal_original', target_user.email_personal,
      'auth_email_replaced', deleted_dummy_email,
      'deletion_reason', deletion_reason
    )
  );

  RETURN jsonb_build_object('success', true, 'message', 'Usuario eliminado y emails liberados.', 'email_released', true);
END;
$$;
