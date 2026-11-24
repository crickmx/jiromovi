/*
  # Arreglar Notificaciones de Bienvenida al Crear y Activar Usuarios

  1. Cambios
    - Enviar notificaciones de bienvenida cuando se CREA un usuario activo
    - Enviar notificaciones de bienvenida cuando se ACTIVA un usuario
    - Usar el tipo 'bienvenida' que está activo
    - Incluir todos los datos necesarios (password inicial, página web, etc.)

  2. Seguridad
    - SECURITY DEFINER para poder enviar notificaciones
    - Validación de estado y cambios
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

  -- Password temporal (asumimos que se enviará al crear el usuario)
  v_password_temp := 'La que configuraste al registrarte';

  -- Enviar notificación de bienvenida usando el sistema de notificaciones
  BEGIN
    PERFORM enviar_notificacion_completa(
      p_tipo_codigo := 'bienvenida',
      p_user_id := NEW.id,
      p_titulo := '¡Bienvenido a MOVI Digital!',
      p_mensaje := 'Tu cuenta ha sido creada exitosamente. Explora todas las funcionalidades de la plataforma.',
      p_modulo := 'usuarios',
      p_datos_adicionales := jsonb_build_object(
        'nombre', COALESCE(NEW.nombre_completo, ''),
        'email_laboral', NEW.email_laboral,
        'password', v_password_temp,
        'rol', NEW.rol,
        'oficina', v_oficina_nombre,
        'pagina_web', v_pagina_web,
        'puesto', COALESCE(NEW.puesto, '')
      ),
      p_accion_url := '/dashboard'
    );

    RAISE LOG '[welcome_create] Notificaciones de bienvenida enviadas correctamente';
  EXCEPTION WHEN OTHERS THEN
    RAISE LOG '[welcome_create] Error al enviar notificaciones: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;

-- Actualizar trigger para envío en creación (solo INSERT)
DROP TRIGGER IF EXISTS trigger_send_welcome_on_create ON usuarios;

CREATE TRIGGER trigger_send_welcome_on_create
  AFTER INSERT ON usuarios
  FOR EACH ROW
  EXECUTE FUNCTION send_welcome_on_user_create();

-- Actualizar función para envío en activación (solo UPDATE)
CREATE OR REPLACE FUNCTION send_welcome_on_user_activation()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_pagina_web text;
  v_oficina_nombre text;
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

    -- Usar tipo 'cuenta_activada' para cuando un gerente activa la cuenta
    BEGIN
      PERFORM enviar_notificacion_completa(
        p_tipo_codigo := 'cuenta_activada',
        p_user_id := NEW.id,
        p_titulo := '¡Tu cuenta ha sido activada!',
        p_mensaje := 'Tu cuenta en MOVI Digital ha sido activada exitosamente. Ya puedes acceder a todas las funcionalidades.',
        p_modulo := 'usuarios',
        p_datos_adicionales := jsonb_build_object(
          'nombre', COALESCE(NEW.nombre_completo, ''),
          'email_laboral', NEW.email_laboral,
          'password', 'La que configuraste al registrarte',
          'rol', NEW.rol,
          'oficina', v_oficina_nombre,
          'pagina_web', v_pagina_web,
          'puesto', COALESCE(NEW.puesto, '')
        ),
        p_accion_url := '/dashboard'
      );

      RAISE LOG '[welcome_activate] Notificaciones de activación enviadas correctamente';
    EXCEPTION WHEN OTHERS THEN
      RAISE LOG '[welcome_activate] Error al enviar notificaciones: %', SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$$;

-- Comentarios
COMMENT ON FUNCTION send_welcome_on_user_create IS
  'Envía notificaciones de bienvenida cuando se crea un usuario con estado activo';

COMMENT ON FUNCTION send_welcome_on_user_activation IS
  'Envía notificaciones de cuenta activada cuando se activa un usuario que estaba pendiente o inactivo';
