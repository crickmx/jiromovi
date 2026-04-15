/*
  # Corregir URL de página personal en mensajes de bienvenida

  ## Cambio
  Todas las funciones que construyen la URL de página web personal del usuario
  usaban 'agentedeseguros.online' en lugar del dominio correcto 'agentedeseguros.website'.

  ## Funciones corregidas
  - trigger_send_welcome_on_activation
  - send_welcome_on_user_activation
  - send_welcome_notifications_on_activation
  - send_welcome_notification_manual
*/

-- 1. trigger_send_welcome_on_activation (función principal activa)
CREATE OR REPLACE FUNCTION trigger_send_welcome_on_activation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_oficina_nombre text;
  v_pagina_web text;
  v_recent_job boolean;
  v_activation_key text;
BEGIN
  IF NOT (NEW.estado = 'activo' AND (OLD.estado IS NULL OR OLD.estado != 'activo')) THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM notification_jobs
    WHERE event_code = 'cuenta_activada'
      AND user_id = NEW.id
      AND created_at > NOW() - INTERVAL '5 minutes'
    LIMIT 1
  ) INTO v_recent_job;

  IF v_recent_job THEN
    RAISE NOTICE '[ACTIVATION TRIGGER] Job reciente detectado para %, omitiendo duplicado', NEW.id;
    RETURN NEW;
  END IF;

  IF NEW.oficina_id IS NOT NULL THEN
    SELECT nombre INTO v_oficina_nombre
    FROM oficinas
    WHERE id = NEW.oficina_id;
  END IF;

  IF v_oficina_nombre IS NULL THEN
    v_oficina_nombre := 'No asignada';
  END IF;

  IF NEW.web_slug IS NOT NULL AND NEW.web_slug != '' THEN
    v_pagina_web := 'https://agentedeseguros.website/' || NEW.web_slug;
  ELSE
    v_pagina_web := 'No configurada aún';
  END IF;

  v_activation_key := NEW.id::text || '_' || extract(epoch from NOW())::bigint::text;

  BEGIN
    PERFORM notify(
      'cuenta_activada',
      ARRAY[NEW.id],
      jsonb_build_object(
        'nombre', COALESCE(NEW.nombre, ''),
        'apellidos', COALESCE(NEW.apellidos, ''),
        'nombre_completo', COALESCE(NEW.nombre_completo, TRIM(COALESCE(NEW.nombre, '') || ' ' || COALESCE(NEW.apellidos, ''))),
        'email_laboral', NEW.email_laboral,
        'email_personal', COALESCE(NEW.email_personal, ''),
        'celular_laboral', COALESCE(NEW.celular_laboral, ''),
        'celular_personal', COALESCE(NEW.celular_personal, ''),
        'password', 'La contraseña que configuraste',
        'rol', NEW.rol,
        'oficina', v_oficina_nombre,
        'puesto', COALESCE(NEW.puesto, 'Sin asignar'),
        'pagina_web', v_pagina_web,
        'url', '/dashboard'
      ),
      v_activation_key
    );
    RAISE NOTICE '[ACTIVATION TRIGGER] Notificación cuenta_activada enviada para usuario %', NEW.id;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[ACTIVATION TRIGGER] Error al enviar notificación: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;

-- 2. send_welcome_on_user_activation
CREATE OR REPLACE FUNCTION send_welcome_on_user_activation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pagina_web text;
  v_oficina_nombre text;
  v_result jsonb;
BEGIN
  IF NEW.estado = 'activo' AND OLD.estado IS NOT NULL AND OLD.estado != 'activo' THEN
    RAISE LOG '[welcome_activate] Usuario activado: % - %', NEW.id, NEW.email_laboral;

    IF NEW.web_slug IS NOT NULL AND NEW.web_slug != '' THEN
      v_pagina_web := 'https://agentedeseguros.website/' || NEW.web_slug;
    ELSE
      v_pagina_web := 'No configurada aún';
    END IF;

    IF NEW.oficina_id IS NOT NULL THEN
      SELECT nombre INTO v_oficina_nombre
      FROM oficinas
      WHERE id = NEW.oficina_id;
    END IF;

    IF v_oficina_nombre IS NULL THEN
      v_oficina_nombre := 'No asignada';
    END IF;

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

-- 3. send_welcome_notifications_on_activation
CREATE OR REPLACE FUNCTION send_welcome_notifications_on_activation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pagina_web text;
  v_oficina_nombre text;
  v_password_temp text;
BEGIN
  IF NEW.estado = 'activo' AND (OLD.estado IS NULL OR OLD.estado != 'activo') THEN
    RAISE LOG '[activation] Usuario activado: % - %', NEW.id, NEW.email_laboral;

    IF NEW.web_slug IS NOT NULL AND NEW.web_slug != '' THEN
      v_pagina_web := 'https://agentedeseguros.website/' || NEW.web_slug;
    ELSE
      v_pagina_web := 'No configurada aún';
    END IF;

    IF NEW.oficina_id IS NOT NULL THEN
      SELECT nombre INTO v_oficina_nombre
      FROM oficinas
      WHERE id = NEW.oficina_id;
    END IF;

    IF v_oficina_nombre IS NULL THEN
      v_oficina_nombre := 'No asignada';
    END IF;

    v_password_temp := 'La que te proporcionó tu administrador';

    BEGIN
      PERFORM enviar_notificacion_completa(
        p_tipo_codigo := 'cuenta_activada',
        p_user_id := NEW.id,
        p_titulo := '¡Bienvenido a MOVI Digital!',
        p_mensaje := 'Tu cuenta ha sido activada exitosamente. Ya puedes acceder a la plataforma.',
        p_modulo := 'usuarios',
        p_datos_adicionales := jsonb_build_object(
          'nombre', COALESCE(NEW.nombre_completo, NEW.nombre || ' ' || NEW.apellidos),
          'email_laboral', NEW.email_laboral,
          'password', v_password_temp,
          'pagina_web', v_pagina_web,
          'oficina', v_oficina_nombre,
          'rol', NEW.rol
        ),
        p_accion_url := '/dashboard'
      );
      RAISE LOG '[activation] Notificación de cuenta_activada enviada correctamente';
    EXCEPTION WHEN OTHERS THEN
      RAISE LOG '[activation] Error al enviar notificación: %', SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$$;

-- 4. send_welcome_notification_manual
CREATE OR REPLACE FUNCTION send_welcome_notification_manual(
  p_user_id uuid,
  p_tipo_notificacion text DEFAULT 'cuenta_activada'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user record;
  v_pagina_web text;
  v_oficina_nombre text;
  v_result jsonb;
BEGIN
  SELECT * INTO v_user
  FROM usuarios
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Usuario no encontrado');
  END IF;

  IF v_user.web_slug IS NOT NULL AND v_user.web_slug != '' THEN
    v_pagina_web := 'https://agentedeseguros.website/' || v_user.web_slug;
  ELSE
    v_pagina_web := 'No configurada aún';
  END IF;

  IF v_user.oficina_id IS NOT NULL THEN
    SELECT nombre INTO v_oficina_nombre
    FROM oficinas
    WHERE id = v_user.oficina_id;
  END IF;

  IF v_oficina_nombre IS NULL THEN
    v_oficina_nombre := 'No asignada';
  END IF;

  SELECT notify(
    p_tipo_notificacion,
    ARRAY[p_user_id],
    jsonb_build_object(
      'nombre', COALESCE(v_user.nombre, ''),
      'apellidos', COALESCE(v_user.apellidos, ''),
      'nombre_completo', COALESCE(v_user.nombre_completo, ''),
      'email_laboral', v_user.email_laboral,
      'email_personal', COALESCE(v_user.email_personal, ''),
      'celular_laboral', COALESCE(v_user.celular_laboral, ''),
      'celular_personal', COALESCE(v_user.celular_personal, ''),
      'password', 'La que configuraste al registrarte',
      'rol', v_user.rol,
      'oficina', v_oficina_nombre,
      'puesto', COALESCE(v_user.puesto, ''),
      'pagina_web', v_pagina_web
    ),
    'manual_call'
  ) INTO v_result;

  RETURN jsonb_build_object(
    'success', true,
    'user_id', p_user_id,
    'notification_type', p_tipo_notificacion,
    'jobs_created', v_result
  );
END;
$$;
