/*
  # Chava Agente — Create acceptance log table and ensure policies
*/

CREATE TABLE IF NOT EXISTS chava_agente_user_terms (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chava_user_id   uuid NOT NULL REFERENCES chava_agente_users(id) ON DELETE CASCADE,
  terms_id        uuid REFERENCES chava_agente_terms(id) ON DELETE SET NULL,
  version         text NOT NULL,
  accepted_at     timestamptz NOT NULL DEFAULT now(),
  ip_address      text,
  UNIQUE (chava_user_id, version)
);

ALTER TABLE chava_agente_user_terms ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'ca_user_terms_select_own' AND tablename = 'chava_agente_user_terms'
  ) THEN
    CREATE POLICY "ca_user_terms_select_own"
      ON chava_agente_user_terms FOR SELECT
      TO authenticated
      USING (
        chava_user_id IN (
          SELECT id FROM chava_agente_users WHERE auth_user_id = auth.uid()
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'ca_user_terms_insert_own' AND tablename = 'chava_agente_user_terms'
  ) THEN
    CREATE POLICY "ca_user_terms_insert_own"
      ON chava_agente_user_terms FOR INSERT
      TO authenticated
      WITH CHECK (
        chava_user_id IN (
          SELECT id FROM chava_agente_users WHERE auth_user_id = auth.uid()
        )
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_ca_users_auth_id ON chava_agente_users(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_ca_users_email ON chava_agente_users(email);
CREATE INDEX IF NOT EXISTS idx_ca_conv_user ON chava_agente_conversations(chava_user_id);
CREATE INDEX IF NOT EXISTS idx_ca_msg_conv ON chava_agente_messages(conversation_id, created_at);
