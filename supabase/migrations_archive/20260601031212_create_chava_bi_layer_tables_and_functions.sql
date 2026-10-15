/*
  # Chava AI — Business Intelligence & Continuous Learning Layer

  ## Overview
  Creates the complete analytics, intent detection, insight generation,
  and knowledge review infrastructure for Chava AI's BI layer.

  ## New Tables
  1. chava_intent_catalog — master intent catalog with commercial metadata
  2. chava_interaction_analytics — per-message intent + topic classification
  3. chava_topic_trends — daily aggregated topic frequency counters
  4. chava_knowledge_review_queue — pending KB suggestions requiring admin approval
  5. chava_bi_insights — auto-generated textual business insights
  6. chava_lead_signals — commercial intent signals from conversations
  7. chava_improvement_suggestions — UX/product improvement auto-suggestions

  ## Security
  - RLS enabled on all tables
  - Service role writes analytics via edge functions
  - Admin-only reads and approvals
  - No PII beyond existing profile data
*/

-- ══════════════════════════════════════════════════════════════════
-- Helper: is_admin()
-- ══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION is_chava_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM usuarios
    WHERE id = auth.uid()
    AND lower(rol) = 'administrador'
    AND (deleted_at IS NULL)
  );
$$;

-- ══════════════════════════════════════════════════════════════════
-- 1. INTENT CATALOG
-- ══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS chava_intent_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text UNIQUE NOT NULL,
  nombre text NOT NULL,
  categoria text NOT NULL CHECK (categoria IN ('comercial','soporte','capacitacion','reclutamiento','administrativo')),
  plataforma text NOT NULL DEFAULT 'general',
  producto text,
  es_lead_comercial boolean DEFAULT false,
  prioridad_comercial int DEFAULT 0,
  activo boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE chava_intent_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read intent catalog"
  ON chava_intent_catalog FOR SELECT
  TO authenticated
  USING (is_chava_admin());

INSERT INTO chava_intent_catalog (codigo, nombre, categoria, plataforma, producto, es_lead_comercial, prioridad_comercial) VALUES
  ('cotizar_auto',         'Cotizar seguro de auto',           'comercial',      'general',        'auto',      true,  3),
  ('cotizar_gmm',          'Cotizar gastos médicos',           'comercial',      'general',        'gmm',       true,  3),
  ('cotizar_vida',         'Cotizar seguro de vida',           'comercial',      'general',        'vida',      true,  3),
  ('cotizar_hogar',        'Cotizar seguro de hogar',          'comercial',      'general',        'hogar',     true,  2),
  ('cotizar_pyme',         'Cotizar seguro PyME/empresarial',  'comercial',      'general',        'pyme',      true,  3),
  ('cotizar_fianza',       'Cotizar fianza',                   'comercial',      'general',        'fianza',    true,  2),
  ('cotizar_rc',           'Cotizar responsabilidad civil',    'comercial',      'general',        'rc',        true,  2),
  ('cotizar_transporte',   'Cotizar seguro de transporte',     'comercial',      'general',        'transporte',true,  2),
  ('contratar_seguro',     'Intención de contratar seguro',    'comercial',      'general',        null,        true,  3),
  ('renovar_poliza',       'Renovación de póliza',             'comercial',      'general',        null,        true,  2),
  ('cancelar_poliza',      'Cancelación de póliza',            'soporte',        'seguwallet',     null,        false, 0),
  ('siniestro_auto',       'Reporte de siniestro: auto',       'soporte',        'seguwallet',     'auto',      false, 1),
  ('siniestro_gmm',        'Reporte de siniestro: GMM',        'soporte',        'seguwallet',     'gmm',       false, 1),
  ('siniestro_hogar',      'Reporte de siniestro: hogar',      'soporte',        'seguwallet',     'hogar',     false, 1),
  ('siniestro_otro',       'Reporte de siniestro: otro ramo',  'soporte',        'seguwallet',     null,        false, 1),
  ('duda_cobranza',        'Duda sobre cobranza/pago',         'soporte',        'general',        null,        false, 0),
  ('duda_poliza',          'Duda sobre póliza o condiciones',  'soporte',        'general',        null,        false, 0),
  ('duda_cobertura',       'Duda sobre coberturas',            'soporte',        'general',        null,        false, 0),
  ('comparativo',          'Comparativo de aseguradoras',      'comercial',      'general',        null,        true,  2),
  ('buscar_agente',        'Buscar agente o promotoría',       'reclutamiento',  'agente_total',   null,        true,  2),
  ('unirse_agente_total',  'Interés en Agente Total',          'reclutamiento',  'agente_total',   null,        true,  3),
  ('conocer_movi',         'Interés en MOVI Digital',          'comercial',      'movi',           null,        true,  2),
  ('conocer_seguwallet',   'Interés en Seguwallet',            'comercial',      'seguwallet',     null,        true,  2),
  ('capacitacion',         'Solicitud de capacitación',        'capacitacion',   'movi',           null,        false, 1),
  ('cedula_a',             'Consulta sobre cédula A',          'capacitacion',   'movi',           null,        false, 1),
  ('uso_movi_crm',         'Duda de uso CRM MOVI',             'soporte',        'movi',           null,        false, 0),
  ('uso_movi_tramites',    'Duda de uso trámites MOVI',        'soporte',        'movi',           null,        false, 0),
  ('uso_seguwallet',       'Duda de uso Seguwallet',           'soporte',        'seguwallet',     null,        false, 0),
  ('regulacion_cnsf',      'Consulta regulatoria CNSF/LISF',   'administrativo', 'general',        null,        false, 0),
  ('otro',                 'Otra consulta general',            'administrativo', 'general',        null,        false, 0)
ON CONFLICT (codigo) DO NOTHING;

-- ══════════════════════════════════════════════════════════════════
-- 2. INTERACTION ANALYTICS
-- ══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS chava_interaction_analytics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consulta_log_id       uuid REFERENCES chava_consultas_log(id) ON DELETE CASCADE,
  agente_message_id     uuid,
  usuario_id            uuid,
  chava_user_id         uuid,
  tipo_usuario          text,
  plataforma_origen     text NOT NULL DEFAULT 'chava_agente',
  source_platform       text,
  intents               text[] DEFAULT '{}',
  intent_principal      text,
  producto_detectado    text,
  estado_detectado      text,
  aseguradora_mencionada text,
  es_lead_potencial     boolean DEFAULT false,
  lead_calidad          text CHECK (lead_calidad IN ('alta','media','baja')),
  datos_precalificacion jsonb DEFAULT '{}',
  confianza_respuesta   text CHECK (confianza_respuesta IN ('alta','media','baja')),
  tuvo_respuesta        boolean DEFAULT true,
  uso_base_conocimiento boolean DEFAULT false,
  consulta_sin_documentacion boolean DEFAULT false,
  mejora_detectada      boolean DEFAULT false,
  plataforma_mejora     text,
  descripcion_mejora    text,
  tema_emergente        boolean DEFAULT false,
  sugerencia_contenido  text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE chava_interaction_analytics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access analytics"
  ON chava_interaction_analytics FOR ALL
  TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Admins read analytics"
  ON chava_interaction_analytics FOR SELECT
  TO authenticated USING (is_chava_admin());

CREATE INDEX IF NOT EXISTS idx_chia_created    ON chava_interaction_analytics(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chia_plataforma ON chava_interaction_analytics(plataforma_origen);
CREATE INDEX IF NOT EXISTS idx_chia_intent     ON chava_interaction_analytics(intent_principal);
CREATE INDEX IF NOT EXISTS idx_chia_producto   ON chava_interaction_analytics(producto_detectado);
CREATE INDEX IF NOT EXISTS idx_chia_estado     ON chava_interaction_analytics(estado_detectado);
CREATE INDEX IF NOT EXISTS idx_chia_lead       ON chava_interaction_analytics(es_lead_potencial) WHERE es_lead_potencial = true;
CREATE INDEX IF NOT EXISTS idx_chia_sin_doc    ON chava_interaction_analytics(consulta_sin_documentacion) WHERE consulta_sin_documentacion = true;

-- ══════════════════════════════════════════════════════════════════
-- 3. TOPIC TRENDS
-- ══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS chava_topic_trends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha date NOT NULL,
  periodo text NOT NULL CHECK (periodo IN ('diario','semanal','mensual')),
  intent_codigo text NOT NULL,
  producto text,
  plataforma text DEFAULT 'general',
  conteo int NOT NULL DEFAULT 0,
  conteo_leads int NOT NULL DEFAULT 0,
  conteo_sin_respuesta int NOT NULL DEFAULT 0,
  variacion_pct numeric(6,2),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (fecha, periodo, intent_codigo, plataforma)
);

ALTER TABLE chava_topic_trends ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role write trends"
  ON chava_topic_trends FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Admins read trends"
  ON chava_topic_trends FOR SELECT TO authenticated USING (is_chava_admin());

CREATE INDEX IF NOT EXISTS idx_chtt_fecha    ON chava_topic_trends(fecha DESC);
CREATE INDEX IF NOT EXISTS idx_chtt_periodo  ON chava_topic_trends(periodo, fecha DESC);
CREATE INDEX IF NOT EXISTS idx_chtt_intent   ON chava_topic_trends(intent_codigo);

-- ══════════════════════════════════════════════════════════════════
-- 4. KNOWLEDGE REVIEW QUEUE
-- ══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS chava_knowledge_review_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL CHECK (tipo IN ('articulo','curso','documento','faq','guia','proceso')),
  titulo text NOT NULL,
  descripcion text NOT NULL,
  contenido_sugerido text,
  plataforma_destino text NOT NULL DEFAULT 'chava',
  categoria text,
  frecuencia_consultas int DEFAULT 1,
  origen_conversacion_ids uuid[] DEFAULT '{}',
  estado text NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente','aprobado','rechazado','en_progreso','completado')),
  prioridad text DEFAULT 'media' CHECK (prioridad IN ('alta','media','baja')),
  revisado_por uuid REFERENCES usuarios(id),
  revisado_at timestamptz,
  notas_revision text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE chava_knowledge_review_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role write review queue"
  ON chava_knowledge_review_queue FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Admins read review queue"
  ON chava_knowledge_review_queue FOR SELECT TO authenticated USING (is_chava_admin());

CREATE POLICY "Admins update review queue"
  ON chava_knowledge_review_queue FOR UPDATE TO authenticated
  USING (is_chava_admin()) WITH CHECK (is_chava_admin());

CREATE INDEX IF NOT EXISTS idx_chkrq_estado    ON chava_knowledge_review_queue(estado, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chkrq_prioridad ON chava_knowledge_review_queue(prioridad, estado);

-- ══════════════════════════════════════════════════════════════════
-- 5. BI INSIGHTS
-- ══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS chava_bi_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL CHECK (tipo IN ('diario','semanal','mensual','alerta','oportunidad')),
  titulo text NOT NULL,
  resumen text NOT NULL,
  datos jsonb DEFAULT '{}',
  categoria text NOT NULL CHECK (categoria IN ('uso','comercial','conocimiento','tecnologia','oportunidad')),
  plataforma text DEFAULT 'general',
  impacto text DEFAULT 'medio' CHECK (impacto IN ('alto','medio','bajo')),
  periodo_inicio date,
  periodo_fin date,
  variacion_pct numeric(6,2),
  leido boolean DEFAULT false,
  publicado boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE chava_bi_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role write insights"
  ON chava_bi_insights FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Admins read insights"
  ON chava_bi_insights FOR SELECT TO authenticated USING (is_chava_admin());

CREATE POLICY "Admins update insights"
  ON chava_bi_insights FOR UPDATE TO authenticated
  USING (is_chava_admin()) WITH CHECK (is_chava_admin());

CREATE INDEX IF NOT EXISTS idx_chbi_tipo      ON chava_bi_insights(tipo, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chbi_categoria ON chava_bi_insights(categoria);
CREATE INDEX IF NOT EXISTS idx_chbi_impacto   ON chava_bi_insights(impacto, publicado);

-- ══════════════════════════════════════════════════════════════════
-- 6. LEAD SIGNALS
-- ══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS chava_lead_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chava_user_id     uuid,
  usuario_id        uuid,
  conversation_id   uuid,
  intent_codigo     text NOT NULL,
  producto          text,
  calidad           text DEFAULT 'media' CHECK (calidad IN ('alta','media','baja')),
  datos_capturados  jsonb DEFAULT '{}',
  estado            text DEFAULT 'nuevo' CHECK (estado IN ('nuevo','contactado','convertido','descartado')),
  asignado_a        uuid REFERENCES usuarios(id),
  oficina_id        uuid,
  notas             text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE chava_lead_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role write leads"
  ON chava_lead_signals FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Admins read leads"
  ON chava_lead_signals FOR SELECT TO authenticated USING (is_chava_admin());

CREATE POLICY "Agents read own leads"
  ON chava_lead_signals FOR SELECT TO authenticated
  USING (asignado_a = auth.uid());

CREATE INDEX IF NOT EXISTS idx_chls_estado   ON chava_lead_signals(estado, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chls_producto ON chava_lead_signals(producto);
CREATE INDEX IF NOT EXISTS idx_chls_intent   ON chava_lead_signals(intent_codigo);

-- ══════════════════════════════════════════════════════════════════
-- 7. IMPROVEMENT SUGGESTIONS
-- ══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS chava_improvement_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plataforma text NOT NULL CHECK (plataforma IN ('movi','seguwallet','agente_total','chava','contenido','grupo_jiro')),
  tipo text NOT NULL CHECK (tipo IN ('ux','funcionalidad','contenido','proceso','capacitacion','comercial')),
  titulo text NOT NULL,
  descripcion text NOT NULL,
  frecuencia_detecciones int DEFAULT 1,
  ejemplos_consultas text[] DEFAULT '{}',
  impacto_estimado text DEFAULT 'medio' CHECK (impacto_estimado IN ('alto','medio','bajo')),
  estado text DEFAULT 'nuevo' CHECK (estado IN ('nuevo','en_revision','aceptado','descartado','implementado')),
  revisado_por uuid REFERENCES usuarios(id),
  revisado_at timestamptz,
  notas text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE chava_improvement_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role write suggestions"
  ON chava_improvement_suggestions FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Admins manage suggestions"
  ON chava_improvement_suggestions FOR SELECT TO authenticated USING (is_chava_admin());

CREATE POLICY "Admins update suggestions"
  ON chava_improvement_suggestions FOR UPDATE TO authenticated
  USING (is_chava_admin()) WITH CHECK (is_chava_admin());

CREATE INDEX IF NOT EXISTS idx_chis_plataforma ON chava_improvement_suggestions(plataforma, estado);
CREATE INDEX IF NOT EXISTS idx_chis_estado     ON chava_improvement_suggestions(estado, created_at DESC);

-- ══════════════════════════════════════════════════════════════════
-- 8. DASHBOARD AGGREGATE FUNCTION
-- ══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION get_chava_bi_dashboard(p_dias int DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
  v_fecha_inicio timestamptz := NOW() - (p_dias || ' days')::interval;
BEGIN
  IF NOT is_chava_admin() THEN
    RAISE EXCEPTION 'Acceso denegado';
  END IF;

  SELECT jsonb_build_object(
    'uso', jsonb_build_object(
      'total_interacciones', (SELECT COUNT(*) FROM chava_interaction_analytics WHERE created_at >= v_fecha_inicio),
      'usuarios_unicos',     (SELECT COUNT(DISTINCT COALESCE(chava_user_id::text, usuario_id::text)) FROM chava_interaction_analytics WHERE created_at >= v_fecha_inicio),
      'usuarios_movi',       (SELECT COUNT(DISTINCT usuario_id) FROM chava_interaction_analytics WHERE plataforma_origen = 'movi' AND created_at >= v_fecha_inicio),
      'usuarios_externos',   (SELECT COUNT(DISTINCT chava_user_id) FROM chava_interaction_analytics WHERE plataforma_origen = 'chava_agente' AND created_at >= v_fecha_inicio),
      'sin_respuesta',       (SELECT COUNT(*) FROM chava_interaction_analytics WHERE tuvo_respuesta = false AND created_at >= v_fecha_inicio),
      'con_kb',              (SELECT COUNT(*) FROM chava_interaction_analytics WHERE uso_base_conocimiento = true AND created_at >= v_fecha_inicio)
    ),
    'comercial', jsonb_build_object(
      'leads_detectados',    (SELECT COUNT(*) FROM chava_lead_signals WHERE created_at >= v_fecha_inicio),
      'leads_alta_calidad',  (SELECT COUNT(*) FROM chava_lead_signals WHERE calidad = 'alta' AND created_at >= v_fecha_inicio),
      'top_productos',       (SELECT COALESCE(jsonb_agg(r), '[]'::jsonb) FROM (SELECT producto_detectado as producto, COUNT(*) as conteo FROM chava_interaction_analytics WHERE producto_detectado IS NOT NULL AND created_at >= v_fecha_inicio GROUP BY producto_detectado ORDER BY conteo DESC LIMIT 6) r),
      'top_estados',         (SELECT COALESCE(jsonb_agg(r), '[]'::jsonb) FROM (SELECT estado_detectado as estado, COUNT(*) as conteo FROM chava_interaction_analytics WHERE estado_detectado IS NOT NULL AND created_at >= v_fecha_inicio GROUP BY estado_detectado ORDER BY conteo DESC LIMIT 8) r)
    ),
    'conocimiento', jsonb_build_object(
      'top_intents',         (SELECT COALESCE(jsonb_agg(r), '[]'::jsonb) FROM (SELECT intent_principal as intent, COUNT(*) as conteo FROM chava_interaction_analytics WHERE intent_principal IS NOT NULL AND created_at >= v_fecha_inicio GROUP BY intent_principal ORDER BY conteo DESC LIMIT 10) r),
      'sin_documentacion',   (SELECT COUNT(*) FROM chava_interaction_analytics WHERE consulta_sin_documentacion = true AND created_at >= v_fecha_inicio),
      'pendientes_revision', (SELECT COUNT(*) FROM chava_knowledge_review_queue WHERE estado = 'pendiente'),
      'sugerencias_total',   (SELECT COUNT(*) FROM chava_knowledge_review_queue)
    ),
    'tecnologia', jsonb_build_object(
      'mejoras_nuevas',      (SELECT COUNT(*) FROM chava_improvement_suggestions WHERE estado = 'nuevo'),
      'mejoras_total',       (SELECT COUNT(*) FROM chava_improvement_suggestions),
      'por_plataforma',      (SELECT COALESCE(jsonb_agg(r), '[]'::jsonb) FROM (SELECT plataforma, COUNT(*) as conteo FROM chava_improvement_suggestions WHERE estado IN ('nuevo','en_revision') GROUP BY plataforma ORDER BY conteo DESC) r)
    ),
    'insights_recientes',    (SELECT COALESCE(jsonb_agg(r), '[]'::jsonb) FROM (SELECT id, tipo, titulo, resumen, categoria, impacto, variacion_pct, created_at FROM chava_bi_insights WHERE publicado = true ORDER BY created_at DESC LIMIT 8) r)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION get_chava_bi_dashboard(int) TO authenticated;
GRANT EXECUTE ON FUNCTION is_chava_admin() TO authenticated, service_role;
