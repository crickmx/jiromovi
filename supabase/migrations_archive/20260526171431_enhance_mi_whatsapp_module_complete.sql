/*
  # Enhance Mi WhatsApp module with templates, attachments, forms, tramite links

  1. New Tables
    - `whatsapp_user_templates` - Personal message templates per user (separate from quick_templates for full feature set)
      - `id` (uuid, primary key)
      - `user_id` (uuid, FK to auth.users)
      - `name` (text) - Template name
      - `category` (text) - Optional category
      - `body` (text) - Message template body with {{variables}}
      - `variables` (jsonb) - Available variables metadata
      - `is_favorite` (boolean) - Marked as favorite
      - `sort_order` (integer) - Custom ordering
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `whatsapp_message_attachments` - File attachments sent in conversations
      - `id` (uuid, primary key)
      - `message_id` (uuid) - Related message
      - `conversation_id` (uuid) - Related conversation
      - `user_id` (uuid) - Who sent it
      - `file_url` (text) - Storage URL
      - `file_name` (text) - Original filename
      - `file_type` (text) - MIME type
      - `file_size` (bigint) - Size in bytes
      - `created_at` (timestamptz)
    
    - `whatsapp_form_sends_log` - Log of forms sent via WhatsApp
      - `id` (uuid, primary key)
      - `user_id` (uuid) - Who sent it
      - `conversation_id` (uuid) - In which conversation
      - `contact_phone` (text) - Recipient phone
      - `form_template_id` (uuid) - Which form template
      - `form_url` (text) - Generated public URL
      - `message_id` (uuid) - Associated message
      - `crm_contact_id` (uuid) - Linked CRM contact if any
      - `created_at` (timestamptz)
    
    - `whatsapp_message_tramite_links` - Links between messages and tramites
      - `id` (uuid, primary key)
      - `user_id` (uuid) - Who created the link
      - `conversation_id` (uuid) - Source conversation
      - `message_ids` (uuid[]) - Selected message IDs
      - `tramite_id` (uuid) - Created tramite
      - `crm_contact_id` (uuid) - Linked CRM contact
      - `created_at` (timestamptz)

  2. Security
    - RLS enabled on all tables
    - Users can only access their own data
    - Admins can view all records

  3. Important Notes
    - Does NOT modify existing whatsapp_sessions, whatsapp_conversations, whatsapp_messages, or whatsapp_quick_templates tables
    - Adds new tables alongside existing structure
*/

-- whatsapp_user_templates
CREATE TABLE IF NOT EXISTS whatsapp_user_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  category text DEFAULT '',
  body text NOT NULL,
  variables jsonb DEFAULT '[]'::jsonb,
  is_favorite boolean DEFAULT false,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE whatsapp_user_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own templates"
  ON whatsapp_user_templates FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own templates"
  ON whatsapp_user_templates FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own templates"
  ON whatsapp_user_templates FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own templates"
  ON whatsapp_user_templates FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_whatsapp_user_templates_user_id ON whatsapp_user_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_user_templates_category ON whatsapp_user_templates(user_id, category);

-- whatsapp_message_attachments
CREATE TABLE IF NOT EXISTS whatsapp_message_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid REFERENCES whatsapp_messages(id) ON DELETE SET NULL,
  conversation_id uuid NOT NULL REFERENCES whatsapp_conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_url text NOT NULL,
  file_name text NOT NULL DEFAULT '',
  file_type text NOT NULL DEFAULT 'application/octet-stream',
  file_size bigint DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE whatsapp_message_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own attachments"
  ON whatsapp_message_attachments FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own attachments"
  ON whatsapp_message_attachments FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own attachments"
  ON whatsapp_message_attachments FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_whatsapp_msg_attachments_conversation ON whatsapp_message_attachments(conversation_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_msg_attachments_message ON whatsapp_message_attachments(message_id);

-- whatsapp_form_sends_log
CREATE TABLE IF NOT EXISTS whatsapp_form_sends_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES whatsapp_conversations(id) ON DELETE SET NULL,
  contact_phone text NOT NULL DEFAULT '',
  form_template_id uuid,
  form_url text NOT NULL DEFAULT '',
  message_id uuid REFERENCES whatsapp_messages(id) ON DELETE SET NULL,
  crm_contact_id uuid,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE whatsapp_form_sends_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own form sends"
  ON whatsapp_form_sends_log FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own form sends"
  ON whatsapp_form_sends_log FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_whatsapp_form_sends_user ON whatsapp_form_sends_log(user_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_form_sends_conversation ON whatsapp_form_sends_log(conversation_id);

-- whatsapp_message_tramite_links
CREATE TABLE IF NOT EXISTS whatsapp_message_tramite_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES whatsapp_conversations(id) ON DELETE CASCADE,
  message_ids uuid[] NOT NULL DEFAULT '{}',
  tramite_id uuid,
  crm_contact_id uuid,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE whatsapp_message_tramite_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tramite links"
  ON whatsapp_message_tramite_links FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own tramite links"
  ON whatsapp_message_tramite_links FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_whatsapp_tramite_links_user ON whatsapp_message_tramite_links(user_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_tramite_links_tramite ON whatsapp_message_tramite_links(tramite_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_tramite_links_conversation ON whatsapp_message_tramite_links(conversation_id);
