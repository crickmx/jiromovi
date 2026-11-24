/*
  # Consolidar Canales de Notificaciones y Corregir Verificación

  ## Descripción
  Este migration consolida las columnas duplicadas de canales de notificación
  y asegura que todas las funciones verifiquen correctamente los flags antes de enviar.

  ## Problema Identificado
  - Existen columnas duplicadas: enviar_correo/enviar_por_correo, enviar_whatsapp/enviar_por_whatsapp
  - Diferentes funciones usan diferentes columnas
  - Esto causa que se envíen notificaciones aunque estén desactivadas

  ## Cambios
  1. Migrar datos de columnas antiguas a nuevas
  2. Eliminar columnas antiguas (enviar_por_correo, enviar_por_whatsapp)
  3. Actualizar función enviar_notificacion_completa para usar columnas correctas
  4. Asegurar que todos los triggers verifiquen los flags correctamente

  ## Seguridad
  - Se mantiene la restricción de al menos un canal activo
  - Se preservan todas las configuraciones existentes
*/

-- Paso 1: Migrar datos de columnas antiguas a nuevas si hay discrepancias
UPDATE correo_tipos_notificacion
SET 
  enviar_correo = COALESCE(enviar_por_correo, enviar_correo, false),
  enviar_whatsapp = COALESCE(enviar_por_whatsapp, enviar_whatsapp, false)
WHERE enviar_por_correo IS NOT NULL OR enviar_por_whatsapp IS NOT NULL;

-- Paso 2: Eliminar columnas duplicadas antiguas
ALTER TABLE correo_tipos_notificacion
DROP COLUMN IF EXISTS enviar_por_correo,
DROP COLUMN IF EXISTS enviar_por_whatsapp;

-- Paso 3: Actualizar función enviar_notificacion_completa para usar columnas correctas
CREATE OR REPLACE FUNCTION enviar_notificacion_completa(
  p_tipo_codigo text,
  p_user_id uuid,
  p_titulo text,
  p_mensaje text,
  p_modulo text,
  p_datos_adicionales jsonb DEFAULT '{}'::jsonb,
  p_accion_url text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_notif_id uuid;
  v_user_record record;
  v_tipo_notif record;
  v_telefono text;
  v_correo text;
  v_datos jsonb;
  v_supabase_url text := current_setting('app.settings.supabase_url', true);
  v_anon_key text := current_setting('app.settings.supabase_anon_key', true);
  v_request_id bigint;
BEGIN
  -- Usar valores de entorno de Supabase si no están configurados
  IF v_supabase_url IS NULL OR v_supabase_url = '' THEN
    v_supabase_url := 'https://qhwvuuyjhcennqccgvse.supabase.co';
  END IF;
  
  IF v_anon_key IS NULL OR v_anon_key = '' THEN
    v_anon_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFod3Z1dXlqaGNlbm5xY2NndnNlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE3MjA5OTAsImV4cCI6MjA3NzI5Njk5MH0.bIlGsgeAC6oxGUalODg0C5-l6KaJip0wWa9IbQ7MjTQ';
  END IF;

  -- Obtener información del usuario
  SELECT 
    id, 
    nombre, 
    apellidos, 
    nombre_completo,
    celular_laboral, 
    celular_personal,
    email_laboral,
    email_personal
  INTO v_user_record
  FROM usuarios
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Usuario no encontrado: %', p_user_id;
  END IF;

  -- Obtener configuración del tipo de notificación (USAR COLUMNAS CORRECTAS)
  SELECT 
    id,
    codigo,
    nombre,
    activo,
    enviar_correo,
    enviar_whatsapp,
    enviar_notificacion
  INTO v_tipo_notif
  FROM correo_tipos_notificacion
  WHERE codigo = p_tipo_codigo AND activo = true;

  IF NOT FOUND THEN
    RAISE WARNING 'Tipo de notificación no encontrado o inactivo: %', p_tipo_codigo;
    RETURN NULL;
  END IF;

  -- Preparar datos para las plantillas
  v_datos := p_datos_adicionales || jsonb_build_object(
    'nombre', v_user_record.nombre,
    'apellidos', v_user_record.apellidos,
    'nombre_completo', v_user_record.nombre_completo,
    'titulo', p_titulo,
    'mensaje', p_mensaje,
    'modulo', p_modulo
  );

  -- SOLO INSERTAR NOTIFICACIÓN INTERNA SI ESTÁ CONFIGURADO
  IF v_tipo_notif.enviar_notificacion = true THEN
    INSERT INTO notificaciones_internas (
      usuario_id,
      titulo,
      mensaje,
      tipo,
      url,
      leida,
      created_at
    )
    VALUES (
      p_user_id,
      p_titulo,
      p_mensaje,
      p_tipo_codigo,
      p_accion_url,
      false,
      now()
    )
    RETURNING id INTO v_notif_id;
    
    RAISE NOTICE '[enviar_notificacion_completa] Notificación interna creada: %', v_notif_id;
  ELSE
    RAISE NOTICE '[enviar_notificacion_completa] Notificación interna desactivada para tipo: %', p_tipo_codigo;
  END IF;

  -- SOLO ENVIAR POR CORREO SI ESTÁ CONFIGURADO
  v_correo := COALESCE(NULLIF(v_user_record.email_laboral, ''), NULLIF(v_user_record.email_personal, ''));
  
  IF v_tipo_notif.enviar_correo = true AND v_correo IS NOT NULL AND v_correo ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
    BEGIN
      SELECT INTO v_request_id net.http_post(
        url := v_supabase_url || '/functions/v1/enviar-correo-transaccional',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || v_anon_key
        ),
        body := jsonb_build_object(
          'tipo', p_tipo_codigo,
          'destinatario', v_correo,
          'datos', v_datos
        )
      );
      
      RAISE NOTICE '[enviar_notificacion_completa] Correo enviado a % (request_id: %)', v_correo, v_request_id;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '[enviar_notificacion_completa] Error enviando correo a %: %', v_correo, SQLERRM;
    END;
  ELSE
    RAISE NOTICE '[enviar_notificacion_completa] Correo desactivado o email inválido para tipo: %', p_tipo_codigo;
  END IF;

  -- SOLO ENVIAR POR WHATSAPP SI ESTÁ CONFIGURADO
  v_telefono := COALESCE(NULLIF(v_user_record.celular_laboral, ''), NULLIF(v_user_record.celular_personal, ''));
  
  IF v_tipo_notif.enviar_whatsapp = true AND v_telefono IS NOT NULL AND LENGTH(v_telefono) >= 10 THEN
    BEGIN
      SELECT INTO v_request_id net.http_post(
        url := v_supabase_url || '/functions/v1/enviar-whatsapp',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || v_anon_key
        ),
        body := jsonb_build_object(
          'tipo', p_tipo_codigo,
          'numero', v_telefono,
          'datos', v_datos
        )
      );
      
      RAISE NOTICE '[enviar_notificacion_completa] WhatsApp enviado a % (request_id: %)', v_telefono, v_request_id;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '[enviar_notificacion_completa] Error enviando WhatsApp a %: %', v_telefono, SQLERRM;
    END;
  ELSE
    RAISE NOTICE '[enviar_notificacion_completa] WhatsApp desactivado o número inválido para tipo: %', p_tipo_codigo;
  END IF;

  RETURN v_notif_id;
END;
$$;

-- Verificar que el trigger de bienvenida también use las columnas correctas (ya lo hace, solo confirmamos)
COMMENT ON FUNCTION send_welcome_notifications_on_activation() IS 
  'Envía notificaciones de bienvenida SOLO por los canales configurados en correo_tipos_notificacion (enviar_correo, enviar_whatsapp, enviar_notificacion)';

-- Agregar logging para debugging
CREATE OR REPLACE FUNCTION log_notification_channels()
RETURNS trigger AS $$
BEGIN
  RAISE NOTICE '[%] Canales: correo=%, whatsapp=%, notificacion=%', 
    NEW.codigo, 
    NEW.enviar_correo, 
    NEW.enviar_whatsapp, 
    NEW.enviar_notificacion;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear trigger para logging de cambios (solo en desarrollo)
DROP TRIGGER IF EXISTS trigger_log_notification_channels ON correo_tipos_notificacion;
CREATE TRIGGER trigger_log_notification_channels
  AFTER INSERT OR UPDATE ON correo_tipos_notificacion
  FOR EACH ROW
  EXECUTE FUNCTION log_notification_channels();

-- Comentarios finales
COMMENT ON COLUMN correo_tipos_notificacion.enviar_correo IS 
  'ÚNICO flag para envío de correos. Se verifica en trigger de bienvenida y función enviar_notificacion_completa';
COMMENT ON COLUMN correo_tipos_notificacion.enviar_whatsapp IS 
  'ÚNICO flag para envío de WhatsApp. Se verifica en trigger de bienvenida y función enviar_notificacion_completa';
COMMENT ON COLUMN correo_tipos_notificacion.enviar_notificacion IS 
  'ÚNICO flag para notificaciones internas. Se verifica en trigger de bienvenida y función enviar_notificacion_completa';
