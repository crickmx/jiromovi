/*
  # Smart Assistant Training System

  Creates the full training infrastructure for MOVI IA smart assistant.

  ## New Tables
  - `smart_assistant_global_settings` — Global config (thresholds, modes, signature)
  - `smart_assistant_intents` — Trainable intent catalog
  - `smart_assistant_training_phrases` — Example phrases per intent
  - `smart_assistant_keywords` — Keywords/synonyms per intent
  - `smart_assistant_analysis_logs` — Analysis history with correction support

  ## Extended
  - Adds missing columns to `contact_center_smart_assistant_settings` for global config

  ## Security
  - RLS on all tables: admin-only write, no public read
*/

-- ─── 1. Global settings table ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS smart_assistant_global_settings (
  id                                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  smart_assistant_global_enabled       boolean NOT NULL DEFAULT true,
  default_enabled_for_new_conversations boolean NOT NULL DEFAULT true,
  mode                                 text NOT NULL DEFAULT 'mixed' CHECK (mode IN ('suggestions_only','automatic','mixed')),
  auto_activate_threshold              numeric NOT NULL DEFAULT 0.85,
  suggest_threshold                    numeric NOT NULL DEFAULT 0.55,
  ignore_threshold                     numeric NOT NULL DEFAULT 0.54,
  pause_on_human_message               boolean NOT NULL DEFAULT true,
  human_pause_minutes                  integer NOT NULL DEFAULT 20,
  stop_on_user_request                 boolean NOT NULL DEFAULT true,
  allow_auto_activate_agents           boolean NOT NULL DEFAULT true,
  allow_internal_suggestions           boolean NOT NULL DEFAULT true,
  minimum_intervention                 boolean NOT NULL DEFAULT true,
  ai_message_signature_enabled         boolean NOT NULL DEFAULT true,
  ai_message_signature_text            text NOT NULL DEFAULT '- 🤖 MOVI IA',
  updated_by                           uuid REFERENCES auth.users(id),
  created_at                           timestamptz NOT NULL DEFAULT now(),
  updated_at                           timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE smart_assistant_global_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can read global settings"
  ON smart_assistant_global_settings FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'Administrador' AND activo = true)
  );

CREATE POLICY "Admin can insert global settings"
  ON smart_assistant_global_settings FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'Administrador' AND activo = true)
  );

CREATE POLICY "Admin can update global settings"
  ON smart_assistant_global_settings FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'Administrador' AND activo = true)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'Administrador' AND activo = true)
  );

-- Seed one default row
INSERT INTO smart_assistant_global_settings DEFAULT VALUES
  ON CONFLICT DO NOTHING;

-- ─── 2. Intents catalog ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS smart_assistant_intents (
  id                                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  intent_key                            text NOT NULL UNIQUE,
  name                                  text NOT NULL,
  description                           text,
  status                                text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  linked_assistant_id                   uuid REFERENCES contact_center_assistants(id) ON DELETE SET NULL,
  linked_form_slug                      text,
  auto_activation_allowed               boolean NOT NULL DEFAULT true,
  requires_confirmation_below_threshold boolean NOT NULL DEFAULT false,
  priority                              integer NOT NULL DEFAULT 10,
  created_at                            timestamptz NOT NULL DEFAULT now(),
  updated_at                            timestamptz NOT NULL DEFAULT now(),
  created_by                            uuid REFERENCES auth.users(id),
  updated_by                            uuid REFERENCES auth.users(id)
);

ALTER TABLE smart_assistant_intents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can read intents"
  ON smart_assistant_intents FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'Administrador' AND activo = true)
  );

CREATE POLICY "Admin can insert intents"
  ON smart_assistant_intents FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'Administrador' AND activo = true)
  );

CREATE POLICY "Admin can update intents"
  ON smart_assistant_intents FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'Administrador' AND activo = true)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'Administrador' AND activo = true)
  );

CREATE POLICY "Admin can delete intents"
  ON smart_assistant_intents FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'Administrador' AND activo = true)
  );

-- Service role access for edge functions
CREATE POLICY "Service role full access intents"
  ON smart_assistant_intents FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ─── 3. Training phrases ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS smart_assistant_training_phrases (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  intent_id  uuid NOT NULL REFERENCES smart_assistant_intents(id) ON DELETE CASCADE,
  phrase     text NOT NULL,
  weight     numeric NOT NULL DEFAULT 1.0,
  status     text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_training_phrases_intent ON smart_assistant_training_phrases(intent_id);

ALTER TABLE smart_assistant_training_phrases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can read phrases"
  ON smart_assistant_training_phrases FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'Administrador' AND activo = true)
  );

CREATE POLICY "Admin can insert phrases"
  ON smart_assistant_training_phrases FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'Administrador' AND activo = true)
  );

CREATE POLICY "Admin can update phrases"
  ON smart_assistant_training_phrases FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'Administrador' AND activo = true)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'Administrador' AND activo = true)
  );

CREATE POLICY "Admin can delete phrases"
  ON smart_assistant_training_phrases FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'Administrador' AND activo = true)
  );

CREATE POLICY "Service role full access phrases"
  ON smart_assistant_training_phrases FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ─── 4. Keywords ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS smart_assistant_keywords (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  intent_id  uuid NOT NULL REFERENCES smart_assistant_intents(id) ON DELETE CASCADE,
  keyword    text NOT NULL,
  weight     numeric NOT NULL DEFAULT 1.0,
  status     text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_keywords_intent ON smart_assistant_keywords(intent_id);

ALTER TABLE smart_assistant_keywords ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can read keywords"
  ON smart_assistant_keywords FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'Administrador' AND activo = true)
  );

CREATE POLICY "Admin can insert keywords"
  ON smart_assistant_keywords FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'Administrador' AND activo = true)
  );

CREATE POLICY "Admin can update keywords"
  ON smart_assistant_keywords FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'Administrador' AND activo = true)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'Administrador' AND activo = true)
  );

CREATE POLICY "Admin can delete keywords"
  ON smart_assistant_keywords FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'Administrador' AND activo = true)
  );

CREATE POLICY "Service role full access keywords"
  ON smart_assistant_keywords FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ─── 5. Analysis logs ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS smart_assistant_analysis_logs (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id      text,
  agent_user_id        uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  message_id           text,
  message_text         text NOT NULL,
  detected_intent      text,
  confidence           numeric,
  action_taken         text,
  matched_assistant_id uuid REFERENCES contact_center_assistants(id) ON DELETE SET NULL,
  matched_form_slug    text,
  reason               text,
  was_correct          boolean,
  corrected_intent_id  uuid REFERENCES smart_assistant_intents(id) ON DELETE SET NULL,
  created_at           timestamptz NOT NULL DEFAULT now(),
  reviewed_at          timestamptz,
  reviewed_by          uuid REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_analysis_logs_agent ON smart_assistant_analysis_logs(agent_user_id);
CREATE INDEX IF NOT EXISTS idx_analysis_logs_created ON smart_assistant_analysis_logs(created_at DESC);

ALTER TABLE smart_assistant_analysis_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can read analysis logs"
  ON smart_assistant_analysis_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'Administrador' AND activo = true)
  );

CREATE POLICY "Admin can update analysis logs"
  ON smart_assistant_analysis_logs FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'Administrador' AND activo = true)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'Administrador' AND activo = true)
  );

CREATE POLICY "Service role full access logs"
  ON smart_assistant_analysis_logs FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ─── 6. Seed initial intents ─────────────────────────────────────────────────

INSERT INTO smart_assistant_intents (intent_key, name, description, priority, auto_activation_allowed) VALUES
  ('cotizacion_auto',        'Cotizacion Auto',         'El contacto quiere cotizar o asegurar un auto/vehiculo', 10, true),
  ('cotizacion_gmm',         'Cotizacion GMM',          'El contacto quiere cotizar gastos medicos mayores o seguro de salud', 10, true),
  ('cotizacion_vida',        'Cotizacion Vida',         'El contacto quiere cotizar un seguro de vida', 10, true),
  ('cotizacion_hogar',       'Cotizacion Hogar',        'El contacto quiere asegurar su casa o departamento', 10, true),
  ('cotizacion_empresarial', 'Cotizacion Empresarial',  'El contacto quiere asegurar su negocio o empresa', 10, true),
  ('cotizacion_fianzas',     'Cotizacion Fianzas',      'El contacto necesita una fianza o garantia', 10, true),
  ('siniestro_auto',         'Siniestro Auto',          'El contacto quiere reportar un siniestro de auto', 20, true),
  ('siniestro_general',      'Siniestro General',       'El contacto quiere reportar un siniestro general', 20, true),
  ('renovacion_poliza',      'Renovacion de Poliza',    'El contacto quiere renovar su poliza', 15, true),
  ('consulta_poliza',        'Consulta de Poliza',      'El contacto quiere consultar su poliza', 25, false),
  ('consulta_pago',          'Consulta de Pago',        'El contacto quiere consultar pagos o cobros', 25, false),
  ('solicitud_endoso',       'Solicitud de Endoso',     'El contacto solicita un endoso o modificacion', 20, true),
  ('cancelacion_poliza',     'Cancelacion de Poliza',   'El contacto quiere cancelar su poliza', 15, false),
  ('hablar_con_persona',     'Hablar con Persona',      'El contacto quiere ser atendido por una persona', 1,  false),
  ('detener_asistente',      'Detener Asistente',       'El contacto quiere detener el bot', 1,  false),
  ('mensaje_social',         'Mensaje Social',          'Saludos, agradecimientos, mensajes sin intencion operativa', 30, false),
  ('sin_intencion_operativa','Sin Intencion Operativa', 'Mensaje sin intencion detectada', 99, false)
ON CONFLICT (intent_key) DO NOTHING;

-- ─── 7. Seed training phrases ────────────────────────────────────────────────

DO $$
DECLARE
  v_auto_id        uuid;
  v_gmm_id         uuid;
  v_vida_id        uuid;
  v_hogar_id       uuid;
  v_empresarial_id uuid;
  v_fianzas_id     uuid;
  v_siniestro_auto_id uuid;
  v_siniestro_gen_id  uuid;
  v_renovacion_id  uuid;
  v_hablar_id      uuid;
  v_detener_id     uuid;
  v_social_id      uuid;
BEGIN
  SELECT id INTO v_auto_id        FROM smart_assistant_intents WHERE intent_key = 'cotizacion_auto';
  SELECT id INTO v_gmm_id         FROM smart_assistant_intents WHERE intent_key = 'cotizacion_gmm';
  SELECT id INTO v_vida_id        FROM smart_assistant_intents WHERE intent_key = 'cotizacion_vida';
  SELECT id INTO v_hogar_id       FROM smart_assistant_intents WHERE intent_key = 'cotizacion_hogar';
  SELECT id INTO v_empresarial_id FROM smart_assistant_intents WHERE intent_key = 'cotizacion_empresarial';
  SELECT id INTO v_fianzas_id     FROM smart_assistant_intents WHERE intent_key = 'cotizacion_fianzas';
  SELECT id INTO v_siniestro_auto_id FROM smart_assistant_intents WHERE intent_key = 'siniestro_auto';
  SELECT id INTO v_siniestro_gen_id  FROM smart_assistant_intents WHERE intent_key = 'siniestro_general';
  SELECT id INTO v_renovacion_id  FROM smart_assistant_intents WHERE intent_key = 'renovacion_poliza';
  SELECT id INTO v_hablar_id      FROM smart_assistant_intents WHERE intent_key = 'hablar_con_persona';
  SELECT id INTO v_detener_id     FROM smart_assistant_intents WHERE intent_key = 'detener_asistente';
  SELECT id INTO v_social_id      FROM smart_assistant_intents WHERE intent_key = 'mensaje_social';

  INSERT INTO smart_assistant_training_phrases (intent_id, phrase) VALUES
    (v_auto_id, 'quiero cotizar mi auto'),
    (v_auto_id, 'me cotizas mi coche'),
    (v_auto_id, 'quiero asegurar mi carro'),
    (v_auto_id, 'busco seguro para mi camioneta'),
    (v_auto_id, 'cuanto cuesta asegurar un auto'),
    (v_auto_id, 'necesito poliza para mi vehiculo'),
    (v_auto_id, 'quiero un seguro de auto'),
    (v_auto_id, 'cotizame un seguro para mi carro'),
    (v_gmm_id, 'quiero seguro de gastos medicos'),
    (v_gmm_id, 'necesito cotizar gastos medicos mayores'),
    (v_gmm_id, 'busco seguro medico'),
    (v_gmm_id, 'quiero asegurar a mi familia con gmm'),
    (v_gmm_id, 'quiero un seguro de salud'),
    (v_gmm_id, 'cotizame seguro medico mayor'),
    (v_gmm_id, 'cuanto cuesta el seguro de gastos medicos'),
    (v_vida_id, 'quiero seguro de vida'),
    (v_vida_id, 'necesito cotizar vida'),
    (v_vida_id, 'busco proteccion para mi familia'),
    (v_vida_id, 'quiero una poliza de vida'),
    (v_vida_id, 'cotizame un seguro de vida'),
    (v_hogar_id, 'quiero asegurar mi casa'),
    (v_hogar_id, 'busco seguro de hogar'),
    (v_hogar_id, 'necesito seguro para mi departamento'),
    (v_hogar_id, 'quiero proteger mi vivienda'),
    (v_hogar_id, 'cotizame seguro para mi casa'),
    (v_empresarial_id, 'quiero asegurar mi negocio'),
    (v_empresarial_id, 'necesito seguro para mi empresa'),
    (v_empresarial_id, 'busco seguro para mi local'),
    (v_empresarial_id, 'quiero cotizar responsabilidad civil'),
    (v_empresarial_id, 'quiero proteger mi bodega'),
    (v_empresarial_id, 'seguro para mi comercio'),
    (v_fianzas_id, 'necesito una fianza'),
    (v_fianzas_id, 'quiero cotizar una fianza'),
    (v_fianzas_id, 'me piden fianza para un contrato'),
    (v_fianzas_id, 'necesito garantizar una obligacion'),
    (v_siniestro_auto_id, 'quiero reportar un siniestro'),
    (v_siniestro_auto_id, 'tuve un choque'),
    (v_siniestro_auto_id, 'necesito reportar un accidente'),
    (v_siniestro_auto_id, 'me chocaron'),
    (v_siniestro_gen_id, 'tuve un problema con mi poliza'),
    (v_siniestro_gen_id, 'quiero reportar un siniestro general'),
    (v_renovacion_id, 'quiero renovar mi poliza'),
    (v_renovacion_id, 'mi seguro vence pronto'),
    (v_renovacion_id, 'necesito renovar mi seguro'),
    (v_hablar_id, 'quiero hablar con una persona'),
    (v_hablar_id, 'me atiende alguien'),
    (v_hablar_id, 'quiero un asesor'),
    (v_hablar_id, 'prefiero hablar con ejecutivo'),
    (v_detener_id, 'no quiero bot'),
    (v_detener_id, 'deten el bot'),
    (v_detener_id, 'para el asistente'),
    (v_social_id, 'hola'),
    (v_social_id, 'buenos dias'),
    (v_social_id, 'gracias'),
    (v_social_id, 'ok'),
    (v_social_id, 'perfecto'),
    (v_social_id, 'de acuerdo')
  ON CONFLICT DO NOTHING;

  INSERT INTO smart_assistant_keywords (intent_id, keyword) VALUES
    (v_auto_id, 'auto'), (v_auto_id, 'coche'), (v_auto_id, 'carro'), (v_auto_id, 'camioneta'), (v_auto_id, 'vehiculo'), (v_auto_id, 'moto'),
    (v_gmm_id, 'gastos medicos'), (v_gmm_id, 'gmm'), (v_gmm_id, 'medico'), (v_gmm_id, 'salud'), (v_gmm_id, 'hospital'),
    (v_vida_id, 'vida'), (v_vida_id, 'fallecimiento'), (v_vida_id, 'proteccion familiar'),
    (v_hogar_id, 'casa'), (v_hogar_id, 'hogar'), (v_hogar_id, 'departamento'), (v_hogar_id, 'vivienda'),
    (v_empresarial_id, 'negocio'), (v_empresarial_id, 'empresa'), (v_empresarial_id, 'local'), (v_empresarial_id, 'bodega'), (v_empresarial_id, 'comercio'), (v_empresarial_id, 'responsabilidad civil'),
    (v_fianzas_id, 'fianza'), (v_fianzas_id, 'garantia'), (v_fianzas_id, 'contrato'),
    (v_siniestro_auto_id, 'choque'), (v_siniestro_auto_id, 'accidente'), (v_siniestro_auto_id, 'siniestro'), (v_siniestro_auto_id, 'reportar'),
    (v_renovacion_id, 'renovar'), (v_renovacion_id, 'vence'), (v_renovacion_id, 'vencimiento'),
    (v_hablar_id, 'persona'), (v_hablar_id, 'asesor'), (v_hablar_id, 'ejecutivo'), (v_hablar_id, 'humano'),
    (v_detener_id, 'detener'), (v_detener_id, 'parar'), (v_detener_id, 'bot'), (v_detener_id, 'no quiero bot')
  ON CONFLICT DO NOTHING;

END $$;
