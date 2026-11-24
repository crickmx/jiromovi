/*
  # Smart Assistant Response Templates & Conversation State Enhancements

  ## Summary
  Adds configurable response message templates to the smart assistant system
  and enhances the global settings with response templates that administrators
  can customize from the training module.

  ## New Columns on smart_assistant_global_settings
  - `response_first_message` — First message sent when auto-activating an agent
  - `response_stop_message` — Message sent when contact requests human
  - `response_form_sent_message` — Message sent after sharing a form link
  - `response_option_unclear` — Retry message when user choice is unclear

  ## New Table
  - `smart_assistant_conversation_state` — Per-conversation runtime state for
    tracking active agent, pause status, and last analysis results. Used by
    the wazzup-webhook to know when to trigger smart assistant analysis.

  ## Security
  - RLS on new table: authenticated users read own, service role full access
*/

-- ─── 1. Add response templates to global settings ───────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'smart_assistant_global_settings' AND column_name = 'response_first_message'
  ) THEN
    ALTER TABLE smart_assistant_global_settings
      ADD COLUMN response_first_message text NOT NULL DEFAULT 'Hola, puedo ayudarte de dos formas:
1. Llenar el formulario en línea
2. Responder las preguntas por aquí
¿Qué prefieres?';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'smart_assistant_global_settings' AND column_name = 'response_stop_message'
  ) THEN
    ALTER TABLE smart_assistant_global_settings
      ADD COLUMN response_stop_message text NOT NULL DEFAULT 'Claro, {{nombre_responsable}} te atenderá por este medio.';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'smart_assistant_global_settings' AND column_name = 'response_form_sent_message'
  ) THEN
    ALTER TABLE smart_assistant_global_settings
      ADD COLUMN response_form_sent_message text NOT NULL DEFAULT 'Perfecto, puedes llenar el formulario aquí:
{{link_formulario}}
Cuando lo envíes, {{nombre_responsable}} dará seguimiento a tu solicitud.';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'smart_assistant_global_settings' AND column_name = 'response_option_unclear'
  ) THEN
    ALTER TABLE smart_assistant_global_settings
      ADD COLUMN response_option_unclear text NOT NULL DEFAULT '¿Prefieres llenar el formulario en línea o responder por aquí?';
  END IF;
END $$;

-- ─── 2. Smart Assistant Conversation State (runtime tracking) ────────────────

CREATE TABLE IF NOT EXISTS smart_assistant_conversation_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_user_id uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  contact_phone text,
  -- Runtime state
  smart_assistant_enabled boolean NOT NULL DEFAULT true,
  smart_assistant_status text NOT NULL DEFAULT 'active'
    CHECK (smart_assistant_status IN (
      'active', 'inactive', 'paused', 'waiting_internal_confirmation',
      'automatic_agent_active', 'stopped_by_contact', 'stopped_by_user', 'paused_by_human'
    )),
  -- Last analysis
  last_analysis_at timestamptz,
  last_action_at timestamptz,
  last_processed_message_id text,
  -- Pause
  paused_until timestamptz,
  pause_reason text,
  -- Active agent
  active_automatic_agent_id uuid REFERENCES contact_center_assistants(id),
  active_session_id uuid,
  -- Detection
  last_detected_intent text,
  last_confidence numeric,
  -- Metadata
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(agent_user_id, contact_phone)
);

ALTER TABLE smart_assistant_conversation_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Conversation state — authenticated read own or admin"
  ON smart_assistant_conversation_state FOR SELECT
  TO authenticated
  USING (
    agent_user_id = auth.uid() OR
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol IN ('Administrador', 'Gerente'))
  );

CREATE POLICY "Conversation state — authenticated insert"
  ON smart_assistant_conversation_state FOR INSERT
  TO authenticated
  WITH CHECK (
    agent_user_id = auth.uid() OR
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol IN ('Administrador', 'Gerente'))
  );

CREATE POLICY "Conversation state — authenticated update own or admin"
  ON smart_assistant_conversation_state FOR UPDATE
  TO authenticated
  USING (
    agent_user_id = auth.uid() OR
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol IN ('Administrador', 'Gerente'))
  )
  WITH CHECK (
    agent_user_id = auth.uid() OR
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol IN ('Administrador', 'Gerente'))
  );

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_smart_conv_state_agent_phone
  ON smart_assistant_conversation_state(agent_user_id, contact_phone);

-- ─── 3. Add service role policies (edge functions bypass RLS but for safety) ─

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'smart_assistant_global_settings' AND policyname = 'Service role full access global settings'
  ) THEN
    CREATE POLICY "Service role full access global settings"
      ON smart_assistant_global_settings FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'smart_assistant_conversation_state' AND policyname = 'Service role full access conversation state'
  ) THEN
    CREATE POLICY "Service role full access conversation state"
      ON smart_assistant_conversation_state FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- Also make smart_assistant_intents readable by service_role for the edge function
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'smart_assistant_intents' AND policyname = 'Service role full access intents'
  ) THEN
    CREATE POLICY "Service role full access intents"
      ON smart_assistant_intents FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'smart_assistant_training_phrases' AND policyname = 'Service role full access phrases'
  ) THEN
    CREATE POLICY "Service role full access phrases"
      ON smart_assistant_training_phrases FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'smart_assistant_keywords' AND policyname = 'Service role full access keywords'
  ) THEN
    CREATE POLICY "Service role full access keywords"
      ON smart_assistant_keywords FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'smart_assistant_analysis_logs' AND policyname = 'Service role full access analysis logs'
  ) THEN
    CREATE POLICY "Service role full access analysis logs"
      ON smart_assistant_analysis_logs FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;
