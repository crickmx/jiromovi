/*
  # Enviar notificaciones de bienvenida al activar usuario

  1. Nueva funcionalidad
    - Crear función que envíe notificaciones de bienvenida
    - Crear trigger que se active cuando un usuario cambie a estado 'activo'
    - Solo envía notificaciones si el estado anterior NO era 'activo'

  2. Canales
    - Envía correo electrónico
    - Envía WhatsApp (si tiene número disponible)
    - Envía notificación interna en la plataforma

  3. Notas
    - No se envía nada al crear el usuario
    - Solo se envía cuando el estado cambia de cualquier otro a 'activo'
    - Usa el sistema de notificaciones transaccionales existente
*/

-- Crear función para enviar notificaciones de bienvenida
CREATE OR REPLACE FUNCTION send_welcome_notifications_on_activation()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_supabase_url text;
  v_service_key text;
  v_http_response int;
BEGIN
  -- Solo proceder si el estado cambió a 'activo' y antes no lo era
  IF NEW.estado = 'activo' AND (OLD.estado IS NULL OR OLD.estado != 'activo') THEN
    -- Obtener URLs de las variables de entorno
    v_supabase_url := current_setting('app.settings.supabase_url', true);
    v_service_key := current_setting('app.settings.service_role_key', true);

    -- Si no están configuradas, usar las del sistema
    IF v_supabase_url IS NULL THEN
      v_supabase_url := 'https://' || current_setting('request.headers', true)::json->>'host';
    END IF;

    RAISE LOG '[send_welcome] Usuario activado: % - %', NEW.id, NEW.email_laboral;
    RAISE LOG '[send_welcome] Enviando notificaciones de bienvenida...';

    -- Enviar notificación usando el sistema transaccional
    -- Esto se hace mediante el insertar en la tabla de notificaciones
    BEGIN
      -- Insertar notificación de correo
      INSERT INTO correo_historial_envios (
        tipo_notificacion_id,
        destinatario_email,
        asunto,
        html_cuerpo,
        variables_usadas,
        estado,
        created_at
      )
      SELECT 
        ctn.id,
        NEW.email_laboral,
        REPLACE(REPLACE(REPLACE(cp.asunto, '{{nombre}}', NEW.nombre), '{{apellidos}}', NEW.apellidos), '{{nombre_plataforma}}', 'MOVI Digital'),
        REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(cp.html_cuerpo, '{{nombre}}', NEW.nombre), '{{apellidos}}', NEW.apellidos), '{{email}}', NEW.email_laboral), '{{rol}}', NEW.rol), '{{nombre_plataforma}}', 'MOVI Digital'),
        jsonb_build_object(
          'nombre', NEW.nombre,
          'apellidos', NEW.apellidos,
          'email_laboral', NEW.email_laboral,
          'rol', NEW.rol,
          'puesto', COALESCE(NEW.puesto, ''),
          'nombre_plataforma', 'MOVI Digital',
          'fecha', to_char(now(), 'DD/MM/YYYY')
        ),
        'pendiente',
        now()
      FROM correo_tipos_notificacion ctn
      INNER JOIN correo_plantillas cp ON cp.tipo_notificacion_id = ctn.id
      WHERE ctn.codigo = 'bienvenida' AND ctn.activo = true AND ctn.enviar_correo = true;

      RAISE LOG '[send_welcome] Correo de bienvenida encolado';
    EXCEPTION WHEN OTHERS THEN
      RAISE LOG '[send_welcome] Error al encolar correo: %', SQLERRM;
    END;

    -- Insertar notificación interna (campanita)
    BEGIN
      INSERT INTO notificaciones_internas (
        usuario_id,
        tipo,
        titulo,
        mensaje,
        url,
        leida,
        created_at
      )
      SELECT 
        NEW.id,
        'bienvenida',
        '¡Bienvenido a MOVI Digital!',
        'Tu cuenta ha sido activada exitosamente. Explora todas las funcionalidades de la plataforma.',
        '/dashboard',
        false,
        now()
      FROM correo_tipos_notificacion ctn
      WHERE ctn.codigo = 'bienvenida' AND ctn.activo = true AND ctn.enviar_notificacion = true;

      RAISE LOG '[send_welcome] Notificación interna creada';
    EXCEPTION WHEN OTHERS THEN
      RAISE LOG '[send_welcome] Error al crear notificación interna: %', SQLERRM;
    END;

    -- Insertar notificación de WhatsApp si tiene número disponible
    BEGIN
      IF (NEW.celular_personal IS NOT NULL AND NEW.celular_personal != '') 
         OR (NEW.celular_laboral IS NOT NULL AND NEW.celular_laboral != '') THEN
        
        INSERT INTO whatsapp_historial_envios (
          tipo_notificacion_id,
          numero_destinatario,
          mensaje,
          variables_usadas,
          estado,
          created_at
        )
        SELECT 
          ctn.id,
          COALESCE(NEW.celular_personal, NEW.celular_laboral),
          REPLACE(REPLACE(REPLACE(REPLACE(
            COALESCE(cwp.mensaje_whatsapp, 
              '¡Bienvenido {{nombre}} {{apellidos}} a MOVI Digital! 🎉\n\nTu cuenta ha sido activada exitosamente.\n\n📧 Usuario: {{email_laboral}}\n👤 Rol: {{rol}}\n\nIngresa a la plataforma para comenzar.'
            ),
            '{{nombre}}', NEW.nombre),
            '{{apellidos}}', NEW.apellidos),
            '{{email_laboral}}', NEW.email_laboral),
            '{{rol}}', NEW.rol
          ),
          jsonb_build_object(
            'nombre', NEW.nombre,
            'apellidos', NEW.apellidos,
            'email_laboral', NEW.email_laboral,
            'rol', NEW.rol,
            'puesto', COALESCE(NEW.puesto, ''),
            'nombre_plataforma', 'MOVI Digital',
            'fecha', to_char(now(), 'DD/MM/YYYY')
          ),
          'pendiente',
          now()
        FROM correo_tipos_notificacion ctn
        LEFT JOIN correo_whatsapp_plantillas cwp ON cwp.tipo_notificacion_id = ctn.id
        WHERE ctn.codigo = 'bienvenida' AND ctn.activo = true AND ctn.enviar_whatsapp = true;

        RAISE LOG '[send_welcome] WhatsApp de bienvenida encolado';
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE LOG '[send_welcome] Error al encolar WhatsApp: %', SQLERRM;
    END;

    RAISE LOG '[send_welcome] Notificaciones de bienvenida procesadas exitosamente';
  END IF;

  RETURN NEW;
END;
$$;

-- Eliminar trigger si existe
DROP TRIGGER IF EXISTS trigger_send_welcome_on_activation ON usuarios;

-- Crear trigger que se ejecuta DESPUÉS de actualizar un usuario
CREATE TRIGGER trigger_send_welcome_on_activation
  AFTER UPDATE ON usuarios
  FOR EACH ROW
  WHEN (NEW.estado = 'activo' AND (OLD.estado IS NULL OR OLD.estado != 'activo'))
  EXECUTE FUNCTION send_welcome_notifications_on_activation();

-- Comentarios
COMMENT ON FUNCTION send_welcome_notifications_on_activation() IS 
  'Envía notificaciones de bienvenida cuando un usuario es activado por primera vez';
COMMENT ON TRIGGER trigger_send_welcome_on_activation ON usuarios IS 
  'Trigger que envía notificaciones de bienvenida cuando el estado del usuario cambia a activo';
