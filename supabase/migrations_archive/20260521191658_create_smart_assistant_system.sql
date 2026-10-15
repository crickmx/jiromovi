/*
  # Smart Assistant System for Centro de Contacto

  ## Summary
  Creates the full infrastructure for the "Asistente Inteligente" feature in the
  WhatsApp contact center. The smart assistant acts as an intelligent orchestration
  layer — it observes conversations, detects intent, activates the correct automatic
  agent when confidence is high, and suggests actions to internal users when ambiguous.

  ### New Tables
  - `contact_center_smart_assistant_config` — per-conversation smart assistant state
  - `contact_center_smart_assistant_events` — full audit trail of all smart assistant actions

  ### Changes to contact_center_conversation_modes
  - Add `smart_assistant_enabled` — whether smart assistant is on for this conversation
  - Add `smart_assistant_status` — active | inactive | paused | awaiting_confirmation | agent_active
  - Add `smart_assistant_paused_until` — when pause expires (for human intervention pause)
  - Add `smart_assistant_pause_reason` — why it was paused
  - Add `last_smart_analysis_at` — timestamp of last analysis
  - Add `last_smart_action_at` — timestamp of last action taken
  - Add `last_detected_intent` — last intent detected
  - Add `last_detected_confidence` — confidence of last detection
  - Add `is_processing_smart_reply` — mutex to prevent duplicate processing
  - Add `last_processed_message_id` — idempotency: don't process same message twice

  ### Security
  - RLS enabled on all new tables
  - Authenticated users can read their own conversation's smart assistant config
  - Service role has full access for edge functions
*/

-- ── Smart Assistant per-conversation config ──────────────────────────────────
CREATE TABLE IF NOT EXISTS contact_center_smart_assistant_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_user_id uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  -- Current state
  smart_assistant_enabled boolean NOT NULL DEFAULT false,
  smart_assistant_status text NOT NULL DEFAULT 'inactive'
    CHECK (smart_assistant_status IN ('active', 'inactive', 'paused', 'awaiting_confirmation', 'agent_active')),
  -- Pause management
  paused_until timestamptz,
  pause_reason text,
  pause_reason_type text CHECK (pause_reason_type IN ('human_intervention', 'user_request', 'contact_request', 'manual', null)),
  -- Last analysis state
  last_analysis_at timestamptz,
  last_action_at timestamptz,
  last_detected_intent text,
  last_detected_confidence numeric(4,2),
  last_processed_message_id text,
  is_processing boolean NOT NULL DEFAULT false,
  -- Pending suggestion waiting for internal user confirmation
  pending_suggestion jsonb,
  -- Config overrides per conversation (null = use global defaults)
  auto_activate_threshold numeric(4,2),
  suggest_threshold numeric(4,2),
  pause_on_human_message boolean,
  human_pause_minutes int,
  -- Tracking
  activated_by uuid REFERENCES usuarios(id),
  deactivated_by uuid REFERENCES usuarios(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(agent_user_id)
);

ALTER TABLE contact_center_smart_assistant_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Smart assistant config — authenticated read own"
  ON contact_center_smart_assistant_config FOR SELECT
  TO authenticated
  USING (
    agent_user_id = auth.uid() OR
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol IN ('Administrador', 'Gerente'))
  );

CREATE POLICY "Smart assistant config — authenticated insert own"
  ON contact_center_smart_assistant_config FOR INSERT
  TO authenticated
  WITH CHECK (
    agent_user_id = auth.uid() OR
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol IN ('Administrador', 'Gerente'))
  );

CREATE POLICY "Smart assistant config — authenticated update own"
  ON contact_center_smart_assistant_config FOR UPDATE
  TO authenticated
  USING (
    agent_user_id = auth.uid() OR
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol IN ('Administrador', 'Gerente'))
  )
  WITH CHECK (
    agent_user_id = auth.uid() OR
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol IN ('Administrador', 'Gerente'))
  );

-- ── Smart Assistant events audit log ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS contact_center_smart_assistant_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_user_id uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN (
    'smart_assistant_activated',
    'smart_assistant_deactivated',
    'smart_assistant_paused',
    'smart_assistant_resumed',
    'analysis_performed',
    'intent_detected',
    'agent_auto_activated',
    'suggestion_shown',
    'suggestion_accepted',
    'suggestion_dismissed',
    'stop_requested_by_contact',
    'stop_requested_by_operator',
    'human_intervention_detected',
    'no_action_taken',
    'error'
  )),
  -- Analysis metadata
  detected_intent text,
  confidence numeric(4,2),
  action_taken text,
  matched_assistant_id uuid REFERENCES contact_center_assistants(id),
  -- Context
  message_text text,
  message_id text,
  actor_type text CHECK (actor_type IN ('system', 'operator', 'contact')),
  actor_id uuid REFERENCES usuarios(id),
  reason text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE contact_center_smart_assistant_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Smart events — authenticated read"
  ON contact_center_smart_assistant_events FOR SELECT
  TO authenticated
  USING (
    agent_user_id = auth.uid() OR
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol IN ('Administrador', 'Gerente'))
  );

CREATE POLICY "Smart events — service role insert"
  ON contact_center_smart_assistant_events FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ── Global smart assistant settings table ────────────────────────────────────
CREATE TABLE IF NOT EXISTS contact_center_smart_assistant_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id uuid REFERENCES oficinas(id),
  -- null office_id = global default
  auto_activate_threshold numeric(4,2) NOT NULL DEFAULT 0.85,
  suggest_threshold numeric(4,2) NOT NULL DEFAULT 0.55,
  pause_on_human_message boolean NOT NULL DEFAULT true,
  human_pause_minutes int NOT NULL DEFAULT 20,
  stop_on_user_request boolean NOT NULL DEFAULT true,
  allow_auto_activate_agents boolean NOT NULL DEFAULT true,
  allow_internal_suggestions boolean NOT NULL DEFAULT true,
  minimum_intervention boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(office_id)
);

ALTER TABLE contact_center_smart_assistant_settings ENABLE ROW LEVEL SECURITY;

-- Insert global default settings
INSERT INTO contact_center_smart_assistant_settings (office_id)
VALUES (null)
ON CONFLICT (office_id) DO NOTHING;

CREATE POLICY "Smart settings — authenticated read"
  ON contact_center_smart_assistant_settings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Smart settings — admin update"
  ON contact_center_smart_assistant_settings FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'Administrador'))
  WITH CHECK (EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'Administrador'));

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_cc_smart_config_agent ON contact_center_smart_assistant_config(agent_user_id);
CREATE INDEX IF NOT EXISTS idx_cc_smart_events_agent ON contact_center_smart_assistant_events(agent_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cc_smart_events_type ON contact_center_smart_assistant_events(event_type, created_at DESC);

-- ── Intent → assistant mapping function ──────────────────────────────────────
CREATE OR REPLACE FUNCTION get_smart_assistant_intent_map()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'cotizacion_auto', json_build_object('keywords', ARRAY['auto', 'coche', 'carro', 'vehículo', 'vehiculo', 'automóvil', 'automovil', 'moto', 'motocicleta'], 'form_type_slug', 'auto_alta_gama'),
    'gmm_individual', json_build_object('keywords', ARRAY['gastos médicos', 'gastos medicos', 'gmm', 'salud', 'médico', 'medico', 'hospital', 'enfermedades', 'individual', 'familiar'], 'form_type_slug', 'gmm_individual'),
    'hogar', json_build_object('keywords', ARRAY['casa', 'hogar', 'habitación', 'habitacion', 'departamento', 'vivienda'], 'form_type_slug', 'hogar_casa_habitacion'),
    'empresarial', json_build_object('keywords', ARRAY['empresa', 'negocio', 'comercio', 'pyme', 'compañía', 'compania'], 'form_type_slug', 'empresa_paquete'),
    'transporte_carga', json_build_object('keywords', ARRAY['transporte', 'carga', 'mercancía', 'mercancia', 'flete', 'camión', 'camion'], 'form_type_slug', 'transporte_carga'),
    'rc_general', json_build_object('keywords', ARRAY['responsabilidad civil', 'rc', 'daños a terceros', 'danos a terceros'], 'form_type_slug', 'rc_general')
  )
$$;
