-- Migración: Limpieza y depuración integral de bases de datos de usuarios
-- Anonimiza correos de eliminados, limpia asignaciones huérfanas, reglas, mapeos y purga auth.users.

BEGIN;

-- 1. Liberar emails en public.usuarios para registros eliminados con correo retenido
UPDATE public.usuarios u
SET 
  email_laboral = 'deleted-' || LEFT(u.id::text, 8) || '@deleted.local',
  email_personal = NULL,
  activo = false,
  estado = 'eliminado',
  is_deleted = true,
  updated_at = NOW()
WHERE (u.is_deleted = true OR u.estado = 'eliminado')
  AND (u.email_laboral NOT LIKE 'deleted-%@deleted.local' OR u.email_personal IS NOT NULL);

-- 2. Liberar emails en auth.users para usuarios con soft delete
UPDATE auth.users au
SET 
  email = 'deleted-' || LEFT(au.id::text, 8) || '@deleted.local',
  email_confirmed_at = NULL,
  updated_at = NOW()
FROM public.usuarios u
WHERE au.id = u.id
  AND (u.is_deleted = true OR u.estado = 'eliminado')
  AND au.email NOT LIKE 'deleted-%@deleted.local';

-- 3. Limpiar relaciones operativas y reglas asignadas a usuarios eliminados
DELETE FROM public.tramites_grupos_miembros
WHERE usuario_id IN (
  SELECT id FROM public.usuarios WHERE is_deleted = true OR estado = 'eliminado'
);

DELETE FROM public.tramites_reglas_por_tipo
WHERE usuario_id IN (
  SELECT id FROM public.usuarios WHERE is_deleted = true OR estado = 'eliminado'
);

DELETE FROM public.destinatarios_notificacion
WHERE usuario_id IN (
  SELECT id FROM public.usuarios WHERE is_deleted = true OR estado = 'eliminado'
);

-- 4. Limpiar mapeos SICAS y producción de usuarios eliminados
DELETE FROM public.sicas_mapeo_vendedor_usuario
WHERE movi_user_id IN (
  SELECT id FROM public.usuarios WHERE is_deleted = true OR estado = 'eliminado'
);

UPDATE public.vendor_mappings
SET status = 'inactive', updated_at = NOW()
WHERE movi_user_id IN (
  SELECT id FROM public.usuarios WHERE is_deleted = true OR estado = 'eliminado'
) AND status = 'active';

-- 5. Trigger automático para que futuros borrados limpien todo en cascada
CREATE OR REPLACE FUNCTION public.fn_auto_cleanup_deleted_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dummy_email text;
BEGIN
  IF (NEW.is_deleted = true OR NEW.estado = 'eliminado') AND 
     (OLD.is_deleted IS DISTINCT FROM true OR OLD.estado IS DISTINCT FROM 'eliminado') THEN
    
    v_dummy_email := 'deleted-' || LEFT(NEW.id::text, 8) || '@deleted.local';
    NEW.email_laboral := v_dummy_email;
    NEW.email_personal := NULL;
    NEW.activo := false;
    NEW.estado := 'eliminado';
    NEW.is_deleted := true;

    -- Liberar en auth.users
    BEGIN
      UPDATE auth.users
      SET email = v_dummy_email, email_confirmed_at = NULL, updated_at = NOW()
      WHERE id = NEW.id;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '[auto_cleanup_deleted_user] Error actualizando auth.users: %', SQLERRM;
    END;

    -- Limpiar membresías y reglas
    DELETE FROM public.tramites_grupos_miembros WHERE usuario_id = NEW.id;
    DELETE FROM public.tramites_reglas_por_tipo WHERE usuario_id = NEW.id;
    DELETE FROM public.destinatarios_notificacion WHERE usuario_id = NEW.id;
    DELETE FROM public.sicas_mapeo_vendedor_usuario WHERE movi_user_id = NEW.id;
    UPDATE public.vendor_mappings SET status = 'inactive', updated_at = NOW() WHERE movi_user_id = NEW.id AND status = 'active';

  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_cleanup_deleted_user ON public.usuarios;
CREATE TRIGGER trg_auto_cleanup_deleted_user
  BEFORE UPDATE ON public.usuarios
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_auto_cleanup_deleted_user();

-- 6. Purgar huérfanos reales en auth.users que no pertenezcan a SeguWallet ni Chava
SELECT * FROM public.purgar_huerfanos_auth(1);

COMMIT;