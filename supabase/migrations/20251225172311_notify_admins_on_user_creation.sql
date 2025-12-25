/*
  # Notificar a Administradores cuando Gerente Crea Usuario

  1. Función y Trigger
    - Detecta cuando un gerente crea un usuario nuevo (estado = 'pendiente')
    - Envía notificación de campanita a todos los administradores
    - Incluye información del usuario y link para revisarlo

  2. Seguridad
    - La función se ejecuta con SECURITY DEFINER (permisos elevados)
    - Solo se dispara en INSERT de nuevos usuarios pendientes
*/

-- Función para notificar a administradores sobre usuarios nuevos creados por gerentes
CREATE OR REPLACE FUNCTION notify_admins_new_user_pending()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  admin_id uuid;
  creator_name text;
  new_user_name text;
  notification_message text;
BEGIN
  -- Solo procesar si el usuario está pendiente (creado por gerente)
  IF NEW.estado <> 'pendiente' THEN
    RETURN NEW;
  END IF;

  -- Obtener el nombre completo del usuario nuevo
  new_user_name := COALESCE(NEW.nombre_completo, NEW.nombre || ' ' || NEW.apellidos);

  -- Obtener el nombre del creador (si existe)
  SELECT nombre_completo INTO creator_name
  FROM usuarios
  WHERE id = auth.uid()
  LIMIT 1;

  -- Si no hay creador (caso edge), usar un nombre genérico
  IF creator_name IS NULL THEN
    creator_name := 'Un gerente';
  END IF;

  -- Construir el mensaje
  notification_message := creator_name || ' ha creado un nuevo usuario que requiere activación: ' || new_user_name;

  -- Enviar notificación a todos los administradores
  FOR admin_id IN
    SELECT id
    FROM usuarios
    WHERE rol = 'Administrador'
      AND estado = 'activo'
      AND eliminado_en IS NULL
  LOOP
    INSERT INTO notificaciones (
      user_id,
      titulo,
      mensaje,
      modulo,
      icono,
      accion_url,
      accion_texto,
      leida
    ) VALUES (
      admin_id,
      'Nuevo Usuario Pendiente de Activación',
      notification_message,
      'usuarios',
      'user-plus',
      '/configuracion?tab=usuarios&highlight=' || NEW.id::text,
      'Revisar y Activar',
      false
    );
  END LOOP;

  RETURN NEW;
END;
$$;

-- Crear el trigger
DROP TRIGGER IF EXISTS trigger_notify_admins_new_user ON usuarios;

CREATE TRIGGER trigger_notify_admins_new_user
  AFTER INSERT ON usuarios
  FOR EACH ROW
  EXECUTE FUNCTION notify_admins_new_user_pending();

-- Añadir comentario
COMMENT ON FUNCTION notify_admins_new_user_pending IS
  'Envía notificaciones de campanita a todos los administradores cuando un gerente crea un usuario nuevo que queda pendiente de activación';
