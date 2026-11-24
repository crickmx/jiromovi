/*
  # Force Recreate Activation Trigger Without WHEN Clause

  ## Problema
  El trigger anterior todavía tiene una cláusula WHEN (tgtype=17) aunque se intentó eliminar.
  Necesitamos forzar la recreación completa del trigger.

  ## Solución
  1. Eliminar completamente el trigger
  2. Eliminar y recrear la función
  3. Recrear el trigger sin ninguna condición WHEN

  ## Verificación
  Después de aplicar, el trigger debe tener tgtype diferente a 17 (sin WHEN).
*/

-- 1. Eliminar trigger existente
DROP TRIGGER IF EXISTS trigger_send_welcome_on_user_activation ON usuarios CASCADE;

-- 2. Eliminar función existente
DROP FUNCTION IF EXISTS trigger_send_welcome_on_activation() CASCADE;

-- 3. Recrear función con logging
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
  RAISE NOTICE '[ACTIVATION TRIGGER] Ejecutado para usuario %', NEW.id;
  RAISE NOTICE '[ACTIVATION TRIGGER] Estado OLD: %, Estado NEW: %', OLD.estado, NEW.estado;

  -- Solo ejecutar si el estado cambió a 'activo'
  IF NEW.estado = 'activo' AND (OLD.estado IS NULL OR OLD.estado != 'activo') THEN
    RAISE NOTICE '[ACTIVATION TRIGGER] Condición cumplida, enviando notificación...';

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

      RAISE NOTICE '[ACTIVATION TRIGGER] Notificación enviada exitosamente para usuario %: %', NEW.id, NEW.email_laboral;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '[ACTIVATION TRIGGER] Error al enviar notificación: %', SQLERRM;
    END;
  ELSE
    RAISE NOTICE '[ACTIVATION TRIGGER] Condición NO cumplida. No se envía notificación.';
  END IF;

  RETURN NEW;
END;
$$;

-- 4. Crear trigger SIN cláusula WHEN
-- IMPORTANTE: No usar WHEN en el CREATE TRIGGER
CREATE TRIGGER trigger_send_welcome_on_user_activation
  AFTER UPDATE ON usuarios
  FOR EACH ROW
  EXECUTE FUNCTION trigger_send_welcome_on_activation();

-- 5. Comentarios
COMMENT ON TRIGGER trigger_send_welcome_on_user_activation ON usuarios IS
  'Envía notificaciones de bienvenida cuando un usuario cambia a estado activo. Validación dentro de la función, NO en WHEN.';

COMMENT ON FUNCTION trigger_send_welcome_on_activation IS
  'Detecta cambio a estado activo y envía notificaciones vía notify(). Incluye logging con prefijo [ACTIVATION TRIGGER].';
