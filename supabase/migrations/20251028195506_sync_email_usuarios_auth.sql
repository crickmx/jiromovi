/*
  # Sincronizar Emails entre auth.users y usuarios

  ## Problema Identificado
  Hay inconsistencias entre los emails en `auth.users` y `usuarios.email_laboral`.
  Esto causa que los usuarios no puedan iniciar sesión correctamente.

  ## Solución
  1. Actualizar email_laboral en usuarios para que coincida con auth.users
  2. Crear trigger para mantener sincronización automática
  3. Crear función para actualizar emails cuando cambien en auth

  ## Cambios
  - Sincroniza emails existentes
  - Crea trigger automático de sincronización
  - Asegura que nuevos usuarios tengan emails consistentes
*/

-- Actualizar email_laboral para que coincida con auth.users
UPDATE usuarios u
SET email_laboral = au.email
FROM auth.users au
WHERE u.id = au.id
  AND (u.email_laboral IS NULL OR u.email_laboral != au.email);

-- Crear función para sincronizar email cuando se actualiza en auth.users
CREATE OR REPLACE FUNCTION sync_usuario_email_from_auth()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, auth, pg_temp
LANGUAGE plpgsql
AS $$
BEGIN
  -- Actualizar email_laboral en usuarios cuando cambia en auth.users
  UPDATE public.usuarios
  SET email_laboral = NEW.email,
      updated_at = now()
  WHERE id = NEW.id;
  
  RETURN NEW;
END;
$$;

-- Crear trigger en auth.users para sincronizar cambios de email
DROP TRIGGER IF EXISTS on_auth_user_email_updated ON auth.users;
CREATE TRIGGER on_auth_user_email_updated
  AFTER INSERT OR UPDATE OF email ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION sync_usuario_email_from_auth();

-- Verificar que todos los usuarios tengan email_laboral
DO $$
DECLARE
  usuarios_sin_email INTEGER;
BEGIN
  SELECT COUNT(*) INTO usuarios_sin_email
  FROM usuarios u
  LEFT JOIN auth.users au ON u.id = au.id
  WHERE u.email_laboral IS NULL OR u.email_laboral = '';
  
  IF usuarios_sin_email > 0 THEN
    RAISE NOTICE 'Atención: % usuarios sin email_laboral', usuarios_sin_email;
  ELSE
    RAISE NOTICE 'Todos los usuarios tienen email_laboral configurado';
  END IF;
END $$;
