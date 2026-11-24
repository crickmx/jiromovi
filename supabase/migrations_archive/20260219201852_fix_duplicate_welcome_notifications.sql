/*
  # Fix Duplicate Welcome Notifications

  ## Problema
  Se están enviando 4 correos de bienvenida al crear un usuario porque:
  1. El trigger `send_welcome_on_user_create()` se dispara en INSERT
  2. El trigger `send_welcome_on_user_activation()` se dispara en UPDATE
  3. La Edge Function `create-user` llama directamente a `enviar_notificacion_completa()`
  4. Posibles llamadas duplicadas a notify()

  ## Solución
  - Deshabilitar los triggers automáticos
  - Dejar que SOLO la Edge Function maneje el envío de notificaciones
  - Esto da mayor control y evita duplicados

  ## Beneficios
  - Control total sobre cuándo y cómo se envían las notificaciones
  - Evita duplicados por triggers múltiples
  - Mejor logging y trazabilidad
*/

-- Paso 1: Eliminar triggers de bienvenida automáticos
DROP TRIGGER IF EXISTS trigger_send_welcome_on_create ON usuarios;
DROP TRIGGER IF EXISTS trigger_send_welcome_on_activation ON usuarios;
DROP TRIGGER IF EXISTS trigger_send_welcome_on_insert_active ON usuarios;

-- Paso 2: Mantener las funciones por si se necesitan en el futuro,
-- pero agregar comentarios claros
COMMENT ON FUNCTION send_welcome_on_user_create IS
  '[DEPRECATED] Esta función ya no se usa automáticamente. Las notificaciones de bienvenida se envían desde la Edge Function create-user para evitar duplicados.';

COMMENT ON FUNCTION send_welcome_on_user_activation IS
  '[DEPRECATED] Esta función ya no se usa automáticamente. Las notificaciones de activación se envían desde la Edge Function update-user o procesos manuales para evitar duplicados.';

-- Paso 3: Crear función de utilidad para enviar notificaciones de bienvenida de forma controlada
-- Esta función puede ser llamada manualmente cuando sea necesario
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
  -- Obtener datos del usuario
  SELECT * INTO v_user
  FROM usuarios
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Usuario no encontrado'
    );
  END IF;

  -- Construir URL de página web
  IF v_user.web_slug IS NOT NULL AND v_user.web_slug != '' THEN
    v_pagina_web := 'https://agentedeseguros.online/' || v_user.web_slug;
  ELSE
    v_pagina_web := 'No configurada aún';
  END IF;

  -- Obtener nombre de oficina
  IF v_user.oficina_id IS NOT NULL THEN
    SELECT nombre INTO v_oficina_nombre
    FROM oficinas
    WHERE id = v_user.oficina_id;
  END IF;

  IF v_oficina_nombre IS NULL THEN
    v_oficina_nombre := 'No asignada';
  END IF;

  -- Enviar notificación usando notify()
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

COMMENT ON FUNCTION send_welcome_notification_manual IS
  'Función de utilidad para enviar notificaciones de bienvenida manualmente cuando sea necesario. Usar desde Edge Functions o procedimientos administrativos.';

-- Paso 4: Verificar configuración de notify() para prevenir duplicados
-- La función notify() ya tiene idempotency keys, pero vamos a asegurarnos
-- de que la configuración del evento esté correcta

-- Verificar que cuenta_activada tiene los canales correctos
DO $$
DECLARE
  v_event record;
BEGIN
  SELECT * INTO v_event
  FROM notification_events_catalog
  WHERE event_code = 'cuenta_activada';

  IF FOUND THEN
    RAISE NOTICE 'Evento cuenta_activada configurado: email=%, whatsapp=%, in_app=%',
      v_event.enable_email, v_event.enable_whatsapp, v_event.enable_in_app;

    -- Si todos los canales están activados, se crearán 3 jobs (in_app, email, whatsapp)
    -- Esto es correcto y esperado, NO es un duplicado
    IF v_event.enable_email AND v_event.enable_whatsapp AND v_event.enable_in_app THEN
      RAISE NOTICE '✓ Los 3 canales están activos. Esto creará 3 jobs diferentes (campanita, email, WhatsApp) - esto es CORRECTO';
    END IF;
  ELSE
    RAISE WARNING '⚠ Evento cuenta_activada no encontrado en notification_events_catalog';
  END IF;
END $$;