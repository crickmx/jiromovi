/*
  # Create Contact Center Module

  1. New Tables
    - `contact_center_messages`
      - `id` (uuid, primary key)
      - `agent_user_id` (uuid, FK to usuarios) - the agent receiving the message
      - `sender_user_id` (uuid, FK to usuarios, nullable) - internal user who sent, null if system
      - `sender_type` (text) - 'user' or 'system'
      - `channel` (text) - 'whatsapp', 'email', 'system'
      - `message_type` (text) - 'manual' or 'automatic'
      - `direction` (text) - 'outbound' or 'inbound'
      - `subject` (text, nullable) - email subject
      - `body` (text) - message content
      - `html_body` (text, nullable) - HTML body for emails
      - `status` (text) - pending/sent/delivered/read/failed
      - `provider` (text) - 'wazzup', 'resend', 'internal'
      - `provider_message_id` (text, nullable)
      - `provider_response` (jsonb, nullable)
      - `error_message` (text, nullable)
      - `source_module` (text, nullable) - which module triggered automatic msg
      - `source_event` (text, nullable) - event that triggered it
      - `template_id` (uuid, nullable) - template used if any
      - `attachment_urls` (jsonb, nullable)
      - `metadata` (jsonb, nullable)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
      - `read_at` (timestamptz, nullable) - when internal user read the thread

  2. Functions
    - `get_contact_center_summary` - returns conversation summaries grouped by agent

  3. Security
    - Enable RLS on `contact_center_messages`
    - Admin can see all messages
    - Gerente can see messages for agents in their office
    - Empleado can see messages for agents in their office
    - Agents cannot access this table

  4. Indexes
    - Index on agent_user_id for fast lookups
    - Index on created_at for chronological ordering
    - Index on channel for filtering
    - Index on status for filtering
    - Composite index on (agent_user_id, created_at) for conversation threads
*/

-- Create the main messages table
CREATE TABLE IF NOT EXISTS contact_center_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_user_id uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  sender_user_id uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  sender_type text NOT NULL DEFAULT 'user' CHECK (sender_type IN ('user', 'system')),
  channel text NOT NULL CHECK (channel IN ('whatsapp', 'email', 'system')),
  message_type text NOT NULL DEFAULT 'manual' CHECK (message_type IN ('manual', 'automatic')),
  direction text NOT NULL DEFAULT 'outbound' CHECK (direction IN ('outbound', 'inbound')),
  subject text,
  body text NOT NULL DEFAULT '',
  html_body text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'read', 'failed', 'cancelled')),
  provider text CHECK (provider IN ('wazzup', 'resend', 'internal')),
  provider_message_id text,
  provider_response jsonb,
  error_message text,
  source_module text,
  source_event text,
  template_id uuid,
  attachment_urls jsonb DEFAULT '[]'::jsonb,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz
);

-- Enable RLS
ALTER TABLE contact_center_messages ENABLE ROW LEVEL SECURITY;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_ccm_agent_user_id ON contact_center_messages(agent_user_id);
CREATE INDEX IF NOT EXISTS idx_ccm_created_at ON contact_center_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ccm_channel ON contact_center_messages(channel);
CREATE INDEX IF NOT EXISTS idx_ccm_status ON contact_center_messages(status);
CREATE INDEX IF NOT EXISTS idx_ccm_agent_created ON contact_center_messages(agent_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ccm_message_type ON contact_center_messages(message_type);
CREATE INDEX IF NOT EXISTS idx_ccm_sender ON contact_center_messages(sender_user_id);

-- RLS Policies

-- Admins can see all messages
CREATE POLICY "Admins can view all contact center messages"
  ON contact_center_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

-- Gerentes can see messages for agents in their office
CREATE POLICY "Gerentes can view office contact center messages"
  ON contact_center_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u_self
      WHERE u_self.id = auth.uid()
      AND u_self.rol = 'Gerente'
      AND EXISTS (
        SELECT 1 FROM usuarios u_agent
        WHERE u_agent.id = contact_center_messages.agent_user_id
        AND u_agent.oficina_id = u_self.oficina_id
      )
    )
  );

-- Empleados can see messages for agents in their office
CREATE POLICY "Empleados can view office contact center messages"
  ON contact_center_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u_self
      WHERE u_self.id = auth.uid()
      AND u_self.rol = 'Empleado'
      AND EXISTS (
        SELECT 1 FROM usuarios u_agent
        WHERE u_agent.id = contact_center_messages.agent_user_id
        AND u_agent.oficina_id = u_self.oficina_id
      )
    )
  );

-- Admins can insert messages
CREATE POLICY "Admins can insert contact center messages"
  ON contact_center_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

-- Gerentes can insert messages for agents in their office
CREATE POLICY "Gerentes can insert office contact center messages"
  ON contact_center_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios u_self
      WHERE u_self.id = auth.uid()
      AND u_self.rol = 'Gerente'
      AND EXISTS (
        SELECT 1 FROM usuarios u_agent
        WHERE u_agent.id = contact_center_messages.agent_user_id
        AND u_agent.oficina_id = u_self.oficina_id
      )
    )
  );

-- Empleados can insert messages for agents in their office
CREATE POLICY "Empleados can insert office contact center messages"
  ON contact_center_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios u_self
      WHERE u_self.id = auth.uid()
      AND u_self.rol = 'Empleado'
      AND EXISTS (
        SELECT 1 FROM usuarios u_agent
        WHERE u_agent.id = contact_center_messages.agent_user_id
        AND u_agent.oficina_id = u_self.oficina_id
      )
    )
  );

-- Admins can update messages (for status changes, retries)
CREATE POLICY "Admins can update contact center messages"
  ON contact_center_messages FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

-- Gerentes can update messages for their office agents
CREATE POLICY "Gerentes can update office contact center messages"
  ON contact_center_messages FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u_self
      WHERE u_self.id = auth.uid()
      AND u_self.rol = 'Gerente'
      AND EXISTS (
        SELECT 1 FROM usuarios u_agent
        WHERE u_agent.id = contact_center_messages.agent_user_id
        AND u_agent.oficina_id = u_self.oficina_id
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios u_self
      WHERE u_self.id = auth.uid()
      AND u_self.rol = 'Gerente'
      AND EXISTS (
        SELECT 1 FROM usuarios u_agent
        WHERE u_agent.id = contact_center_messages.agent_user_id
        AND u_agent.oficina_id = u_self.oficina_id
      )
    )
  );

-- Empleados can update messages for their office agents
CREATE POLICY "Empleados can update office contact center messages"
  ON contact_center_messages FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u_self
      WHERE u_self.id = auth.uid()
      AND u_self.rol = 'Empleado'
      AND EXISTS (
        SELECT 1 FROM usuarios u_agent
        WHERE u_agent.id = contact_center_messages.agent_user_id
        AND u_agent.oficina_id = u_self.oficina_id
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios u_self
      WHERE u_self.id = auth.uid()
      AND u_self.rol = 'Empleado'
      AND EXISTS (
        SELECT 1 FROM usuarios u_agent
        WHERE u_agent.id = contact_center_messages.agent_user_id
        AND u_agent.oficina_id = u_self.oficina_id
      )
    )
  );

-- Function to get conversation summaries
CREATE OR REPLACE FUNCTION get_contact_center_summary(
  p_user_id uuid,
  p_channel text DEFAULT NULL,
  p_message_type text DEFAULT NULL,
  p_office_id uuid DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_limit int DEFAULT 50,
  p_offset int DEFAULT 0
)
RETURNS TABLE (
  agent_user_id uuid,
  agent_name text,
  agent_email text,
  agent_phone text,
  agent_office_id uuid,
  office_name text,
  agent_rol text,
  agent_activo boolean,
  last_message_body text,
  last_message_channel text,
  last_message_at timestamptz,
  last_message_status text,
  total_messages bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_rol text;
  v_user_office uuid;
BEGIN
  SELECT rol, oficina_id INTO v_user_rol, v_user_office
  FROM usuarios WHERE id = p_user_id;

  IF v_user_rol NOT IN ('Administrador', 'Gerente', 'Empleado') THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH last_msgs AS (
    SELECT DISTINCT ON (ccm.agent_user_id)
      ccm.agent_user_id,
      ccm.body AS last_body,
      ccm.channel AS last_channel,
      ccm.created_at AS last_at,
      ccm.status AS last_status
    FROM contact_center_messages ccm
    WHERE (p_channel IS NULL OR ccm.channel = p_channel)
      AND (p_message_type IS NULL OR ccm.message_type = p_message_type)
    ORDER BY ccm.agent_user_id, ccm.created_at DESC
  ),
  msg_counts AS (
    SELECT ccm.agent_user_id, COUNT(*) AS cnt
    FROM contact_center_messages ccm
    WHERE (p_channel IS NULL OR ccm.channel = p_channel)
      AND (p_message_type IS NULL OR ccm.message_type = p_message_type)
    GROUP BY ccm.agent_user_id
  )
  SELECT
    u.id AS agent_user_id,
    COALESCE(u.nombre_completo, u.nombre || ' ' || u.apellidos) AS agent_name,
    u.email_laboral AS agent_email,
    COALESCE(u.celular_laboral, u.celular_personal) AS agent_phone,
    u.oficina_id AS agent_office_id,
    o.nombre AS office_name,
    u.rol AS agent_rol,
    u.activo AS agent_activo,
    lm.last_body AS last_message_body,
    lm.last_channel AS last_message_channel,
    lm.last_at AS last_message_at,
    lm.last_status AS last_message_status,
    COALESCE(mc.cnt, 0) AS total_messages
  FROM last_msgs lm
  JOIN usuarios u ON u.id = lm.agent_user_id
  LEFT JOIN oficinas o ON o.id = u.oficina_id
  LEFT JOIN msg_counts mc ON mc.agent_user_id = u.id
  WHERE (v_user_rol = 'Administrador' OR u.oficina_id = v_user_office)
    AND (p_office_id IS NULL OR u.oficina_id = p_office_id)
    AND (p_search IS NULL OR p_search = '' OR
      u.nombre_completo ILIKE '%' || p_search || '%' OR
      u.email_laboral ILIKE '%' || p_search || '%' OR
      COALESCE(u.celular_laboral, '') ILIKE '%' || p_search || '%'
    )
  ORDER BY lm.last_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$;

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_contact_center_messages_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_contact_center_messages_updated_at
  BEFORE UPDATE ON contact_center_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_contact_center_messages_updated_at();
