/*
  # Sistema Completo de Mi Asistente - Cerebro Inteligente de MOVI Digital

  1. Nuevas Tablas
    - `assistant_intents`: Catálogo de 12 intents MVP con prompts y configuración
    - `assistant_snapshots`: Cache de contexto por módulo y usuario (TTL 5 minutos)
    - `assistant_suggestions`: Sugerencias contextuales por ruta y rol
    - `assistant_events`: Eventos detectados y alertas proactivas
    - `assistant_actions`: Deep links y acciones disponibles por intent
    - `assistant_action_clicks`: Log de analytics de acciones ejecutadas

  2. Extensiones a Tablas Existentes
    - Extend `conversaciones_chatgpt` con campos de asistente
    - Extend `mensajes_chatgpt` con respuestas estructuradas

  3. Seguridad
    - RLS habilitado en todas las tablas
    - Usuarios solo ven sus propios datos
    - Service role tiene acceso completo para Edge Functions

  4. Índices
    - Optimización de queries frecuentes
    - Performance en búsqueda de conversaciones y eventos
*/

-- ============================================================================
-- TABLA: assistant_intents
-- ============================================================================
CREATE TABLE IF NOT EXISTS assistant_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text UNIQUE NOT NULL,
  nombre text NOT NULL,
  descripcion text NOT NULL,
  categoria text NOT NULL,
  prompt_template text NOT NULL,
  requiere_snapshot boolean DEFAULT true,
  activo boolean DEFAULT true,
  orden integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE assistant_intents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active intents"
  ON assistant_intents FOR SELECT
  USING (activo = true);

CREATE POLICY "Only admins can manage intents"
  ON assistant_intents FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'admin'
    )
  );

-- ============================================================================
-- TABLA: assistant_snapshots
-- ============================================================================
CREATE TABLE IF NOT EXISTS assistant_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  modulo text NOT NULL,
  ruta text NOT NULL,
  datos_json jsonb NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE assistant_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own snapshots"
  ON assistant_snapshots FOR SELECT
  TO authenticated
  USING (usuario_id = auth.uid());

CREATE POLICY "Users can create own snapshots"
  ON assistant_snapshots FOR INSERT
  TO authenticated
  WITH CHECK (usuario_id = auth.uid());

CREATE POLICY "Service role can manage all snapshots"
  ON assistant_snapshots FOR ALL
  TO service_role
  USING (true);

CREATE INDEX idx_assistant_snapshots_usuario_modulo
  ON assistant_snapshots(usuario_id, modulo, expires_at);

CREATE INDEX idx_assistant_snapshots_expires
  ON assistant_snapshots(expires_at);

-- ============================================================================
-- TABLA: assistant_suggestions
-- ============================================================================
CREATE TABLE IF NOT EXISTS assistant_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  intent_codigo text REFERENCES assistant_intents(codigo) ON DELETE CASCADE,
  ruta_pattern text NOT NULL,
  rol_requerido text,
  orden integer DEFAULT 0,
  texto_pregunta text NOT NULL,
  activo boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE assistant_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active suggestions"
  ON assistant_suggestions FOR SELECT
  USING (activo = true);

CREATE POLICY "Only admins can manage suggestions"
  ON assistant_suggestions FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'admin'
    )
  );

CREATE INDEX idx_assistant_suggestions_ruta
  ON assistant_suggestions(ruta_pattern, activo);

-- ============================================================================
-- TABLA: assistant_events
-- ============================================================================
CREATE TABLE IF NOT EXISTS assistant_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  tipo_evento text NOT NULL,
  titulo text NOT NULL,
  descripcion text,
  datos_json jsonb,
  leido boolean DEFAULT false,
  prioridad text DEFAULT 'media' CHECK (prioridad IN ('alta', 'media', 'baja')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE assistant_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own events"
  ON assistant_events FOR SELECT
  TO authenticated
  USING (usuario_id = auth.uid());

CREATE POLICY "Users can update own events"
  ON assistant_events FOR UPDATE
  TO authenticated
  USING (usuario_id = auth.uid())
  WITH CHECK (usuario_id = auth.uid());

CREATE POLICY "Service role can create events"
  ON assistant_events FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE INDEX idx_assistant_events_usuario_leido
  ON assistant_events(usuario_id, leido, created_at DESC);

-- ============================================================================
-- TABLA: assistant_actions
-- ============================================================================
CREATE TABLE IF NOT EXISTS assistant_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  intent_codigo text REFERENCES assistant_intents(codigo) ON DELETE CASCADE,
  tipo_accion text NOT NULL CHECK (tipo_accion IN ('navigate', 'navigate-with-id', 'copy', 'execute-intent', 'dismiss', 'download', 'external')),
  etiqueta text NOT NULL,
  destino text NOT NULL,
  icono text,
  orden integer DEFAULT 0,
  activo boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE assistant_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active actions"
  ON assistant_actions FOR SELECT
  USING (activo = true);

CREATE POLICY "Only admins can manage actions"
  ON assistant_actions FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'admin'
    )
  );

-- ============================================================================
-- TABLA: assistant_action_clicks
-- ============================================================================
CREATE TABLE IF NOT EXISTS assistant_action_clicks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  action_id uuid REFERENCES assistant_actions(id) ON DELETE SET NULL,
  intent_codigo text,
  tipo_accion text NOT NULL,
  destino text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE assistant_action_clicks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create own action clicks"
  ON assistant_action_clicks FOR INSERT
  TO authenticated
  WITH CHECK (usuario_id = auth.uid());

CREATE POLICY "Admins can view all action clicks"
  ON assistant_action_clicks FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'admin'
    )
  );

CREATE INDEX idx_assistant_action_clicks_usuario
  ON assistant_action_clicks(usuario_id, created_at DESC);

-- ============================================================================
-- EXTENDER TABLA: conversaciones_chatgpt
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'conversaciones_chatgpt'
    AND column_name = 'intent_detectado'
  ) THEN
    ALTER TABLE conversaciones_chatgpt ADD COLUMN intent_detectado text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'conversaciones_chatgpt'
    AND column_name = 'modulo_origen'
  ) THEN
    ALTER TABLE conversaciones_chatgpt ADD COLUMN modulo_origen text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'conversaciones_chatgpt'
    AND column_name = 'snapshot_id'
  ) THEN
    ALTER TABLE conversaciones_chatgpt ADD COLUMN snapshot_id uuid REFERENCES assistant_snapshots(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'conversaciones_chatgpt'
    AND column_name = 'es_asistente'
  ) THEN
    ALTER TABLE conversaciones_chatgpt ADD COLUMN es_asistente boolean DEFAULT false;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_conversaciones_usuario_asistente
  ON conversaciones_chatgpt(usuario_id, es_asistente, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_conversaciones_modulo
  ON conversaciones_chatgpt(usuario_id, modulo_origen, updated_at DESC);

-- ============================================================================
-- EXTENDER TABLA: mensajes_chatgpt
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'mensajes_chatgpt'
    AND column_name = 'respuesta_estructurada_json'
  ) THEN
    ALTER TABLE mensajes_chatgpt ADD COLUMN respuesta_estructurada_json jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'mensajes_chatgpt'
    AND column_name = 'tiene_acciones'
  ) THEN
    ALTER TABLE mensajes_chatgpt ADD COLUMN tiene_acciones boolean DEFAULT false;
  END IF;
END $$;

-- ============================================================================
-- FUNCIÓN: Limpiar snapshots expirados
-- ============================================================================
CREATE OR REPLACE FUNCTION cleanup_expired_snapshots()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM assistant_snapshots
  WHERE expires_at < now();
END;
$$;

-- ============================================================================
-- FUNCIÓN: Obtener contador de eventos no leídos
-- ============================================================================
CREATE OR REPLACE FUNCTION get_unread_events_count(p_usuario_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count integer;
BEGIN
  SELECT COUNT(*)
  INTO v_count
  FROM assistant_events
  WHERE usuario_id = p_usuario_id
  AND leido = false;

  RETURN v_count;
END;
$$;

-- ============================================================================
-- FUNCIÓN: Marcar eventos como leídos
-- ============================================================================
CREATE OR REPLACE FUNCTION mark_events_as_read(p_usuario_id uuid, p_event_ids uuid[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE assistant_events
  SET leido = true
  WHERE usuario_id = p_usuario_id
  AND id = ANY(p_event_ids);
END;
$$;

-- ============================================================================
-- FUNCIÓN: Obtener o crear conversación activa
-- ============================================================================
CREATE OR REPLACE FUNCTION get_or_create_active_conversation(
  p_usuario_id uuid,
  p_modulo text,
  p_titulo text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_conversation_id uuid;
  v_titulo text;
BEGIN
  SELECT id INTO v_conversation_id
  FROM conversaciones_chatgpt
  WHERE usuario_id = p_usuario_id
  AND modulo_origen = p_modulo
  AND es_asistente = true
  AND updated_at > now() - interval '24 hours'
  ORDER BY updated_at DESC
  LIMIT 1;

  IF v_conversation_id IS NOT NULL THEN
    RETURN v_conversation_id;
  END IF;

  v_titulo := COALESCE(p_titulo, 'Conversación en ' || p_modulo);

  INSERT INTO conversaciones_chatgpt (usuario_id, titulo, es_asistente, modulo_origen)
  VALUES (p_usuario_id, v_titulo, true, p_modulo)
  RETURNING id INTO v_conversation_id;

  RETURN v_conversation_id;
END;
$$;

-- ============================================================================
-- CARGAR DATOS: 12 Intents MVP
-- ============================================================================
INSERT INTO assistant_intents (codigo, nombre, descripcion, categoria, prompt_template, requiere_snapshot, orden) VALUES
('dashboard_summary', 'Resumen del Dashboard', 'Muestra KPIs principales y resumen del día', 'general', 'Genera un resumen ejecutivo del dashboard mostrando: producción del mes, comisiones pendientes, tareas de hoy, renovaciones próximas. Formato JSON con type:dashboard_summary, kpis:[{icon, value, label, trend}], actions:[{type, label, destination}]', true, 1),
('performance_summary', 'Resumen de Desempeño', 'Análisis de producción y tendencias', 'produccion', 'Analiza el desempeño del agente: tendencia últimos 6 meses, comparación mes actual vs anterior, insights. Formato JSON con type:performance_summary, chart:{type, data}, table:{headers, rows}, insights:string, actions:[]', true, 2),
('commission_explain', 'Explicar Comisión', 'Desglose detallado de una comisión', 'comisiones', 'Explica la comisión en lenguaje humano. Muestra tabla con conceptos (Prima Neta, IVA, Retenciones, Neto a Pagar), variaciones vs mes anterior, causas probables. Formato JSON con type:commission_explain, table:{headers, rows}, explanation:string, actions:[]', true, 3),
('commission_anomaly_detect', 'Detectar Anomalías en Comisiones', 'Identifica comisiones atípicas o fuera de rango', 'comisiones', 'Analiza comisiones buscando anomalías (>30% diferencia vs promedio). Lista comisiones atípicas con razones posibles. Formato JSON con type:commission_anomaly, anomalies:[{commission_id, amount, deviation, reason}], actions:[]', true, 4),
('daily_priorities', 'Prioridades del Día', 'Lista de tareas y acciones prioritarias', 'general', 'Analiza snapshot de CRM, trámites y notificaciones. Crea lista priorizada: tareas vencidas (alta), renovaciones próximas (media), seguimientos (baja). Formato JSON con type:priority_list, items:[{title, description, priority, action}]', true, 5),
('client_outreach_plan', 'Plan de Contacto de Clientes', 'Identifica clientes prioritarios para contactar', 'crm', 'Identifica 5-10 contactos prioritarios: renovaciones próximas 30 días, sin contacto >60 días, sin póliza activa. Formato JSON con type:outreach_plan, clients:[{name, reason, suggested_product, last_contact, action}]', true, 6),
('cross_sell_opportunities', 'Oportunidades de Venta Cruzada', 'Sugiere productos adicionales para clientes', 'crm', 'Analiza clientes y sugiere productos adicionales basados en perfil. Formato JSON con type:cross_sell, opportunities:[{client, current_products, suggested_products, score, reason}], actions:[]', true, 7),
('renewals_forecast', 'Pronóstico de Renovaciones', 'Lista de pólizas próximas a vencer', 'crm', 'Lista pólizas que vencen en próximos 30-90 días con datos del cliente. Formato JSON con type:renewals_forecast, renewals:[{client, policy, expiry_date, premium, action}], actions:[]', true, 8),
('message_generator', 'Generador de Mensajes', 'Crea mensajes personalizados para WhatsApp/Email', 'crm', 'Genera mensaje personalizado para cliente específico con variables dinámicas. Formato JSON con type:message_generator, message:string, variables:{}, actions:[{type:copy, label:"Copiar mensaje"}]', true, 9),
('tramite_status_helper', 'Ayuda con Estado de Trámite', 'Explica estado actual y siguientes pasos', 'tramites', 'Explica estado del trámite en lenguaje claro, timeline visual, siguiente paso sugerido. Formato JSON con type:tramite_status, timeline:[{step, status, date}], next_step:string, actions:[]', true, 10),
('team_insights_manager', 'Insights del Equipo', 'Análisis comparativo de agentes (solo gerentes)', 'produccion', 'Compara desempeño de agentes de la oficina: producción, comisiones, eficiencia. Formato JSON con type:team_insights, table:{headers, rows}, chart:{type, data}, actions:[]', true, 11),
('navigation_help', 'Ayuda de Navegación', 'Guía para encontrar funcionalidades', 'general', 'Muestra grid de botones organizados por categoría para navegar. Formato JSON con type:navigation_help, categories:[{name, actions:[{type:navigate, label, destination, icon}]}]', false, 12)
ON CONFLICT (codigo) DO NOTHING;

-- ============================================================================
-- CARGAR DATOS: Acciones por Intent
-- ============================================================================
INSERT INTO assistant_actions (intent_codigo, tipo_accion, etiqueta, destino, icono, orden) VALUES
('dashboard_summary', 'navigate', 'Ver Mis Comisiones', '/mis-comisiones', 'DollarSign', 1),
('dashboard_summary', 'navigate', 'Ver Mi Producción', '/mi-produccion', 'TrendingUp', 2),
('dashboard_summary', 'navigate', 'Ver Mis Tareas', '/mi-crm/tareas', 'CheckSquare', 3),
('performance_summary', 'navigate', 'Ver Producción Detallada', '/mi-produccion', 'BarChart', 1),
('performance_summary', 'execute-intent', 'Oportunidades de Venta', 'cross_sell_opportunities', 'Target', 2),
('commission_explain', 'navigate', 'Ver Todas las Comisiones', '/mis-comisiones', 'List', 1),
('commission_explain', 'copy', 'Copiar Desglose', 'clipboard', 'Copy', 2),
('commission_anomaly_detect', 'navigate', 'Ver Comisiones', '/mis-comisiones', 'AlertCircle', 1),
('daily_priorities', 'navigate', 'Ver Mis Tareas', '/mi-crm/tareas', 'CheckSquare', 1),
('daily_priorities', 'navigate', 'Ver Trámites', '/tramites', 'FileText', 2),
('client_outreach_plan', 'navigate', 'Ver Contactos CRM', '/mi-crm/contactos', 'Users', 1),
('cross_sell_opportunities', 'navigate', 'Ver Contactos CRM', '/mi-crm/contactos', 'Users', 1),
('renewals_forecast', 'navigate', 'Ver Contactos CRM', '/mi-crm/contactos', 'Calendar', 1),
('message_generator', 'copy', 'Copiar Mensaje', 'clipboard', 'Copy', 1),
('message_generator', 'navigate', 'Ir a WhatsApp', '/centro-notificaciones', 'MessageSquare', 2),
('tramite_status_helper', 'navigate', 'Ver Trámite', '/tramites/:id', 'FileText', 1),
('team_insights_manager', 'navigate', 'Ver Producción por Vendedor', '/produccion-por-vendedor', 'Users', 1),
('navigation_help', 'navigate', 'Dashboard', '/dashboard', 'Home', 1),
('navigation_help', 'navigate', 'Mis Comisiones', '/mis-comisiones', 'DollarSign', 2),
('navigation_help', 'navigate', 'Mi Producción', '/mi-produccion', 'TrendingUp', 3),
('navigation_help', 'navigate', 'Mi CRM', '/mi-crm/contactos', 'Users', 4),
('navigation_help', 'navigate', 'Trámites', '/tramites', 'FileText', 5)
ON CONFLICT DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_mensajes_conversacion_created
  ON mensajes_chatgpt(conversacion_id, created_at DESC);

GRANT ALL ON assistant_intents TO service_role;
GRANT ALL ON assistant_snapshots TO service_role;
GRANT ALL ON assistant_suggestions TO service_role;
GRANT ALL ON assistant_events TO service_role;
GRANT ALL ON assistant_actions TO service_role;
GRANT ALL ON assistant_action_clicks TO service_role;