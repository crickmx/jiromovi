/*
  # Modo Automático - Centro de Contacto

  ## Purpose
  Creates the database schema for the AI-powered automatic mode in Centro de Contacto > Bandeja.
  This allows conversations to be handled by AI assistants that can capture quote form fields,
  collect documents, and auto-create tramites when ready.

  ## New Tables
  1. `contact_center_assistants` - AI assistant configurations (manual + auto-generated from quote forms)
  2. `contact_center_assistant_fields` - Fields the assistant needs to capture
  3. `contact_center_assistant_templates` - Message templates for each conversation stage
  4. `contact_center_assistant_sessions` - Active/completed automation sessions per conversation
  5. `contact_center_assistant_session_data` - Captured field values within a session
  6. `contact_center_assistant_events` - Full audit log of session events
  7. `contact_center_assistant_documents` - Documents collected by the assistant
  8. `contact_center_assistant_metrics` - Aggregate performance metrics per assistant

  ## Security
  - RLS enabled on all tables
  - Admin/Gerente can manage assistants
  - Empleado can view and use sessions
  - All roles can read active assistants for their office

  ## Notes
  - Assistants can be auto-generated from quote_form_templates (source='form')
  - or manually configured (source='manual')
  - Sessions track the full conversation flow state machine
  - All URLs must use https://app.movi.digital
*/

-- ============================================================
-- 1. CONTACT CENTER ASSISTANTS
-- ============================================================
CREATE TABLE IF NOT EXISTS contact_center_assistants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  descripcion text DEFAULT '',
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'form')),
  quote_form_template_id uuid REFERENCES quote_form_templates(id) ON DELETE SET NULL,
  office_id uuid REFERENCES oficinas(id) ON DELETE CASCADE,
  is_active boolean NOT NULL DEFAULT true,
  is_global boolean NOT NULL DEFAULT false,
  -- AI configuration
  system_prompt text DEFAULT '',
  model text NOT NULL DEFAULT 'gpt-4o-mini',
  language text NOT NULL DEFAULT 'es',
  -- Flow configuration
  welcome_message text DEFAULT '',
  consent_message text DEFAULT '',
  completion_message text DEFAULT '',
  transfer_message text DEFAULT '',
  -- Behaviour
  auto_create_tramite boolean NOT NULL DEFAULT true,
  tramite_tipo text DEFAULT 'formulario_cotizacion',
  tramite_prioridad text NOT NULL DEFAULT 'Media',
  -- Metrics snapshot
  total_sessions integer NOT NULL DEFAULT 0,
  completed_sessions integer NOT NULL DEFAULT 0,
  transferred_sessions integer NOT NULL DEFAULT 0,
  -- Audit
  created_by uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE contact_center_assistants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and gerentes can manage assistants"
  ON contact_center_assistants FOR SELECT
  TO authenticated
  USING (
    (SELECT rol FROM usuarios WHERE id = auth.uid()) IN ('Administrador', 'Gerente', 'Empleado', 'Ejecutivo')
    OR is_global = true
  );

CREATE POLICY "Admins can insert assistants"
  ON contact_center_assistants FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT rol FROM usuarios WHERE id = auth.uid()) IN ('Administrador', 'Gerente')
  );

CREATE POLICY "Admins can update assistants"
  ON contact_center_assistants FOR UPDATE
  TO authenticated
  USING (
    (SELECT rol FROM usuarios WHERE id = auth.uid()) IN ('Administrador', 'Gerente')
  )
  WITH CHECK (
    (SELECT rol FROM usuarios WHERE id = auth.uid()) IN ('Administrador', 'Gerente')
  );

CREATE POLICY "Admins can delete assistants"
  ON contact_center_assistants FOR DELETE
  TO authenticated
  USING (
    (SELECT rol FROM usuarios WHERE id = auth.uid()) = 'Administrador'
  );

-- ============================================================
-- 2. ASSISTANT FIELDS
-- ============================================================
CREATE TABLE IF NOT EXISTS contact_center_assistant_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assistant_id uuid NOT NULL REFERENCES contact_center_assistants(id) ON DELETE CASCADE,
  field_key text NOT NULL,
  label text NOT NULL,
  field_type text NOT NULL DEFAULT 'text' CHECK (field_type IN ('text', 'number', 'date', 'select', 'multiselect', 'file', 'phone', 'email', 'boolean')),
  is_required boolean NOT NULL DEFAULT true,
  options jsonb DEFAULT '[]',
  validation_regex text DEFAULT NULL,
  capture_order integer NOT NULL DEFAULT 0,
  prompt_text text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE contact_center_assistant_fields ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view assistant fields"
  ON contact_center_assistant_fields FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage assistant fields"
  ON contact_center_assistant_fields FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT rol FROM usuarios WHERE id = auth.uid()) IN ('Administrador', 'Gerente')
  );

CREATE POLICY "Admins can update assistant fields"
  ON contact_center_assistant_fields FOR UPDATE
  TO authenticated
  USING (
    (SELECT rol FROM usuarios WHERE id = auth.uid()) IN ('Administrador', 'Gerente')
  )
  WITH CHECK (
    (SELECT rol FROM usuarios WHERE id = auth.uid()) IN ('Administrador', 'Gerente')
  );

CREATE POLICY "Admins can delete assistant fields"
  ON contact_center_assistant_fields FOR DELETE
  TO authenticated
  USING (
    (SELECT rol FROM usuarios WHERE id = auth.uid()) IN ('Administrador', 'Gerente')
  );

-- ============================================================
-- 3. ASSISTANT MESSAGE TEMPLATES
-- ============================================================
CREATE TABLE IF NOT EXISTS contact_center_assistant_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assistant_id uuid NOT NULL REFERENCES contact_center_assistants(id) ON DELETE CASCADE,
  stage text NOT NULL CHECK (stage IN ('welcome', 'consent', 'capturing', 'document_request', 'summary', 'completion', 'transfer', 'error')),
  template_text text NOT NULL,
  channel text NOT NULL DEFAULT 'whatsapp' CHECK (channel IN ('whatsapp', 'email', 'all')),
  language text NOT NULL DEFAULT 'es',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE contact_center_assistant_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view templates"
  ON contact_center_assistant_templates FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage templates"
  ON contact_center_assistant_templates FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT rol FROM usuarios WHERE id = auth.uid()) IN ('Administrador', 'Gerente')
  );

CREATE POLICY "Admins can update templates"
  ON contact_center_assistant_templates FOR UPDATE
  TO authenticated
  USING (
    (SELECT rol FROM usuarios WHERE id = auth.uid()) IN ('Administrador', 'Gerente')
  )
  WITH CHECK (
    (SELECT rol FROM usuarios WHERE id = auth.uid()) IN ('Administrador', 'Gerente')
  );

CREATE POLICY "Admins can delete templates"
  ON contact_center_assistant_templates FOR DELETE
  TO authenticated
  USING (
    (SELECT rol FROM usuarios WHERE id = auth.uid()) IN ('Administrador', 'Gerente')
  );

-- ============================================================
-- 4. ASSISTANT SESSIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS contact_center_assistant_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assistant_id uuid NOT NULL REFERENCES contact_center_assistants(id) ON DELETE RESTRICT,
  agent_user_id uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  -- The operator who activated the session
  activated_by uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  -- Session state machine
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'transferred', 'cancelled', 'error')),
  current_stage text NOT NULL DEFAULT 'welcome' CHECK (current_stage IN ('welcome', 'consent', 'capturing', 'document_request', 'summary', 'completion', 'transfer', 'error')),
  current_field_index integer NOT NULL DEFAULT 0,
  -- Linked tramite (created when session completes)
  ticket_id uuid REFERENCES tickets(id) ON DELETE SET NULL,
  -- Consent
  consent_given boolean NOT NULL DEFAULT false,
  consent_at timestamptz DEFAULT NULL,
  -- Conversation context
  chatgpt_conversation_id uuid DEFAULT NULL,
  last_message_at timestamptz DEFAULT NULL,
  -- Counters
  messages_sent integer NOT NULL DEFAULT 0,
  messages_received integer NOT NULL DEFAULT 0,
  -- Timing
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz DEFAULT NULL,
  -- Transfer info
  transferred_to uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  transfer_reason text DEFAULT NULL,
  -- Metadata
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE contact_center_assistant_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view sessions for their conversations"
  ON contact_center_assistant_sessions FOR SELECT
  TO authenticated
  USING (
    (SELECT rol FROM usuarios WHERE id = auth.uid()) IN ('Administrador', 'Gerente', 'Empleado', 'Ejecutivo')
  );

CREATE POLICY "Staff can insert sessions"
  ON contact_center_assistant_sessions FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT rol FROM usuarios WHERE id = auth.uid()) IN ('Administrador', 'Gerente', 'Empleado', 'Ejecutivo')
  );

CREATE POLICY "Staff can update sessions"
  ON contact_center_assistant_sessions FOR UPDATE
  TO authenticated
  USING (
    (SELECT rol FROM usuarios WHERE id = auth.uid()) IN ('Administrador', 'Gerente', 'Empleado', 'Ejecutivo')
  )
  WITH CHECK (
    (SELECT rol FROM usuarios WHERE id = auth.uid()) IN ('Administrador', 'Gerente', 'Empleado', 'Ejecutivo')
  );

-- ============================================================
-- 5. SESSION DATA (captured field values)
-- ============================================================
CREATE TABLE IF NOT EXISTS contact_center_assistant_session_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES contact_center_assistant_sessions(id) ON DELETE CASCADE,
  field_id uuid REFERENCES contact_center_assistant_fields(id) ON DELETE SET NULL,
  field_key text NOT NULL,
  field_label text NOT NULL DEFAULT '',
  value_text text DEFAULT NULL,
  value_number numeric DEFAULT NULL,
  value_date date DEFAULT NULL,
  value_json jsonb DEFAULT NULL,
  captured_at timestamptz NOT NULL DEFAULT now(),
  confidence_score numeric DEFAULT NULL,
  confirmed_by_user boolean NOT NULL DEFAULT false
);

ALTER TABLE contact_center_assistant_session_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view session data"
  ON contact_center_assistant_session_data FOR SELECT
  TO authenticated
  USING (
    (SELECT rol FROM usuarios WHERE id = auth.uid()) IN ('Administrador', 'Gerente', 'Empleado', 'Ejecutivo')
  );

CREATE POLICY "Staff can insert session data"
  ON contact_center_assistant_session_data FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT rol FROM usuarios WHERE id = auth.uid()) IN ('Administrador', 'Gerente', 'Empleado', 'Ejecutivo')
  );

CREATE POLICY "Staff can update session data"
  ON contact_center_assistant_session_data FOR UPDATE
  TO authenticated
  USING (
    (SELECT rol FROM usuarios WHERE id = auth.uid()) IN ('Administrador', 'Gerente', 'Empleado', 'Ejecutivo')
  )
  WITH CHECK (
    (SELECT rol FROM usuarios WHERE id = auth.uid()) IN ('Administrador', 'Gerente', 'Empleado', 'Ejecutivo')
  );

-- ============================================================
-- 6. SESSION EVENTS (audit trail)
-- ============================================================
CREATE TABLE IF NOT EXISTS contact_center_assistant_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES contact_center_assistant_sessions(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN (
    'session_started', 'session_paused', 'session_resumed', 'session_completed',
    'session_transferred', 'session_cancelled', 'session_error',
    'stage_changed', 'field_captured', 'field_skipped', 'consent_given', 'consent_refused',
    'message_sent', 'message_received', 'document_received', 'tramite_created',
    'ai_call', 'ai_error', 'operator_intervention'
  )),
  stage_from text DEFAULT NULL,
  stage_to text DEFAULT NULL,
  field_key text DEFAULT NULL,
  value_preview text DEFAULT NULL,
  actor_type text NOT NULL DEFAULT 'system' CHECK (actor_type IN ('system', 'ai', 'operator', 'contact')),
  actor_id uuid DEFAULT NULL,
  message text DEFAULT NULL,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE contact_center_assistant_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view events"
  ON contact_center_assistant_events FOR SELECT
  TO authenticated
  USING (
    (SELECT rol FROM usuarios WHERE id = auth.uid()) IN ('Administrador', 'Gerente', 'Empleado', 'Ejecutivo')
  );

CREATE POLICY "Service role can insert events"
  ON contact_center_assistant_events FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT rol FROM usuarios WHERE id = auth.uid()) IN ('Administrador', 'Gerente', 'Empleado', 'Ejecutivo')
  );

-- ============================================================
-- 7. SESSION DOCUMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS contact_center_assistant_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES contact_center_assistant_sessions(id) ON DELETE CASCADE,
  field_key text DEFAULT NULL,
  file_name text NOT NULL DEFAULT 'documento',
  file_type text NOT NULL DEFAULT 'document',
  mime_type text DEFAULT NULL,
  file_url text NOT NULL,
  source_message_id uuid REFERENCES contact_center_messages(id) ON DELETE SET NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  verified boolean NOT NULL DEFAULT false,
  verified_by uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  verified_at timestamptz DEFAULT NULL,
  notes text DEFAULT NULL
);

ALTER TABLE contact_center_assistant_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view session documents"
  ON contact_center_assistant_documents FOR SELECT
  TO authenticated
  USING (
    (SELECT rol FROM usuarios WHERE id = auth.uid()) IN ('Administrador', 'Gerente', 'Empleado', 'Ejecutivo')
  );

CREATE POLICY "Staff can insert documents"
  ON contact_center_assistant_documents FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT rol FROM usuarios WHERE id = auth.uid()) IN ('Administrador', 'Gerente', 'Empleado', 'Ejecutivo')
  );

CREATE POLICY "Staff can update documents"
  ON contact_center_assistant_documents FOR UPDATE
  TO authenticated
  USING (
    (SELECT rol FROM usuarios WHERE id = auth.uid()) IN ('Administrador', 'Gerente', 'Empleado', 'Ejecutivo')
  )
  WITH CHECK (
    (SELECT rol FROM usuarios WHERE id = auth.uid()) IN ('Administrador', 'Gerente', 'Empleado', 'Ejecutivo')
  );

-- ============================================================
-- 8. ASSISTANT METRICS
-- ============================================================
CREATE TABLE IF NOT EXISTS contact_center_assistant_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assistant_id uuid NOT NULL REFERENCES contact_center_assistants(id) ON DELETE CASCADE,
  period_date date NOT NULL DEFAULT CURRENT_DATE,
  sessions_started integer NOT NULL DEFAULT 0,
  sessions_completed integer NOT NULL DEFAULT 0,
  sessions_transferred integer NOT NULL DEFAULT 0,
  sessions_cancelled integer NOT NULL DEFAULT 0,
  avg_completion_minutes numeric DEFAULT NULL,
  fields_captured integer NOT NULL DEFAULT 0,
  documents_received integer NOT NULL DEFAULT 0,
  tramites_created integer NOT NULL DEFAULT 0,
  UNIQUE (assistant_id, period_date)
);

ALTER TABLE contact_center_assistant_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and gerentes can view metrics"
  ON contact_center_assistant_metrics FOR SELECT
  TO authenticated
  USING (
    (SELECT rol FROM usuarios WHERE id = auth.uid()) IN ('Administrador', 'Gerente', 'Empleado', 'Ejecutivo')
  );

CREATE POLICY "Service can upsert metrics"
  ON contact_center_assistant_metrics FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT rol FROM usuarios WHERE id = auth.uid()) IN ('Administrador', 'Gerente')
  );

CREATE POLICY "Service can update metrics"
  ON contact_center_assistant_metrics FOR UPDATE
  TO authenticated
  USING (
    (SELECT rol FROM usuarios WHERE id = auth.uid()) IN ('Administrador', 'Gerente')
  )
  WITH CHECK (
    (SELECT rol FROM usuarios WHERE id = auth.uid()) IN ('Administrador', 'Gerente')
  );

-- ============================================================
-- 9. CONVERSATION MODE COLUMN (on contact_center_messages table)
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contact_center_messages' AND column_name = 'automation_mode'
  ) THEN
    ALTER TABLE contact_center_messages ADD COLUMN automation_mode boolean NOT NULL DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contact_center_messages' AND column_name = 'active_session_id'
  ) THEN
    ALTER TABLE contact_center_messages ADD COLUMN active_session_id uuid REFERENCES contact_center_assistant_sessions(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================================
-- 10. CONVERSATION MODE STATE TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS contact_center_conversation_modes (
  agent_user_id uuid PRIMARY KEY REFERENCES usuarios(id) ON DELETE CASCADE,
  mode text NOT NULL DEFAULT 'normal' CHECK (mode IN ('normal', 'automatic')),
  active_session_id uuid REFERENCES contact_center_assistant_sessions(id) ON DELETE SET NULL,
  assigned_assistant_id uuid REFERENCES contact_center_assistants(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES usuarios(id) ON DELETE SET NULL
);

ALTER TABLE contact_center_conversation_modes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view conversation modes"
  ON contact_center_conversation_modes FOR SELECT
  TO authenticated
  USING (
    (SELECT rol FROM usuarios WHERE id = auth.uid()) IN ('Administrador', 'Gerente', 'Empleado', 'Ejecutivo')
  );

CREATE POLICY "Staff can upsert conversation modes"
  ON contact_center_conversation_modes FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT rol FROM usuarios WHERE id = auth.uid()) IN ('Administrador', 'Gerente', 'Empleado', 'Ejecutivo')
  );

CREATE POLICY "Staff can update conversation modes"
  ON contact_center_conversation_modes FOR UPDATE
  TO authenticated
  USING (
    (SELECT rol FROM usuarios WHERE id = auth.uid()) IN ('Administrador', 'Gerente', 'Empleado', 'Ejecutivo')
  )
  WITH CHECK (
    (SELECT rol FROM usuarios WHERE id = auth.uid()) IN ('Administrador', 'Gerente', 'Empleado', 'Ejecutivo')
  );

-- ============================================================
-- 11. INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_cc_assistants_office ON contact_center_assistants(office_id);
CREATE INDEX IF NOT EXISTS idx_cc_assistants_active ON contact_center_assistants(is_active);
CREATE INDEX IF NOT EXISTS idx_cc_assistants_source ON contact_center_assistants(source);
CREATE INDEX IF NOT EXISTS idx_cc_assistant_fields_assistant ON contact_center_assistant_fields(assistant_id);
CREATE INDEX IF NOT EXISTS idx_cc_assistant_sessions_agent ON contact_center_assistant_sessions(agent_user_id);
CREATE INDEX IF NOT EXISTS idx_cc_assistant_sessions_status ON contact_center_assistant_sessions(status);
CREATE INDEX IF NOT EXISTS idx_cc_assistant_sessions_assistant ON contact_center_assistant_sessions(assistant_id);
CREATE INDEX IF NOT EXISTS idx_cc_session_data_session ON contact_center_assistant_session_data(session_id);
CREATE INDEX IF NOT EXISTS idx_cc_events_session ON contact_center_assistant_events(session_id);
CREATE INDEX IF NOT EXISTS idx_cc_events_created ON contact_center_assistant_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cc_documents_session ON contact_center_assistant_documents(session_id);

-- ============================================================
-- 12. UPDATED_AT TRIGGERS
-- ============================================================
CREATE OR REPLACE FUNCTION update_cc_assistant_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cc_assistants_updated_at ON contact_center_assistants;
CREATE TRIGGER trg_cc_assistants_updated_at
  BEFORE UPDATE ON contact_center_assistants
  FOR EACH ROW EXECUTE FUNCTION update_cc_assistant_updated_at();

DROP TRIGGER IF EXISTS trg_cc_sessions_updated_at ON contact_center_assistant_sessions;
CREATE TRIGGER trg_cc_sessions_updated_at
  BEFORE UPDATE ON contact_center_assistant_sessions
  FOR EACH ROW EXECUTE FUNCTION update_cc_assistant_updated_at();
