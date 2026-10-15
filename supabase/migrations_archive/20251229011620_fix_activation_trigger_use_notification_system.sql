/*
  # Corregir Trigger de Activación para Usar Sistema de Notificaciones

  ## Problema
  El trigger `send_welcome_notifications_on_activation` estaba enviando WhatsApp directamente
  con código hardcodeado, sin respetar las configuraciones de canales de las plantillas.

  ## Solución
  1. Reemplazar el trigger para que use la función `enviar_notificacion_completa`
  2. Esta función respeta los canales configurados en `correo_plantillas`
  3. Permite usar la plantilla correcta: "cuenta_activada"

  ## Cambios
  - El trigger ahora llama a `enviar_notificacion_completa` con el tipo 'cuenta_activada'
  - Se envían todos los datos necesarios para las plantillas
  - Los canales (correo, whatsapp, notificación interna) se controlan desde la plantilla
*/

-- Recrear función de activación usando el sistema de notificaciones
DROP FUNCTION IF EXISTS send_welcome_notifications_on_activation() CASCADE;

CREATE OR REPLACE FUNCTION send_welcome_notifications_on_activation()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_pagina_web text;
  v_oficina_nombre text;
  v_titulo text;
  v_mensaje text;
BEGIN
  -- Solo proceder si el estado cambió a 'activo' y antes no lo era
  IF NEW.estado = 'activo' AND OLD.estado IS NOT NULL AND OLD.estado != 'activo' THEN
    RAISE LOG '[send_welcome] Usuario activado por gerente: % - %', NEW.id, NEW.email_laboral;

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

    -- Preparar título y mensaje para notificación interna
    v_titulo := '¡Bienvenido a MOVI Digital!';
    v_mensaje := 'Tu cuenta ha sido activada exitosamente. Explora todas las funcionalidades de la plataforma.';

    -- Usar función enviar_notificacion_completa que respeta los canales configurados
    BEGIN
      PERFORM enviar_notificacion_completa(
        p_tipo_codigo := 'cuenta_activada',
        p_user_id := NEW.id,
        p_titulo := v_titulo,
        p_mensaje := v_mensaje,
        p_modulo := 'usuarios',
        p_datos_adicionales := jsonb_build_object(
          'email_laboral', NEW.email_laboral,
          'password', 'La que configuraste al registrarte',
          'rol', NEW.rol,
          'oficina', v_oficina_nombre,
          'pagina_web', v_pagina_web,
          'puesto', COALESCE(NEW.puesto, '')
        ),
        p_accion_url := '/dashboard'
      );

      RAISE LOG '[send_welcome] Notificaciones de activación enviadas correctamente';
    EXCEPTION WHEN OTHERS THEN
      RAISE LOG '[send_welcome] Error al enviar notificaciones: %', SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$$;

-- Recrear trigger
DROP TRIGGER IF EXISTS trigger_send_welcome_on_activation ON usuarios;

CREATE TRIGGER trigger_send_welcome_on_activation
  AFTER UPDATE ON usuarios
  FOR EACH ROW
  WHEN (NEW.estado = 'activo' AND OLD.estado IS NOT NULL AND OLD.estado != 'activo')
  EXECUTE FUNCTION send_welcome_notifications_on_activation();

-- Comentarios
COMMENT ON FUNCTION send_welcome_notifications_on_activation() IS 
  'Envía notificaciones de bienvenida cuando un usuario pendiente es activado. Usa enviar_notificacion_completa para respetar canales configurados.';
COMMENT ON TRIGGER trigger_send_welcome_on_activation ON usuarios IS 
  'Trigger que envía notificaciones cuando un usuario pendiente es activado, respetando configuración de canales';
