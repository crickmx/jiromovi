/*
  # Arreglar triggers de bienvenida para usar sistema notify()

  1. Cambios
    - Actualizar trigger de creación para usar notify() en lugar de enviar_notificacion_completa()
    - Actualizar trigger de activación para usar notify()
    - Sistema notify() es más confiable y crea trabajos en notification_jobs

  2. Beneficios
    - Los trabajos se registran correctamente en notification_jobs
    - Sistema de cola más robusto
    - Mejor trazabilidad de envíos
*/

-- Función para enviar bienvenida cuando se crea un usuario activo
CREATE OR REPLACE FUNCTION send_welcome_on_user_create()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_pagina_web text;
  v_oficina_nombre text;
  v_password_temp text;
  v_result jsonb;
BEGIN
  -- Solo enviar bienvenida si se crea directamente como activo
  IF NEW.estado <> 'activo' THEN
    RETURN NEW;
  END IF;

  RAISE LOG '[welcome_create] Enviando bienvenida a nuevo usuario activo: % - %', NEW.id, NEW.email_laboral;

  -- Construir URL de página web
  IF NEW.web_slug IS NOT NULL AND NEW.web_slug != '' THEN
    v_pagina_web := 'https://agentedeseguros.online/' || NEW.web_slug;
  ELSE
    v_pagina_web := 'No configurada aún';
  END IF;

  -- Obtener nombre de oficina
  IF NEW.oficina_id IS NOT NULL THEN
    SELECT nombre INTO v_oficina_nombre
    FROM oficinas
    WHERE id = NEW.oficina_id;
  END IF;

  IF v_oficina_nombre IS NULL THEN
    v_oficina_nombre := 'No asignada';
  END IF;

  -- Password temporal
  v_password_temp := 'La que configuraste al registrarte';

  -- Usar sistema notify() para crear trabajos de notificación
  BEGIN
    SELECT notify(
      'cuenta_activada',
      ARRAY[NEW.id],
      jsonb_build_object(
        'nombre', COALESCE(NEW.nombre, ''),
        'apellidos', COALESCE(NEW.apellidos, ''),
        'nombre_completo', COALESCE(NEW.nombre_completo, ''),
        'email_laboral', NEW.email_laboral,
        'email_personal', COALESCE(NEW.email_personal, ''),
        'celular_laboral', COALESCE(NEW.celular_laboral, ''),
        'celular_personal', COALESCE(NEW.celular_personal, ''),
        'password', v_password_temp,
        'rol', NEW.rol,
        'oficina', v_oficina_nombre,
        'puesto', COALESCE(NEW.puesto, ''),
        'pagina_web', v_pagina_web
      ),
      'user_created_automatic'
    ) INTO v_result;

    RAISE LOG '[welcome_create] Trabajos de notificación creados: %', v_result;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[welcome_create] Error al crear trabajos de notificación: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;

-- Actualizar función para envío en activación
CREATE OR REPLACE FUNCTION send_welcome_on_user_activation()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_pagina_web text;
  v_oficina_nombre text;
  v_result jsonb;
BEGIN
  -- Solo proceder si el estado cambió a 'activo' y antes no lo era
  IF NEW.estado = 'activo' AND OLD.estado IS NOT NULL AND OLD.estado != 'activo' THEN
    RAISE LOG '[welcome_activate] Usuario activado: % - %', NEW.id, NEW.email_laboral;

    -- Construir URL de página web
    IF NEW.web_slug IS NOT NULL AND NEW.web_slug != '' THEN
      v_pagina_web := 'https://agentedeseguros.online/' || NEW.web_slug;
    ELSE
      v_pagina_web := 'No configurada aún';
    END IF;

    -- Obtener nombre de oficina
    IF NEW.oficina_id IS NOT NULL THEN
      SELECT nombre INTO v_oficina_nombre
      FROM oficinas
      WHERE id = NEW.oficina_id;
    END IF;

    IF v_oficina_nombre IS NULL THEN
      v_oficina_nombre := 'No asignada';
    END IF;

    -- Usar sistema notify() para crear trabajos de notificación
    BEGIN
      SELECT notify(
        'cuenta_activada',
        ARRAY[NEW.id],
        jsonb_build_object(
          'nombre', COALESCE(NEW.nombre, ''),
          'apellidos', COALESCE(NEW.apellidos, ''),
          'nombre_completo', COALESCE(NEW.nombre_completo, ''),
          'email_laboral', NEW.email_laboral,
          'email_personal', COALESCE(NEW.email_personal, ''),
          'celular_laboral', COALESCE(NEW.celular_laboral, ''),
          'celular_personal', COALESCE(NEW.celular_personal, ''),
          'password', 'La que configuraste al registrarte',
          'rol', NEW.rol,
          'oficina', v_oficina_nombre,
          'puesto', COALESCE(NEW.puesto, ''),
          'pagina_web', v_pagina_web
        ),
        'user_activated_automatic'
      ) INTO v_result;

      RAISE LOG '[welcome_activate] Trabajos de notificación creados: %', v_result;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '[welcome_activate] Error al crear trabajos de notificación: %', SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$$;

-- Comentarios
COMMENT ON FUNCTION send_welcome_on_user_create IS
  'Envía notificaciones de bienvenida usando notify() cuando se crea un usuario con estado activo';

COMMENT ON FUNCTION send_welcome_on_user_activation IS
  'Envía notificaciones de cuenta activada usando notify() cuando se activa un usuario';
