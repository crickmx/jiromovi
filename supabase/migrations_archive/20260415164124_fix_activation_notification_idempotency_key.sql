/*
  # Fix notificacion cuenta_activada: clave idempotencia incluye timestamp

  ## Problema
  Al reactivar un usuario que ya fue activado antes, la función notify() intenta
  insertar un notification_job con la misma idempotency_key que la primera activación
  (cuenta_activada_{user_id}_email), lo que causa un unique_violation silencioso
  y la notificación nunca se envía.

  ## Solución
  Modificar la función trigger para pasar un entity_id basado en el timestamp
  actual (truncado a minutos) en lugar de usar el user_id. Esto garantiza que
  cada evento de activación genere una clave única.

  También se corrige la función trigger para NO usar correo_historial_envios
  como guard (ese historial puede tener registros de activaciones anteriores)
  y en cambio usar notification_jobs con una ventana de 5 minutos.
*/

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
  -- Solo actuar cuando el estado cambia a 'activo' desde un estado diferente
  IF NOT (NEW.estado = 'activo' AND (OLD.estado IS NULL OR OLD.estado != 'activo')) THEN
    RETURN NEW;
  END IF;

  -- Guard anti-duplicados: verificar si ya hay un job de cuenta_activada
  -- pendiente o procesado en los últimos 5 minutos para este usuario
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

  -- Usar timestamp truncado a segundos como entity_id para garantizar
  -- que cada re-activación genere una idempotency_key distinta
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
