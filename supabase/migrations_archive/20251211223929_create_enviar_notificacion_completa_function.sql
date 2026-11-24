/*
  # Crear función para enviar notificaciones por todos los canales configurados
  
  ## Descripción
  Crea una función RPC que consulta la configuración del tipo de notificación
  y envía por TODOS los canales habilitados (correo, WhatsApp, campanita).
  
  ## Cambios
  1. Nueva función: enviar_notificacion_completa
     - Inserta notificación interna (campanita)
     - Consulta tipo de notificación para ver canales activos
     - Envía por correo si está configurado
     - Envía por WhatsApp si está configurado
     - Usa pg_net para llamadas HTTP asíncronas
  
  ## Parámetros
  - p_tipo_codigo: Código del tipo de notificación (ej: 'nuevo_comunicado')
  - p_user_id: UUID del usuario destinatario
  - p_titulo: Título de la notificación
  - p_mensaje: Mensaje de la notificación
  - p_modulo: Módulo que genera la notificación
  - p_datos_adicionales: JSONB con datos adicionales para las plantillas
  - p_accion_url: URL opcional para acción
  
  ## Seguridad
  - SECURITY DEFINER para acceso a funciones HTTP
  - Validación de usuario existente
  - Manejo de errores sin bloquear transacción principal
*/

-- Crear función para enviar notificación completa (todos los canales)
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
    correo_electronico,
    correo_electronico_laboral
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
    enviar_por_correo,
    enviar_por_whatsapp
  INTO v_tipo_notif
  FROM correo_tipos_notificacion
  WHERE codigo = p_tipo_codigo;

  IF NOT FOUND THEN
    RAISE WARNING 'Tipo de notificación no encontrado: %', p_tipo_codigo;
    -- Continuar sin configuración específica
    v_tipo_notif.enviar_por_correo := false;
    v_tipo_notif.enviar_por_whatsapp := false;
  END IF;

  -- Insertar notificación interna (campanita)
  INSERT INTO notificaciones (
    usuario_id,
    titulo,
    mensaje,
    tipo,
    modulo,
    accion_url,
    leida,
    prioridad
  )
  VALUES (
    p_user_id,
    p_titulo,
    p_mensaje,
    'info',
    p_modulo,
    p_accion_url,
    false,
    'normal'
  )
  RETURNING id INTO v_notif_id;

  -- Preparar datos para las plantillas
  v_datos := p_datos_adicionales || jsonb_build_object(
    'nombre', v_user_record.nombre,
    'apellidos', v_user_record.apellidos,
    'nombre_completo', v_user_record.nombre_completo,
    'titulo', p_titulo,
    'mensaje', p_mensaje,
    'modulo', p_modulo
  );

  -- Enviar por CORREO si está configurado
  v_correo := COALESCE(NULLIF(v_user_record.correo_electronico, ''), NULLIF(v_user_record.correo_electronico_laboral, ''));
  
  IF v_tipo_notif.enviar_por_correo AND v_correo IS NOT NULL AND v_correo ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
    BEGIN
      -- Enviar correo transaccional usando pg_net
      SELECT INTO v_request_id extensions.http_post(
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
      
      RAISE NOTICE 'Correo enviado a % (request_id: %)', v_correo, v_request_id;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Error enviando correo a %: %', v_correo, SQLERRM;
    END;
  END IF;

  -- Enviar por WHATSAPP si está configurado
  v_telefono := COALESCE(NULLIF(v_user_record.celular_laboral, ''), NULLIF(v_user_record.celular_personal, ''));
  
  IF v_tipo_notif.enviar_por_whatsapp AND v_telefono IS NOT NULL AND LENGTH(v_telefono) >= 10 THEN
    BEGIN
      -- Enviar WhatsApp usando pg_net
      SELECT INTO v_request_id extensions.http_post(
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
      
      RAISE NOTICE 'WhatsApp enviado a % (request_id: %)', v_telefono, v_request_id;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Error enviando WhatsApp a %: %', v_telefono, SQLERRM;
    END;
  END IF;

  RETURN v_notif_id;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION enviar_notificacion_completa(text, uuid, text, text, text, jsonb, text) TO authenticated;
GRANT EXECUTE ON FUNCTION enviar_notificacion_completa(text, uuid, text, text, text, jsonb, text) TO service_role;

-- Comentarios
COMMENT ON FUNCTION enviar_notificacion_completa IS 'Envía notificación por TODOS los canales configurados (correo, WhatsApp, campanita) según el tipo de notificación';
