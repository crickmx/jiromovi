/*
  # Create Mi WhatsApp Personal Sessions Module

  1. New Tables
    - `whatsapp_sessions` — Stores per-user WhatsApp session state
      - `id` (uuid, primary key)
      - `user_id` (uuid, FK to auth.users) — owner of this session
      - `status` (text) — connected, disconnected, connecting, error, qr_pending
      - `phone_number` (text, nullable) — phone number once connected
      - `device_name` (text, nullable) — device info from WhatsApp
      - `connected_at` (timestamptz, nullable) — when session was established
      - `disconnected_at` (timestamptz, nullable) — last disconnection time
      - `last_activity_at` (timestamptz, nullable) — last message sent/received
      - `session_data` (jsonb, nullable) — encrypted session credentials (server-side only)
      - `error_message` (text, nullable) — last error description
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `whatsapp_conversations` — Conversations per user
      - `id` (uuid, primary key)
      - `user_id` (uuid, FK to auth.users) — owner
      - `session_id` (uuid, FK to whatsapp_sessions)
      - `remote_phone` (text) — other party's phone number
      - `remote_name` (text, nullable) — contact name from WhatsApp
      - `remote_avatar_url` (text, nullable)
      - `last_message_text` (text, nullable)
      - `last_message_at` (timestamptz, nullable)
      - `unread_count` (integer, default 0)
      - `is_group` (boolean, default false)
      - `group_name` (text, nullable)
      - `crm_contact_id` (uuid, nullable) — link to CRM
      - `tramite_id` (uuid, nullable) — link to tramite
      - `tags` (text[], default '{}')
      - `is_archived` (boolean, default false)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `whatsapp_messages` — Message history per conversation
      - `id` (uuid, primary key)
      - `conversation_id` (uuid, FK to whatsapp_conversations)
      - `user_id` (uuid, FK to auth.users) — owner of the conversation
      - `direction` (text) — inbound or outbound
      - `message_type` (text) — text, image, document, audio, video, sticker, location
      - `content` (text, nullable) — message body
      - `media_url` (text, nullable) — attachment URL
      - `media_mime_type` (text, nullable)
      - `media_filename` (text, nullable)
      - `wa_message_id` (text, nullable) — WhatsApp's message ID
      - `status` (text, default 'sent') — sent, delivered, read, failed
      - `is_internal_note` (boolean, default false) — MOVI-only notes
      - `metadata` (jsonb, nullable)
      - `created_at` (timestamptz)

    - `whatsapp_quick_templates` — User-defined quick reply templates
      - `id` (uuid, primary key)
      - `user_id` (uuid, FK to auth.users)
      - `name` (text) — template name
      - `content` (text) — template body with variables
      - `category` (text, nullable) — grouping category
      - `sort_order` (integer, default 0)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `whatsapp_audit_log` — Security audit trail
      - `id` (uuid, primary key)
      - `user_id` (uuid, FK to auth.users) — who performed the action
      - `action` (text) — connect, disconnect, error, admin_view, send_message
      - `details` (jsonb, nullable) — extra context
      - `ip_address` (text, nullable)
      - `created_at` (timestamptz)

  2. Security
    - RLS enabled on all tables
    - Users can only access their own data
    - Admins can view session status (not conversations) for monitoring
    - Audit log writable by all, readable by admins

  3. Indexes
    - whatsapp_sessions: user_id (unique active session per user)
    - whatsapp_conversations: user_id, last_message_at, remote_phone
    - whatsapp_messages: conversation_id, created_at
    - whatsapp_quick_templates: user_id
*/

-- ══════════════════════════════════════════════════════════════════
-- Table: whatsapp_sessions
-- ══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS whatsapp_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'disconnected' CHECK (status IN ('connected', 'disconnected', 'connecting', 'error', 'qr_pending')),
  phone_number text,
  device_name text,
  connected_at timestamptz,
  disconnected_at timestamptz,
  last_activity_at timestamptz,
  session_data jsonb,
  error_message text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_sessions_user_id ON whatsapp_sessions(user_id);

ALTER TABLE whatsapp_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own session"
  ON whatsapp_sessions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own session"
  ON whatsapp_sessions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own session"
  ON whatsapp_sessions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all session statuses"
  ON whatsapp_sessions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND u.rol = 'Administrador'
      AND u.activo = true
    )
  );

-- ══════════════════════════════════════════════════════════════════
-- Table: whatsapp_conversations
-- ══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS whatsapp_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES whatsapp_sessions(id) ON DELETE CASCADE,
  remote_phone text NOT NULL,
  remote_name text,
  remote_avatar_url text,
  last_message_text text,
  last_message_at timestamptz,
  unread_count integer NOT NULL DEFAULT 0,
  is_group boolean NOT NULL DEFAULT false,
  group_name text,
  crm_contact_id uuid,
  tramite_id uuid,
  tags text[] NOT NULL DEFAULT '{}',
  is_archived boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_user_id ON whatsapp_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_last_msg ON whatsapp_conversations(user_id, last_message_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_phone ON whatsapp_conversations(user_id, remote_phone);

ALTER TABLE whatsapp_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own conversations"
  ON whatsapp_conversations FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own conversations"
  ON whatsapp_conversations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own conversations"
  ON whatsapp_conversations FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own conversations"
  ON whatsapp_conversations FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ══════════════════════════════════════════════════════════════════
-- Table: whatsapp_messages
-- ══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES whatsapp_conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  direction text NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  message_type text NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'document', 'audio', 'video', 'sticker', 'location', 'contact')),
  content text,
  media_url text,
  media_mime_type text,
  media_filename text,
  wa_message_id text,
  status text NOT NULL DEFAULT 'sent' CHECK (status IN ('pending', 'sent', 'delivered', 'read', 'failed')),
  is_internal_note boolean NOT NULL DEFAULT false,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_conversation ON whatsapp_messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_user ON whatsapp_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_wa_id ON whatsapp_messages(wa_message_id) WHERE wa_message_id IS NOT NULL;

ALTER TABLE whatsapp_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own messages"
  ON whatsapp_messages FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own messages"
  ON whatsapp_messages FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own messages"
  ON whatsapp_messages FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ══════════════════════════════════════════════════════════════════
-- Table: whatsapp_quick_templates
-- ══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS whatsapp_quick_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  content text NOT NULL,
  category text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_quick_templates_user ON whatsapp_quick_templates(user_id);

ALTER TABLE whatsapp_quick_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own templates"
  ON whatsapp_quick_templates FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own templates"
  ON whatsapp_quick_templates FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own templates"
  ON whatsapp_quick_templates FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own templates"
  ON whatsapp_quick_templates FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ══════════════════════════════════════════════════════════════════
-- Table: whatsapp_audit_log
-- ══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS whatsapp_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('connect', 'disconnect', 'error', 'admin_view', 'send_message', 'qr_generated', 'session_expired')),
  details jsonb,
  ip_address text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_audit_log_user ON whatsapp_audit_log(user_id, created_at DESC);

ALTER TABLE whatsapp_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own audit entries"
  ON whatsapp_audit_log FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own audit entries"
  ON whatsapp_audit_log FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all audit entries"
  ON whatsapp_audit_log FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND u.rol = 'Administrador'
      AND u.activo = true
    )
  );

-- ══════════════════════════════════════════════════════════════════
-- Trigger: auto-update updated_at
-- ══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION update_whatsapp_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_whatsapp_sessions_updated_at') THEN
    CREATE TRIGGER trg_whatsapp_sessions_updated_at
      BEFORE UPDATE ON whatsapp_sessions
      FOR EACH ROW EXECUTE FUNCTION update_whatsapp_updated_at();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_whatsapp_conversations_updated_at') THEN
    CREATE TRIGGER trg_whatsapp_conversations_updated_at
      BEFORE UPDATE ON whatsapp_conversations
      FOR EACH ROW EXECUTE FUNCTION update_whatsapp_updated_at();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_whatsapp_quick_templates_updated_at') THEN
    CREATE TRIGGER trg_whatsapp_quick_templates_updated_at
      BEFORE UPDATE ON whatsapp_quick_templates
      FOR EACH ROW EXECUTE FUNCTION update_whatsapp_updated_at();
  END IF;
END $$;
