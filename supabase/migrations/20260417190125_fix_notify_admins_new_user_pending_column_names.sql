/*
  # Fix notify_admins_new_user_pending function

  The trigger function was using wrong column names:
  - `user_id` → should be `usuario_id`
  - `icono` → column does not exist (removed)
  - `accion_texto` → column does not exist (removed)
*/

CREATE OR REPLACE FUNCTION notify_admins_new_user_pending()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  admin_id uuid;
  creator_name text;
  new_user_name text;
  notification_message text;
BEGIN
  IF NEW.estado <> 'pendiente' THEN
    RETURN NEW;
  END IF;

  new_user_name := COALESCE(NEW.nombre_completo, NEW.nombre || ' ' || NEW.apellidos);

  SELECT nombre_completo INTO creator_name
  FROM usuarios
  WHERE id = auth.uid()
  LIMIT 1;

  IF creator_name IS NULL THEN
    creator_name := 'Un gerente';
  END IF;

  notification_message := creator_name || ' ha creado un nuevo usuario que requiere activación: ' || new_user_name;

  FOR admin_id IN
    SELECT id
    FROM usuarios
    WHERE rol = 'Administrador'
    AND estado = 'activo'
    AND (deleted_at IS NULL OR is_deleted = false)
  LOOP
    INSERT INTO notificaciones (
      usuario_id,
      titulo,
      mensaje,
      modulo,
      accion_url,
      leida
    ) VALUES (
      admin_id,
      'Nuevo Usuario Pendiente de Activación',
      notification_message,
      'usuarios',
      '/configuracion?tab=usuarios&highlight=' || NEW.id::text,
      false
    );
  END LOOP;

  RETURN NEW;
END;
$$;
