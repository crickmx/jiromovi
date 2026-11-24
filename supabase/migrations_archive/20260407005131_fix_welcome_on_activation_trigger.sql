/*
  # Fix Welcome Notifications on User Activation

  ## Problema
  Cuando un usuario pasa de estado 'pendiente' a 'activo', no se envían las notificaciones
  de bienvenida automáticamente.

  ## Solución
  Crear un trigger que detecte el cambio de estado y llame a la función notify() para enviar
  las notificaciones de bienvenida (email, WhatsApp, in-app).

  ## Notas
  - Se usa la función `notify()` que maneja todos los canales de notificación
  - Se valida que el cambio sea de cualquier estado inactivo a 'activo'
  - No se ejecuta si el usuario ya estaba activo
*/

-- Crear función que detecta activación de usuario
CREATE OR REPLACE FUNCTION trigger_send_welcome_on_activation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_oficina_nombre text;
  v_pagina_web text;
BEGIN
  -- Solo ejecutar si el estado cambió a 'activo'
  IF NEW.estado = 'activo' AND (OLD.estado IS NULL OR OLD.estado != 'activo') THEN

    -- Obtener nombre de oficina
    IF NEW.oficina_id IS NOT NULL THEN
      SELECT nombre INTO v_oficina_nombre
      FROM oficinas
      WHERE id = NEW.oficina_id;
    END IF;

    IF v_oficina_nombre IS NULL THEN
      v_oficina_nombre := 'No asignada';
    END IF;

    -- Construir URL de página web
    IF NEW.web_slug IS NOT NULL AND NEW.web_slug != '' THEN
      v_pagina_web := 'https://agentedeseguros.online/' || NEW.web_slug;
    ELSE
      v_pagina_web := 'No configurada aún';
    END IF;

    -- Enviar notificación de cuenta activada usando notify()
    PERFORM notify(
      'cuenta_activada',
      ARRAY[NEW.id],
      jsonb_build_object(
        'nombre', COALESCE(NEW.nombre, ''),
        'apellidos', COALESCE(NEW.apellidos, ''),
        'nombre_completo', COALESCE(NEW.nombre_completo, NEW.nombre || ' ' || NEW.apellidos),
        'email_laboral', NEW.email_laboral,
        'email_personal', COALESCE(NEW.email_personal, ''),
        'celular_laboral', COALESCE(NEW.celular_laboral, ''),
        'celular_personal', COALESCE(NEW.celular_personal, ''),
        'password', 'Tu contraseña configurada',
        'rol', NEW.rol,
        'oficina', v_oficina_nombre,
        'puesto', COALESCE(NEW.puesto, ''),
        'pagina_web', v_pagina_web
      ),
      'activation_trigger'
    );

    RAISE NOTICE 'Notificación de bienvenida enviada para usuario %: %', NEW.id, NEW.email_laboral;
  END IF;

  RETURN NEW;
END;
$$;

-- Eliminar trigger anterior si existe
DROP TRIGGER IF EXISTS trigger_send_welcome_on_user_activation ON usuarios;

-- Crear trigger para detectar activación
CREATE TRIGGER trigger_send_welcome_on_user_activation
  AFTER UPDATE ON usuarios
  FOR EACH ROW
  WHEN (NEW.estado = 'activo' AND (OLD.estado IS NULL OR OLD.estado != 'activo'))
  EXECUTE FUNCTION trigger_send_welcome_on_activation();

COMMENT ON TRIGGER trigger_send_welcome_on_user_activation ON usuarios IS
  'Envía notificaciones de bienvenida cuando un usuario es activado (cambia de cualquier estado a activo)';

COMMENT ON FUNCTION trigger_send_welcome_on_activation IS
  'Función que detecta la activación de un usuario y envía notificaciones de bienvenida a través del sistema notify()';
