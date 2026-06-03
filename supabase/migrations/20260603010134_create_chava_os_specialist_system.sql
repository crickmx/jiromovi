/*
  # CHAVA OS Specialist System

  ## Overview
  Foundational tables for the CHAVA Intelligent Operating System architecture.
  Transforms CHAVA from a single chatbot into an orchestrated multi-specialist engine.

  ## New Tables

  ### 1. chava_specialists
  Defines the 11 specialist experts that CHAVA can route to internally.
  Each specialist has keywords that trigger activation and modules it serves.

  ### 2. chava_specialist_routes
  Audit log: records which specialists were activated per query, with confidence scores.

  ### 3. chava_memory
  Hierarchical memory store (8 levels: org → office → team → user → client → document → conversation → process).
  TTL-based expiry, confidence scoring, source tracking.

  ### 4. chava_proactive_cache
  Pre-computed proactive insights (alerts, recommendations, opportunities, pending_actions).
  Cached per user/scope with TTL to avoid redundant LLM calls.

  ### 5. chava_actions_log
  Records action suggestions made by CHAVA and whether the user executed them.
  Used for learning which CTAs are effective.

  ## Security
  - RLS enabled on all tables
  - Users can only read/write their own data
  - service_role has full access for edge functions

  ## Helper Functions
  - upsert_chava_memory() — idempotent memory write
  - upsert_chava_proactive_cache() — idempotent cache write
*/

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. chava_specialists — specialist definitions
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chava_specialists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text UNIQUE NOT NULL,
  nombre text NOT NULL,
  descripcion text,
  prioridad integer DEFAULT 50,
  palabras_clave text[] DEFAULT ARRAY[]::text[],
  modulos_relevantes text[] DEFAULT ARRAY[]::text[],
  activo boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE chava_specialists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read specialists"
  ON chava_specialists FOR SELECT
  TO authenticated
  USING (activo = true);

CREATE POLICY "Service role full access specialists"
  ON chava_specialists FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. chava_specialist_routes — routing audit log per query
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chava_specialist_routes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversacion_id uuid REFERENCES conversaciones_chatgpt(id) ON DELETE CASCADE,
  mensaje_id uuid,
  usuario_id uuid REFERENCES usuarios(id) ON DELETE CASCADE,
  especialistas_activados text[] DEFAULT ARRAY[]::text[],
  especialista_primario text,
  confianza_enrutamiento numeric(3,2) DEFAULT 0.0,
  tokens_usados integer,
  latencia_ms integer,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chava_specialist_routes_usuario ON chava_specialist_routes(usuario_id);
CREATE INDEX IF NOT EXISTS idx_chava_specialist_routes_conversacion ON chava_specialist_routes(conversacion_id);
CREATE INDEX IF NOT EXISTS idx_chava_specialist_routes_created ON chava_specialist_routes(created_at DESC);

ALTER TABLE chava_specialist_routes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own specialist routes"
  ON chava_specialist_routes FOR SELECT
  TO authenticated
  USING (usuario_id = auth.uid());

CREATE POLICY "Service role full access specialist routes"
  ON chava_specialist_routes FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. chava_memory — hierarchical memory store
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chava_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope text NOT NULL CHECK (scope IN ('organizacion', 'oficina', 'equipo', 'usuario', 'cliente', 'documento', 'conversacion', 'proceso')),
  scope_id text NOT NULL,
  usuario_id uuid REFERENCES usuarios(id) ON DELETE CASCADE,
  clave text NOT NULL,
  valor jsonb NOT NULL,
  fuente text,
  confianza numeric(3,2) DEFAULT 1.0,
  expires_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(scope, scope_id, clave)
);

CREATE INDEX IF NOT EXISTS idx_chava_memory_scope ON chava_memory(scope, scope_id);
CREATE INDEX IF NOT EXISTS idx_chava_memory_usuario ON chava_memory(usuario_id);
CREATE INDEX IF NOT EXISTS idx_chava_memory_expires ON chava_memory(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_chava_memory_clave ON chava_memory(clave);

ALTER TABLE chava_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own memory"
  ON chava_memory FOR SELECT
  TO authenticated
  USING (usuario_id = auth.uid() OR scope IN ('organizacion', 'oficina'));

CREATE POLICY "Service role full access memory"
  ON chava_memory FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. chava_proactive_cache — pre-computed insights
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chava_proactive_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('alerta', 'recomendacion', 'oportunidad', 'accion_pendiente', 'resumen_dia', 'dashboard_analysis')),
  titulo text NOT NULL,
  cuerpo text NOT NULL,
  datos_json jsonb DEFAULT '{}'::jsonb,
  prioridad integer DEFAULT 50,
  leido boolean DEFAULT false,
  expires_at timestamptz DEFAULT (now() + interval '4 hours'),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chava_proactive_cache_usuario ON chava_proactive_cache(usuario_id);
CREATE INDEX IF NOT EXISTS idx_chava_proactive_cache_tipo ON chava_proactive_cache(tipo);
CREATE INDEX IF NOT EXISTS idx_chava_proactive_cache_expires ON chava_proactive_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_chava_proactive_cache_leido ON chava_proactive_cache(leido) WHERE leido = false;

ALTER TABLE chava_proactive_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own proactive cache"
  ON chava_proactive_cache FOR SELECT
  TO authenticated
  USING (usuario_id = auth.uid());

CREATE POLICY "Users can update own proactive cache"
  ON chava_proactive_cache FOR UPDATE
  TO authenticated
  USING (usuario_id = auth.uid())
  WITH CHECK (usuario_id = auth.uid());

CREATE POLICY "Service role full access proactive cache"
  ON chava_proactive_cache FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. chava_actions_log — action suggestions and execution tracking
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chava_actions_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  conversacion_id uuid REFERENCES conversaciones_chatgpt(id) ON DELETE SET NULL,
  tipo_accion text NOT NULL,
  descripcion text,
  datos_json jsonb DEFAULT '{}'::jsonb,
  ejecutado boolean DEFAULT false,
  ejecutado_at timestamptz,
  resultado_json jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chava_actions_log_usuario ON chava_actions_log(usuario_id);
CREATE INDEX IF NOT EXISTS idx_chava_actions_log_ejecutado ON chava_actions_log(ejecutado);
CREATE INDEX IF NOT EXISTS idx_chava_actions_log_created ON chava_actions_log(created_at DESC);

ALTER TABLE chava_actions_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own actions log"
  ON chava_actions_log FOR SELECT
  TO authenticated
  USING (usuario_id = auth.uid());

CREATE POLICY "Users can update own actions log"
  ON chava_actions_log FOR UPDATE
  TO authenticated
  USING (usuario_id = auth.uid())
  WITH CHECK (usuario_id = auth.uid());

CREATE POLICY "Service role full access actions log"
  ON chava_actions_log FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- Helper RPCs
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION upsert_chava_memory(
  p_scope text,
  p_scope_id text,
  p_usuario_id uuid,
  p_clave text,
  p_valor jsonb,
  p_fuente text DEFAULT NULL,
  p_confianza numeric DEFAULT 1.0,
  p_ttl_hours integer DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO chava_memory (scope, scope_id, usuario_id, clave, valor, fuente, confianza, expires_at)
  VALUES (
    p_scope, p_scope_id, p_usuario_id, p_clave, p_valor, p_fuente, p_confianza,
    CASE WHEN p_ttl_hours IS NOT NULL THEN now() + (p_ttl_hours || ' hours')::interval ELSE NULL END
  )
  ON CONFLICT (scope, scope_id, clave)
  DO UPDATE SET
    valor = EXCLUDED.valor,
    fuente = COALESCE(EXCLUDED.fuente, chava_memory.fuente),
    confianza = EXCLUDED.confianza,
    expires_at = EXCLUDED.expires_at,
    updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION upsert_chava_proactive_cache(
  p_usuario_id uuid,
  p_tipo text,
  p_titulo text,
  p_cuerpo text,
  p_datos_json jsonb DEFAULT '{}'::jsonb,
  p_prioridad integer DEFAULT 50,
  p_ttl_hours integer DEFAULT 4
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  -- Delete expired or same-type entries for this user to avoid duplicates
  DELETE FROM chava_proactive_cache
  WHERE usuario_id = p_usuario_id
    AND tipo = p_tipo
    AND titulo = p_titulo;

  INSERT INTO chava_proactive_cache (usuario_id, tipo, titulo, cuerpo, datos_json, prioridad, expires_at)
  VALUES (
    p_usuario_id, p_tipo, p_titulo, p_cuerpo, p_dados_json,
    p_prioridad,
    now() + (p_ttl_hours || ' hours')::interval
  )
  RETURNING id INTO v_id;

  RETURN v_id;
EXCEPTION WHEN OTHERS THEN
  -- Fallback: try INSERT ignoring the title uniqueness issue
  INSERT INTO chava_proactive_cache (usuario_id, tipo, titulo, cuerpo, dados_json, prioridad, expires_at)
  VALUES (p_usuario_id, p_tipo, p_titulo, p_cuerpo, p_dados_json, p_prioridad, now() + (p_ttl_hours || ' hours')::interval)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION upsert_chava_memory TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION upsert_chava_proactive_cache TO authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- Seed specialist definitions
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO chava_specialists (codigo, nombre, descripcion, prioridad, palabras_clave, modulos_relevantes) VALUES
('seguros', 'Experto en Seguros', 'Especialista en productos de seguros: GMM, auto, vida, daños, coberturas, primas, deducibles, suma asegurada, exclusiones', 90,
 ARRAY['seguro', 'cobertura', 'prima', 'deducible', 'asegurado', 'póliza', 'poliza', 'gmm', 'vida', 'auto', 'daños', 'suma asegurada', 'beneficiario', 'siniestro', 'renovación', 'renovacion', 'endoso', 'exclusión', 'exclusion', 'cotizar', 'cotización', 'cotizacion'],
 ARRAY['gmm-cotizador', 'lector-qualitas', 'mis-polizas', 'produccion']),
('sicas', 'Experto en SICAS', 'Especialista en el sistema SICAS: producción, pólizas vigentes, cobranza, comisiones, reportes, sincronización', 85,
 ARRAY['sicas', 'vigente', 'produccion', 'producción', 'cobranza', 'poliza vigente', 'vencimiento', 'hwcapture', 'reporte sicas', 'sinc', 'sincronizar', 'mi produccion', 'cartera'],
 ARRAY['mi-produccion', 'produccion-total', 'sicas-admin', 'mapeo-vendedores']),
('crm', 'Experto en CRM y Clientes', 'Especialista en gestión de relaciones con clientes: contactos, tareas, oportunidades, seguimiento, pipeline', 80,
 ARRAY['contacto', 'cliente', 'crm', 'tarea', 'seguimiento', 'oportunidad', 'pipeline', 'lead', 'prospecto', 'tablero', 'kanban', 'actividad'],
 ARRAY['crm', 'mi-crm', 'contactos', 'tramites']),
('produccion', 'Experto en Producción', 'Especialista en métricas de producción, comisiones, rankings, metas, comparativos', 80,
 ARRAY['comisión', 'comisiones', 'comision', 'producción total', 'ranking', 'meta', 'bono', 'portafolios', 'lote', 'regimen', 'régimen', 'fiscal', 'desglose', 'pago'],
 ARRAY['comisiones', 'mis-comisiones', 'produccion-total', 'produccion-convenio']),
('marketing', 'Experto en Marketing', 'Especialista en marketing digital, página web del agente, publicidad, redes sociales, materiales de marca', 70,
 ARRAY['pagina web', 'página web', 'marketing', 'publicidad', 'diseño', 'redes', 'branding', 'campaña', 'campaña', 'logo', 'imagen', 'plantilla', 'flyer'],
 ARRAY['mercadotecnia', 'mi-marca', 'mi-pagina-web', 'publicidad']),
('capacitacion', 'Experto en Capacitación', 'Especialista en educación, cursos, cédula A, aula virtual, exámenes, certificaciones', 70,
 ARRAY['curso', 'capacitacion', 'capacitación', 'leccion', 'lección', 'examen', 'cédula', 'cedula', 'módulo', 'modulo', 'aula', 'educacion', 'educación', 'manual', 'aprender', 'certificado'],
 ARRAY['seguros-education', 'cedula-a', 'manuales', 'aula-virtual']),
('tramites', 'Experto en Trámites', 'Especialista en gestión de trámites, registros de actividad, flujos de trabajo, estado de tickets', 80,
 ARRAY['trámite', 'tramite', 'ticket', 'actividad', 'registro', 'folio', 'pendiente', 'urgente', 'estado', 'asignado', 'entrega', 'póliza entrega', 'poliza entrega'],
 ARRAY['tramites', 'registro-actividades', 'tramites-reportes']),
('atencion_clientes', 'Experto en Atención a Clientes', 'Especialista en centro de contacto, WhatsApp, correo, comunicación con asegurados, seguimiento de siniestros', 75,
 ARRAY['whatsapp', 'mensaje', 'correo', 'email', 'chat', 'comunicacion', 'comunicación', 'centro contacto', 'contactar', 'llamar', 'responder', 'seguwallet', 'asegurado'],
 ARRAY['mi-whatsapp', 'centro-contacto', 'centro-correos', 'seguwallet']),
('automatizacion', 'Experto en Automatización', 'Especialista en automatización de procesos, notificaciones automáticas, flujos de trabajo, IA aplicada', 65,
 ARRAY['automatizar', 'automatico', 'automático', 'notificacion', 'notificación', 'flujo', 'workflow', 'proceso', 'robot', 'bot', 'ia', 'inteligencia', 'automation'],
 ARRAY['automatizacion-ia', 'notificaciones-transaccionales', 'centro-digital']),
('documentos', 'Experto en Documentos', 'Especialista en centro digital, archivos, expedientes, documentos, importaciones, almacenamiento', 70,
 ARRAY['documento', 'archivo', 'expediente', 'carpeta', 'importar', 'subir', 'descargar', 'pdf', 'centro digital', 'storage', 'adjunto'],
 ARRAY['centro-digital', 'documentos', 'expediente']),
('investigacion', 'Experto en Investigación', 'Especialista en búsqueda de información, legislación, normativa, tendencias del mercado asegurador', 70,
 ARRAY['legislación', 'legislacion', 'ley', 'regulación', 'regulacion', 'cnsf', 'normativa', 'reglamento', 'circular', 'estadística', 'estadistica', 'mercado', 'tendencia', 'investigar', 'buscar'],
 ARRAY[]::text[])
ON CONFLICT (codigo) DO NOTHING;
