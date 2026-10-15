/*
  # Fix notify() function - Correct column names

  ## Cambios
  - Actualiza la función notify() para usar los nombres correctos de columnas de la tabla usuarios:
    - correo_electronico_laboral → email_laboral
    - correo_electronico → email_personal
  
  ## Detalles
  La función estaba fallando porque intentaba acceder a columnas que no existen en la tabla usuarios.
*/

CREATE OR REPLACE FUNCTION notify(
  p_event_code text,
  p_user_ids uuid[],
  p_payload jsonb DEFAULT '{}'::jsonb,
  p_entity_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event record;
  v_user_id uuid;
  v_user record;
  v_idempotency_key text;
  v_job_id uuid;
  v_jobs_created integer := 0;
  v_jobs_skipped integer := 0;
  v_users_processed integer := 0;
  v_email text;
  v_phone text;
  v_result jsonb;
BEGIN
  -- Validar que hay usuarios
  IF p_user_ids IS NULL OR array_length(p_user_ids, 1) IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'No users provided',
      'jobs_created', 0
    );
  END IF;

  -- Obtener configuración del evento
  SELECT * INTO v_event
  FROM notification_events_catalog
  WHERE event_code = p_event_code AND active = true;

  IF NOT FOUND THEN
    RAISE WARNING 'Evento no encontrado o inactivo: %', p_event_code;
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Event not found or inactive: ' || p_event_code,
      'jobs_created', 0
    );
  END IF;

  -- Procesar cada usuario
  FOREACH v_user_id IN ARRAY p_user_ids
  LOOP
    -- Obtener datos del usuario con nombres correctos de columnas
    SELECT
      id, nombre, apellidos, nombre_completo,
      email_laboral, email_personal,
      celular_laboral, celular_personal,
      estado
    INTO v_user
    FROM usuarios
    WHERE id = v_user_id;

    IF NOT FOUND THEN
      CONTINUE;
    END IF;

    IF v_user.estado != 'activo' THEN
      CONTINUE;
    END IF;

    v_users_processed := v_users_processed + 1;

    -- ==========================================
    -- Canal: In-App (Campanita)
    -- ==========================================
    IF v_event.enable_in_app THEN
      v_idempotency_key := p_event_code || '_' || v_user_id::text || '_in_app';
      
      IF p_entity_id IS NOT NULL THEN
        v_idempotency_key := v_idempotency_key || '_' || p_entity_id;
      ELSE
        v_idempotency_key := v_idempotency_key || '_' || md5(p_payload::text);
      END IF;

      BEGIN
        INSERT INTO notification_jobs (
          event_code, user_id, channel, status, payload, idempotency_key
        )
        VALUES (
          p_event_code, v_user_id, 'in_app', 'pending', p_payload, v_idempotency_key
        );
        
        v_jobs_created := v_jobs_created + 1;
      EXCEPTION WHEN unique_violation THEN
        v_jobs_skipped := v_jobs_skipped + 1;
      END;
    END IF;

    -- ==========================================
    -- Canal: Email
    -- ==========================================
    IF v_event.enable_email THEN
      v_email := COALESCE(
        NULLIF(trim(v_user.email_laboral), ''),
        NULLIF(trim(v_user.email_personal), '')
      );

      IF v_email IS NOT NULL AND v_email ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
        v_idempotency_key := p_event_code || '_' || v_user_id::text || '_email';
        
        IF p_entity_id IS NOT NULL THEN
          v_idempotency_key := v_idempotency_key || '_' || p_entity_id;
        ELSE
          v_idempotency_key := v_idempotency_key || '_' || md5(p_payload::text);
        END IF;

        BEGIN
          INSERT INTO notification_jobs (
            event_code, user_id, channel, status, payload, idempotency_key
          )
          VALUES (
            p_event_code, v_user_id, 'email', 'pending', p_payload, v_idempotency_key
          );
          
          v_jobs_created := v_jobs_created + 1;
        EXCEPTION WHEN unique_violation THEN
          v_jobs_skipped := v_jobs_skipped + 1;
        END;
      END IF;
    END IF;

    -- ==========================================
    -- Canal: WhatsApp
    -- ==========================================
    IF v_event.enable_whatsapp THEN
      v_phone := COALESCE(
        normalize_phone_mx(v_user.celular_laboral),
        normalize_phone_mx(v_user.celular_personal)
      );

      IF v_phone IS NOT NULL THEN
        v_idempotency_key := p_event_code || '_' || v_user_id::text || '_whatsapp';
        
        IF p_entity_id IS NOT NULL THEN
          v_idempotency_key := v_idempotency_key || '_' || p_entity_id;
        ELSE
          v_idempotency_key := v_idempotency_key || '_' || md5(p_payload::text);
        END IF;

        BEGIN
          INSERT INTO notification_jobs (
            event_code, user_id, channel, status, payload, idempotency_key
          )
          VALUES (
            p_event_code, v_user_id, 'whatsapp', 'pending', p_payload, v_idempotency_key
          );
          
          v_jobs_created := v_jobs_created + 1;
        EXCEPTION WHEN unique_violation THEN
          v_jobs_skipped := v_jobs_skipped + 1;
        END;
      END IF;
    END IF;
  END LOOP;

  -- Retornar estadísticas
  v_result := jsonb_build_object(
    'success', true,
    'event_code', p_event_code,
    'users_provided', array_length(p_user_ids, 1),
    'users_processed', v_users_processed,
    'jobs_created', v_jobs_created,
    'jobs_skipped', v_jobs_skipped
  );

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION notify IS 'Motor central de notificaciones - crea jobs para todos los canales habilitados (FIXED: column names)';
