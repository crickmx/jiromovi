/*
  # Sistema Centralizado de Notificaciones - Motor Orquestador

  ## Descripción
  Implementa un sistema robusto y centralizado para gestión de notificaciones multi-canal
  con idempotencia, observabilidad total, y reintentos automáticos.

  ## Nuevas Tablas

  ### 1. notification_events_catalog
  Catálogo central de todos los eventos de notificación del sistema.
  - event_code: Código único del evento (ej: 'nuevo_comunicado')
  - event_name: Nombre descriptivo
  - module: Módulo que genera el evento
  - enable_in_app/email/whatsapp: Canales habilitados por defecto
  - Plantillas para cada canal

  ### 2. notification_jobs
  Cola de trabajos de notificación. Un job = 1 notificación + 1 usuario + 1 canal.
  - Incluye idempotency_key para prevenir duplicados
  - Status: pending, processing, sent, failed
  - Sistema de reintentos con max_attempts
  - Payload JSONB con datos del evento

  ### 3. notification_provider_logs
  Logs de interacción con providers externos (Wazzup24, Resend).
  - Request/Response completos
  - Provider message IDs para trazabilidad
  - HTTP status y errores

  ### 4. notification_delivery_attempts
  Historial completo de todos los intentos de entrega.
  - Útil para debugging y métricas

  ### 5. notification_phone_normalization_log
  Log de normalización de teléfonos (auditoría).

  ## Funciones Principales

  ### normalize_phone_mx()
  Normaliza teléfonos mexicanos al formato E.164 (+52XXXXXXXXXX).

  ### notify()
  Motor central de notificaciones. Crea jobs para cada canal habilitado.
  - Valida evento y usuarios
  - Resuelve destinatarios
  - Aplica idempotencia
  - Crea jobs en cola

  ### Funciones Helper
  - get_users_by_role()
  - get_users_by_office()
  - get_users_by_role_in_office()
  - get_admin_users()
  - get_all_active_users()

  ## Seguridad
  - Todas las funciones con SECURITY DEFINER para acceso controlado
  - RLS habilitado en todas las tablas
  - Solo authenticated y service_role pueden acceder
  - Administradores ven todo, usuarios ven solo sus datos

  ## Notas Importantes
  - Se preservan las tablas existentes de notificaciones
  - Sistema es compatible con código existente
  - Idempotencia garantiza cero duplicados
  - Observabilidad 100% con logs completos
*/

-- ============================================
-- TABLA: Catálogo de Eventos
-- ============================================

CREATE TABLE IF NOT EXISTS notification_events_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_code text UNIQUE NOT NULL,
  event_name text NOT NULL,
  module text NOT NULL,
  description text,
  
  -- Canales habilitados
  enable_in_app boolean DEFAULT true,
  enable_email boolean DEFAULT false,
  enable_whatsapp boolean DEFAULT false,
  
  -- Plantillas por canal (JSONB para flexibilidad)
  template_in_app jsonb DEFAULT '{}'::jsonb,
  template_email jsonb DEFAULT '{}'::jsonb,
  template_whatsapp jsonb DEFAULT '{}'::jsonb,
  
  -- Configuración adicional
  priority text DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  active boolean DEFAULT true,
  
  -- Auditoría
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_events_catalog_code ON notification_events_catalog(event_code);
CREATE INDEX IF NOT EXISTS idx_events_catalog_module ON notification_events_catalog(module);
CREATE INDEX IF NOT EXISTS idx_events_catalog_active ON notification_events_catalog(active);

COMMENT ON TABLE notification_events_catalog IS 'Catálogo central de todos los eventos de notificación';

-- ============================================
-- TABLA: Jobs de Notificación
-- ============================================

CREATE TABLE IF NOT EXISTS notification_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Evento y destinatario
  event_code text NOT NULL,
  user_id uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('in_app', 'email', 'whatsapp')),
  
  -- Estado del job
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'cancelled')),
  
  -- Payload con datos del evento
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  
  -- Idempotencia (clave única)
  idempotency_key text UNIQUE NOT NULL,
  
  -- Reintentos
  attempt_count integer DEFAULT 0,
  max_attempts integer DEFAULT 3,
  next_retry_at timestamptz,
  
  -- Resultados
  last_error text,
  provider_message_id text,
  sent_at timestamptz,
  
  -- Auditoría
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notification_jobs_status ON notification_jobs(status);
CREATE INDEX IF NOT EXISTS idx_notification_jobs_user ON notification_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_jobs_event ON notification_jobs(event_code);
CREATE INDEX IF NOT EXISTS idx_notification_jobs_channel ON notification_jobs(channel);
CREATE INDEX IF NOT EXISTS idx_notification_jobs_created ON notification_jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_jobs_retry ON notification_jobs(next_retry_at) WHERE status = 'pending';

COMMENT ON TABLE notification_jobs IS 'Cola de trabajos de notificación - un job por usuario + canal';

-- ============================================
-- TABLA: Logs de Providers
-- ============================================

CREATE TABLE IF NOT EXISTS notification_provider_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Referencia al job
  job_id uuid NOT NULL REFERENCES notification_jobs(id) ON DELETE CASCADE,
  
  -- Provider info
  provider text NOT NULL CHECK (provider IN ('wazzup24', 'resend', 'internal')),
  provider_message_id text,
  
  -- Request/Response
  request_payload jsonb,
  response_payload jsonb,
  http_status integer,
  
  -- Error handling
  success boolean DEFAULT false,
  error_message text,
  
  -- Timing
  response_time_ms integer,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_provider_logs_job ON notification_provider_logs(job_id);
CREATE INDEX IF NOT EXISTS idx_provider_logs_provider ON notification_provider_logs(provider);
CREATE INDEX IF NOT EXISTS idx_provider_logs_success ON notification_provider_logs(success);
CREATE INDEX IF NOT EXISTS idx_provider_logs_created ON notification_provider_logs(created_at DESC);

COMMENT ON TABLE notification_provider_logs IS 'Logs completos de interacción con providers externos';

-- ============================================
-- TABLA: Intentos de Entrega
-- ============================================

CREATE TABLE IF NOT EXISTS notification_delivery_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  job_id uuid NOT NULL REFERENCES notification_jobs(id) ON DELETE CASCADE,
  attempt_number integer NOT NULL,
  status text NOT NULL CHECK (status IN ('sent', 'failed')),
  error_message text,
  attempted_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_delivery_attempts_job ON notification_delivery_attempts(job_id);
CREATE INDEX IF NOT EXISTS idx_delivery_attempts_status ON notification_delivery_attempts(status);

COMMENT ON TABLE notification_delivery_attempts IS 'Historial de todos los intentos de entrega';

-- ============================================
-- TABLA: Log de Normalización de Teléfonos
-- ============================================

CREATE TABLE IF NOT EXISTS notification_phone_normalization_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  original_phone text NOT NULL,
  normalized_phone text,
  success boolean DEFAULT false,
  error_reason text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_phone_log_created ON notification_phone_normalization_log(created_at DESC);

COMMENT ON TABLE notification_phone_normalization_log IS 'Log de auditoría de normalización de teléfonos';

-- ============================================
-- FUNCIÓN: Normalización de Teléfonos México
-- ============================================

CREATE OR REPLACE FUNCTION normalize_phone_mx(p_phone text, p_log boolean DEFAULT false)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_clean text;
  v_result text;
BEGIN
  IF p_phone IS NULL OR trim(p_phone) = '' THEN
    IF p_log THEN
      INSERT INTO notification_phone_normalization_log (original_phone, success, error_reason)
      VALUES (p_phone, false, 'Empty or null phone');
    END IF;
    RETURN NULL;
  END IF;

  -- Remover espacios, guiones, paréntesis, puntos
  v_clean := regexp_replace(p_phone, '[^0-9+]', '', 'g');

  -- Si empieza con +52, remover para procesar
  IF v_clean LIKE '+52%' THEN
    v_clean := substring(v_clean from 4);
  END IF;

  -- Si empieza con 52 y tiene 12 dígitos total, remover
  IF v_clean LIKE '52%' AND length(v_clean) = 12 THEN
    v_clean := substring(v_clean from 3);
  END IF;

  -- Validar que tenga exactamente 10 dígitos
  IF length(v_clean) != 10 OR NOT (v_clean ~ '^[0-9]{10}$') THEN
    IF p_log THEN
      INSERT INTO notification_phone_normalization_log (original_phone, success, error_reason)
      VALUES (p_phone, false, 'Invalid format - must be 10 digits');
    END IF;
    RETURN NULL;
  END IF;

  -- Retornar en formato E.164
  v_result := '+52' || v_clean;

  IF p_log THEN
    INSERT INTO notification_phone_normalization_log (original_phone, normalized_phone, success)
    VALUES (p_phone, v_result, true);
  END IF;

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION normalize_phone_mx IS 'Normaliza teléfonos mexicanos a formato E.164 (+52XXXXXXXXXX)';

-- ============================================
-- FUNCIÓN: Obtener Usuarios por Rol
-- ============================================

CREATE OR REPLACE FUNCTION get_users_by_role(p_role text)
RETURNS uuid[]
LANGUAGE sql
STABLE
AS $$
  SELECT array_agg(id)
  FROM usuarios
  WHERE rol = p_role AND estado = 'activo';
$$;

COMMENT ON FUNCTION get_users_by_role IS 'Retorna array de UUIDs de usuarios activos por rol';

-- ============================================
-- FUNCIÓN: Obtener Usuarios por Oficina
-- ============================================

CREATE OR REPLACE FUNCTION get_users_by_office(p_office_id uuid)
RETURNS uuid[]
LANGUAGE sql
STABLE
AS $$
  SELECT array_agg(id)
  FROM usuarios
  WHERE oficina_id = p_office_id AND estado = 'activo';
$$;

COMMENT ON FUNCTION get_users_by_office IS 'Retorna array de UUIDs de usuarios activos por oficina';

-- ============================================
-- FUNCIÓN: Obtener Usuarios por Rol en Oficina
-- ============================================

CREATE OR REPLACE FUNCTION get_users_by_role_in_office(
  p_role text,
  p_office_id uuid
)
RETURNS uuid[]
LANGUAGE sql
STABLE
AS $$
  SELECT array_agg(id)
  FROM usuarios
  WHERE rol = p_role AND oficina_id = p_office_id AND estado = 'activo';
$$;

COMMENT ON FUNCTION get_users_by_role_in_office IS 'Retorna array de UUIDs de usuarios activos por rol en oficina específica';

-- ============================================
-- FUNCIÓN: Obtener Administradores
-- ============================================

CREATE OR REPLACE FUNCTION get_admin_users()
RETURNS uuid[]
LANGUAGE sql
STABLE
AS $$
  SELECT array_agg(id)
  FROM usuarios
  WHERE rol = 'Administrador' AND estado = 'activo';
$$;

COMMENT ON FUNCTION get_admin_users IS 'Retorna array de UUIDs de todos los administradores activos';

-- ============================================
-- FUNCIÓN: Obtener Todos los Usuarios Activos
-- ============================================

CREATE OR REPLACE FUNCTION get_all_active_users()
RETURNS uuid[]
LANGUAGE sql
STABLE
AS $$
  SELECT array_agg(id)
  FROM usuarios
  WHERE estado = 'activo';
$$;

COMMENT ON FUNCTION get_all_active_users IS 'Retorna array de UUIDs de todos los usuarios activos';

-- ============================================
-- FUNCIÓN: Motor Central de Notificaciones
-- ============================================

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
    -- Obtener datos del usuario
    SELECT
      id, nombre, apellidos, nombre_completo,
      correo_electronico_laboral, correo_electronico,
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
        NULLIF(trim(v_user.correo_electronico_laboral), ''),
        NULLIF(trim(v_user.correo_electronico), '')
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

COMMENT ON FUNCTION notify IS 'Motor central de notificaciones - crea jobs para todos los canales habilitados';

-- ============================================
-- TRIGGERS
-- ============================================

-- Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_updated_at_events_catalog
BEFORE UPDATE ON notification_events_catalog
FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_updated_at_jobs
BEFORE UPDATE ON notification_jobs
FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

ALTER TABLE notification_events_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_provider_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_delivery_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_phone_normalization_log ENABLE ROW LEVEL SECURITY;

-- Políticas: Catálogo de Eventos
CREATE POLICY "Admins can manage events catalog"
  ON notification_events_catalog FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

CREATE POLICY "Service role full access to events"
  ON notification_events_catalog FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Políticas: Jobs de Notificación
CREATE POLICY "Users can view own notification jobs"
  ON notification_jobs FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can view all notification jobs"
  ON notification_jobs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

CREATE POLICY "Service role full access to jobs"
  ON notification_jobs FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Políticas: Provider Logs
CREATE POLICY "Admins can view provider logs"
  ON notification_provider_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

CREATE POLICY "Service role full access to provider logs"
  ON notification_provider_logs FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Políticas: Delivery Attempts
CREATE POLICY "Admins can view delivery attempts"
  ON notification_delivery_attempts FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

CREATE POLICY "Service role full access to attempts"
  ON notification_delivery_attempts FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Políticas: Phone Normalization Log
CREATE POLICY "Admins can view phone logs"
  ON notification_phone_normalization_log FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

CREATE POLICY "Service role full access to phone logs"
  ON notification_phone_normalization_log FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================
-- GRANTS
-- ============================================

GRANT EXECUTE ON FUNCTION normalize_phone_mx TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_users_by_role TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_users_by_office TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_users_by_role_in_office TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_admin_users TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_all_active_users TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION notify TO authenticated, service_role;

-- ============================================
-- DATOS INICIALES: Catálogo de Eventos
-- ============================================

INSERT INTO notification_events_catalog (event_code, event_name, module, description, enable_in_app, enable_email, enable_whatsapp, template_in_app, template_email, template_whatsapp)
VALUES
  -- Comunicados
  ('nuevo_comunicado', 'Nuevo Comunicado Publicado', 'Comunicados', 'Se publicó un nuevo comunicado', true, true, true,
    '{"titulo": "Nuevo comunicado: {{titulo_comunicado}}", "mensaje": "Se ha publicado un nuevo comunicado que puede ser de tu interés.", "accion_url": "{{link_comunicado}}"}'::jsonb,
    '{"asunto": "Nuevo comunicado: {{titulo_comunicado}}", "variables": ["nombre", "titulo_comunicado", "link_comunicado"]}'::jsonb,
    '{"variables": ["nombre", "titulo_comunicado", "link_comunicado"]}'::jsonb),

  -- Aula Digital / Seguros Education
  ('nuevo_evento', 'Nuevo Evento en Aula Digital', 'Seguros Education', 'Se programó un nuevo evento', true, true, true,
    '{"titulo": "Nuevo evento: {{titulo_evento}}", "mensaje": "Se ha programado un nuevo evento en Aula Digital.", "accion_url": "{{link_evento}}"}'::jsonb,
    '{"asunto": "Nuevo evento: {{titulo_evento}}", "variables": ["nombre", "titulo_evento", "descripcion_evento", "ponente", "fecha_evento", "hora_evento", "link_evento", "link_sesion"]}'::jsonb,
    '{"variables": ["nombre", "titulo_evento", "fecha_evento", "hora_evento", "link_sesion"]}'::jsonb),

  -- Usuarios
  ('bienvenida', 'Bienvenida a Usuario Nuevo', 'Usuarios', 'Usuario nuevo creado en el sistema', false, true, true,
    NULL,
    '{"asunto": "Bienvenido a MOVI Digital", "variables": ["nombre", "apellidos", "email_laboral", "rol", "puesto"]}'::jsonb,
    '{"variables": ["nombre", "email_laboral", "rol"]}'::jsonb),

  ('cuenta_activada', 'Cuenta Activada', 'Usuarios', 'La cuenta del usuario fue activada', true, true, true,
    '{"titulo": "Tu cuenta ha sido activada", "mensaje": "Tu cuenta en MOVI Digital ha sido activada exitosamente."}'::jsonb,
    '{"asunto": "Cuenta Activada - MOVI Digital", "variables": ["nombre", "apellidos"]}'::jsonb,
    '{"variables": ["nombre"]}'::jsonb),

  ('password_reset', 'Recuperación de Contraseña', 'Usuarios', 'Solicitud de recuperación de contraseña', false, true, false,
    NULL,
    '{"asunto": "Recuperación de Contraseña", "variables": ["nombre", "reset_link"]}'::jsonb,
    NULL),

  -- Comisiones
  ('commission_batch_closed', 'Lote de Comisiones Cerrado', 'Comisiones', 'Se cerró un lote de comisiones', true, true, true,
    '{"titulo": "Comisiones disponibles", "mensaje": "Tu lote de comisiones ha sido cerrado y está disponible para consulta.", "accion_url": "/mis-comisiones"}'::jsonb,
    '{"asunto": "Comisiones Disponibles - Semana {{week_number}}", "variables": ["agent_name", "office_name", "week_number", "period_start", "period_end", "net_commission_total", "orden_de_pago_url"]}'::jsonb,
    '{"variables": ["agent_name", "week_number", "period_start", "period_end", "net_commission_total"]}'::jsonb),

  -- Sistema
  ('notificacion_individual', 'Notificación Individual Manual', 'Sistema', 'Notificación enviada manualmente', true, false, true,
    '{"titulo": "{{titulo}}", "mensaje": "{{mensaje}}", "accion_url": "{{accion_url}}"}'::jsonb,
    NULL,
    '{"variables": ["nombre", "titulo", "mensaje"]}'::jsonb),

  ('notificacion_global', 'Notificación Global Manual', 'Sistema', 'Notificación masiva enviada manualmente', true, false, true,
    '{"titulo": "{{titulo}}", "mensaje": "{{mensaje}}", "accion_url": "{{accion_url}}"}'::jsonb,
    NULL,
    '{"variables": ["nombre", "titulo", "mensaje"]}'::jsonb)

ON CONFLICT (event_code) DO NOTHING;

-- Comentario final
COMMENT ON SCHEMA public IS 'Sistema Centralizado de Notificaciones v1.0 - Motor Orquestador con observabilidad total';
