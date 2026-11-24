/*
  # Fix Activation Trigger - Remove WHEN Clause

  ## Problema
  El trigger con cláusula WHEN no se está ejecutando porque la condición no se evalúa correctamente.
  
  ## Solución
  Mover la lógica de validación dentro de la función en lugar de usar WHEN en el trigger.
  Esto asegura que la función siempre se ejecute y pueda hacer logging para debug.

  ## Cambios
  1. Eliminar cláusula WHEN del trigger
  2. La validación de estado se mantiene dentro de la función
  3. Agregar logging adicional para debugging
*/

-- Recrear función con más logging
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
  -- Debug logging
  RAISE NOTICE 'Trigger ejecutado para usuario %', NEW.id;
  RAISE NOTICE 'Estado OLD: %, Estado NEW: %', OLD.estado, NEW.estado;

  -- Solo ejecutar si el estado cambió a 'activo'
  IF NEW.estado = 'activo' AND (OLD.estado IS NULL OR OLD.estado != 'activo') THEN
    RAISE NOTICE 'Condición cumplida, enviando notificación...';

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
    BEGIN
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

      RAISE NOTICE 'Notificación de bienvenida enviada exitosamente para usuario %: %', NEW.id, NEW.email_laboral;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Error al enviar notificación de bienvenida: %', SQLERRM;
    END;
  ELSE
    RAISE NOTICE 'Condición NO cumplida. No se envía notificación.';
  END IF;

  RETURN NEW;
END;
$$;

-- Eliminar trigger anterior
DROP TRIGGER IF EXISTS trigger_send_welcome_on_user_activation ON usuarios;

-- Crear trigger SIN cláusula WHEN (la validación está dentro de la función)
CREATE TRIGGER trigger_send_welcome_on_user_activation
  AFTER UPDATE ON usuarios
  FOR EACH ROW
  EXECUTE FUNCTION trigger_send_welcome_on_activation();

COMMENT ON TRIGGER trigger_send_welcome_on_user_activation ON usuarios IS
  'Envía notificaciones de bienvenida cuando un usuario es activado. La validación de estado se hace dentro de la función.';

COMMENT ON FUNCTION trigger_send_welcome_on_activation IS
  'Detecta activación de usuario (cambio a estado activo) y envía notificaciones vía notify(). Incluye logging para debugging.';
