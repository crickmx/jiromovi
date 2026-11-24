/*
  # Crear función para notificaciones individuales con WhatsApp
  
  ## Descripción
  Crea una función RPC que envía notificaciones individuales (campanita)
  y automáticamente envía la misma notificación por WhatsApp al teléfono
  laboral del usuario.
  
  ## Cambios
  1. Nueva función: enviar_notificacion_individual
     - Inserta notificación en la tabla notificaciones
     - Envía WhatsApp automáticamente al celular_laboral (prioritario)
     - Fallback a celular_personal si no hay celular_laboral
     - Usa pg_net para llamadas HTTP asíncronas
  
  ## Parámetros
  - p_user_id: UUID del usuario destinatario
  - p_titulo: Título de la notificación
  - p_mensaje: Mensaje de la notificación
  - p_modulo: Módulo que genera la notificación
  - p_accion_url: URL opcional para acción
  - p_enviar_whatsapp: Boolean (default true) para enviar WhatsApp
  
  ## Seguridad
  - SECURITY DEFINER para acceso a funciones HTTP
  - Validación de usuario existente
  - Manejo de errores sin bloquear transacción principal
*/

-- Crear función para enviar notificación individual con WhatsApp
CREATE OR REPLACE FUNCTION enviar_notificacion_individual(
  p_user_id uuid,
  p_titulo text,
  p_mensaje text,
  p_modulo text,
  p_accion_url text DEFAULT NULL,
  p_enviar_whatsapp boolean DEFAULT true
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_notif_id uuid;
  v_user_record record;
  v_telefono text;
  v_supabase_url text := 'https://qhwvuuyjhcennqccgvse.supabase.co';
  v_anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFod3Z1dXlqaGNlbm5xY2NndnNlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE3MjA5OTAsImV4cCI6MjA3NzI5Njk5MH0.bIlGsgeAC6oxGUalODg0C5-l6KaJip0wWa9IbQ7MjTQ';
  v_request_id bigint;
BEGIN
  -- Obtener información del usuario
  SELECT id, nombre, apellidos, celular_laboral, celular_personal
  INTO v_user_record
  FROM usuarios
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Usuario no encontrado: %', p_user_id;
  END IF;

  -- Insertar notificación (campanita)
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

  -- Enviar WhatsApp si está habilitado
  -- PRIORIZAR celular_laboral, si no existe usar celular_personal
  v_telefono := COALESCE(NULLIF(v_user_record.celular_laboral, ''), NULLIF(v_user_record.celular_personal, ''));

  IF p_enviar_whatsapp AND v_telefono IS NOT NULL AND LENGTH(v_telefono) >= 10 THEN
    BEGIN
      -- Enviar WhatsApp usando pg_net (asíncrono, no bloquea)
      SELECT INTO v_request_id extensions.http_post(
        url := v_supabase_url || '/functions/v1/enviar-whatsapp',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || v_anon_key
        ),
        body := jsonb_build_object(
          'tipo', 'notificacion_individual',
          'numero', v_telefono,
          'datos', jsonb_build_object(
            'nombre', v_user_record.nombre,
            'apellidos', v_user_record.apellidos,
            'titulo', p_titulo,
            'mensaje', p_mensaje,
            'modulo', p_modulo
          )
        )
      );
      
      RAISE NOTICE 'WhatsApp enviado a % (request_id: %)', v_telefono, v_request_id;
    EXCEPTION WHEN OTHERS THEN
      -- No fallar la transacción si WhatsApp falla
      RAISE WARNING 'Error enviando WhatsApp a %: %', v_telefono, SQLERRM;
    END;
  END IF;

  RETURN v_notif_id;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION enviar_notificacion_individual(uuid, text, text, text, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION enviar_notificacion_individual(uuid, text, text, text, text, boolean) TO service_role;

-- Comentarios
COMMENT ON FUNCTION enviar_notificacion_individual IS 'Envía notificación individual (campanita) y WhatsApp automáticamente al teléfono laboral del usuario';
