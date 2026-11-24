/*
  # Arreglar constraint de tipo en notificaciones
  
  1. Problema
    - La tabla notificaciones tiene constraint que solo permite: info, exito, advertencia, error
    - La función enviar_notificacion_completa intenta insertar códigos como 'bienvenida', 'cuenta_activada', etc
    
  2. Solución
    - Eliminar el constraint restrictivo del campo tipo
    - Agregar campo tipo_codigo para almacenar el código real
    - Actualizar la función para usar el campo correcto
*/

-- Eliminar el constraint restrictivo
ALTER TABLE notificaciones DROP CONSTRAINT IF EXISTS notificaciones_tipo_check;

-- Agregar campo tipo_codigo si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'notificaciones' AND column_name = 'tipo_codigo'
  ) THEN
    ALTER TABLE notificaciones ADD COLUMN tipo_codigo text;
  END IF;
END $$;

-- Actualizar función para usar tipo_codigo
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
  IF v_supabase_url IS NULL OR v_supabase_url = '' THEN
    v_supabase_url := 'https://qhwvuuyjhcennqccgvse.supabase.co';
  END IF;
  
  IF v_anon_key IS NULL OR v_anon_key = '' THEN
    v_anon_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFod3Z1dXlqaGNlbm5xY2NndnNlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE3MjA5OTAsImV4cCI6MjA3NzI5Njk5MH0.bIlGsgeAC6oxGUalODg0C5-l6KaJip0wWa9IbQ7MjTQ';
  END IF;

  -- Obtener datos del usuario usando email_laboral como fuente de verdad
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

  -- Obtener configuración del tipo de notificación
  SELECT 
    id,
    codigo,
    nombre,
    activo,
    enviar_correo as enviar_por_correo,
    enviar_whatsapp as enviar_por_whatsapp
  INTO v_tipo_notif
  FROM correo_tipos_notificacion
  WHERE codigo = p_tipo_codigo;

  IF NOT FOUND THEN
    RAISE WARNING 'Tipo de notificación no encontrado: %', p_tipo_codigo;
    RETURN NULL;
  END IF;

  IF v_tipo_notif.activo = false THEN
    RAISE WARNING 'Tipo de notificación inactivo: %', p_tipo_codigo;
    RETURN NULL;
  END IF;

  -- Insertar notificación usando tipo genérico 'info' y tipo_codigo específico
  INSERT INTO notificaciones (
    usuario_id,
    titulo,
    mensaje,
    tipo,
    tipo_codigo,
    modulo,
    accion_url,
    leida,
    prioridad
  )
  VALUES (
    p_user_id,
    p_titulo,
    p_mensaje,
    'info', -- tipo genérico
    p_tipo_codigo, -- código específico
    p_modulo,
    p_accion_url,
    false,
    'normal'
  )
  RETURNING id INTO v_notif_id;

  -- Preparar datos para envío
  v_telefono := COALESCE(v_user_record.celular_laboral, v_user_record.celular_personal);
  v_correo := v_user_record.email_laboral;

  IF v_correo IS NULL OR v_correo = '' THEN
    RAISE WARNING 'Usuario % no tiene email_laboral', p_user_id;
    RETURN v_notif_id;
  END IF;

  v_datos := p_datos_adicionales || jsonb_build_object(
    'nombre', COALESCE(v_user_record.nombre_completo, v_user_record.nombre, 'Usuario'),
    'email_laboral', v_correo,
    'telefono_movil', COALESCE(v_telefono, ''),
    'nombre_plataforma', 'MOVI Digital',
    'fecha', to_char(CURRENT_DATE, 'DD/MM/YYYY')
  );

  RAISE LOG '[notif] Enviando notificación tipo % a %', p_tipo_codigo, v_correo;

  -- Enviar correo si está habilitado
  IF v_tipo_notif.enviar_por_correo THEN
    BEGIN
      SELECT net.http_post(
        url := v_supabase_url || '/functions/v1/notification-dispatcher',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || v_anon_key
        ),
        body := jsonb_build_object(
          'canal', 'correo',
          'tipo_codigo', p_tipo_codigo,
          'destinatario_email', v_correo,
          'destinatario_nombre', v_user_record.nombre_completo,
          'datos', v_datos
        ),
        timeout_milliseconds := 5000
      ) INTO v_request_id;
      
      RAISE LOG '[notif] Correo enviado vía notification-dispatcher';
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '[notif] Error al enviar correo: %', SQLERRM;
    END;
  END IF;

  -- Enviar WhatsApp si está habilitado y hay teléfono
  IF v_tipo_notif.enviar_por_whatsapp AND v_telefono IS NOT NULL AND v_telefono != '' THEN
    BEGIN
      SELECT net.http_post(
        url := v_supabase_url || '/functions/v1/notification-dispatcher',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || v_anon_key
        ),
        body := jsonb_build_object(
          'canal', 'whatsapp',
          'tipo_codigo', p_tipo_codigo,
          'destinatario_telefono', v_telefono,
          'destinatario_nombre', v_user_record.nombre_completo,
          'datos', v_datos
        ),
        timeout_milliseconds := 5000
      ) INTO v_request_id;
      
      RAISE LOG '[notif] WhatsApp enviado vía notification-dispatcher';
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '[notif] Error al enviar WhatsApp: %', SQLERRM;
    END;
  END IF;

  RETURN v_notif_id;
END;
$$;

COMMENT ON FUNCTION enviar_notificacion_completa IS
  'Envía notificación completa usando el sistema de notificaciones transaccionales';
