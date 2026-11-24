/*
  # Fix: email_laboral como Fuente de Verdad para TODAS las Comunicaciones

  1. Problema Identificado
    - función enviar_notificacion_completa usa campos inexistentes
    - auth.users.email puede estar desincronizado con email_laboral
    - Password reset enviaba al email de auth en lugar de email_laboral

  2. Solución
    - Arreglar enviar_notificacion_completa para usar email_laboral
    - Crear función para sincronizar auth.email con email_laboral
    - Actualizar triggers para mantener sincronización
    - email_laboral es LA FUENTE DE VERDAD
*/

-- ============================================================================
-- 1. ARREGLAR función enviar_notificacion_completa
-- ============================================================================

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

  -- ✅ USAR email_laboral como fuente de verdad
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
    p_tipo_codigo,
    p_modulo,
    p_accion_url,
    false,
    'normal'
  )
  RETURNING id INTO v_notif_id;

  v_telefono := COALESCE(v_user_record.celular_laboral, v_user_record.celular_personal);
  
  -- ✅ SIEMPRE usar email_laboral
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

  RAISE LOG '[notif] Enviando a email_laboral: %', v_correo;

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

      RAISE LOG '[notif] Correo programado (req: %)', v_request_id;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '[notif] Error programando correo: %', SQLERRM;
    END;
  END IF;

  IF v_tipo_notif.enviar_por_whatsapp AND v_telefono IS NOT NULL THEN
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

      RAISE LOG '[notif] WhatsApp programado (req: %)', v_request_id;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '[notif] Error programando WhatsApp: %', SQLERRM;
    END;
  END IF;

  RETURN v_notif_id;
END;
$$;

-- ============================================================================
-- 2. SINCRONIZAR auth.email con email_laboral (trigger)
-- ============================================================================

CREATE OR REPLACE FUNCTION sync_auth_email_from_email_laboral()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_auth_email text;
BEGIN
  IF NEW.email_laboral IS NOT NULL 
     AND NEW.email_laboral != '' 
     AND (OLD IS NULL OR OLD.email_laboral IS NULL OR OLD.email_laboral != NEW.email_laboral) THEN
    
    SELECT email::text INTO v_auth_email
    FROM auth.users
    WHERE id = NEW.id;

    IF v_auth_email IS NOT NULL AND v_auth_email != NEW.email_laboral THEN
      RAISE LOG '[sync_email] % -> %', v_auth_email, NEW.email_laboral;
      
      UPDATE auth.users
      SET 
        email = NEW.email_laboral,
        email_confirmed_at = CASE 
          WHEN email_confirmed_at IS NULL THEN NULL 
          ELSE NOW() 
        END,
        updated_at = NOW()
      WHERE id = NEW.id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_sync_auth_email ON usuarios;

CREATE TRIGGER trigger_sync_auth_email
  AFTER INSERT OR UPDATE OF email_laboral ON usuarios
  FOR EACH ROW
  EXECUTE FUNCTION sync_auth_email_from_email_laboral();

-- ============================================================================
-- 3. SINCRONIZAR usuarios existentes
-- ============================================================================

DO $$
DECLARE
  v_record record;
  v_count integer := 0;
BEGIN
  FOR v_record IN
    SELECT 
      u.id,
      u.email_laboral,
      au.email::text as auth_email
    FROM usuarios u
    JOIN auth.users au ON au.id = u.id
    WHERE u.email_laboral IS NOT NULL
      AND u.email_laboral != ''
      AND u.email_laboral != au.email
      AND u.estado = 'activo'
  LOOP
    BEGIN
      UPDATE auth.users
      SET 
        email = v_record.email_laboral,
        updated_at = NOW()
      WHERE id = v_record.id;

      v_count := v_count + 1;
      RAISE LOG '[sync] % : % -> %', v_record.id, v_record.auth_email, v_record.email_laboral;
      
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '[sync] Error en %: %', v_record.id, SQLERRM;
    END;
  END LOOP;

  RAISE NOTICE 'Sincronizados % usuarios', v_count;
END;
$$;

COMMENT ON FUNCTION enviar_notificacion_completa IS
  'SIEMPRE usa email_laboral como fuente de verdad para correos.';

COMMENT ON FUNCTION sync_auth_email_from_email_laboral IS
  'Sincroniza auth.email cuando email_laboral cambia. email_laboral es la fuente de verdad.';
