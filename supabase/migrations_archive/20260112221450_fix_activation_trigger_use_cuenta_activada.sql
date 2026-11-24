/*
  # Corregir trigger de activación para usar plantilla correcta
  
  1. Problema
    - El trigger de activación estaba usando 'bienvenida' (obsoleto)
    - Debe usar 'cuenta_activada' cuando un admin activa una cuenta
  
  2. Solución
    - Actualizar función para usar 'cuenta_activada'
    - Usar el sistema de notificaciones transaccionales unificado
    - Enviar por todos los canales configurados
*/

-- Actualizar función de activación para usar cuenta_activada
CREATE OR REPLACE FUNCTION send_welcome_notifications_on_activation()
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
  -- Solo proceder si el estado cambió a 'activo' y antes no lo era
  IF NEW.estado = 'activo' AND (OLD.estado IS NULL OR OLD.estado != 'activo') THEN
    RAISE LOG '[activation] Usuario activado: % - %', NEW.id, NEW.email_laboral;

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

    -- Password temporal (asumimos que el admin lo configuró)
    v_password_temp := 'La que te proporcionó tu administrador';

    -- Enviar notificación usando el tipo CORRECTO: cuenta_activada
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

COMMENT ON FUNCTION send_welcome_notifications_on_activation IS
  'Envía notificaciones de bienvenida usando la plantilla cuenta_activada cuando un usuario es activado por un administrador';
