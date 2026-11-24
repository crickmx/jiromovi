/*
  # Centro de Contacto Unificado

  ## Summary
  Creates a normalized omnichannel layer on top of the existing WA MOVI (Wazzup),
  WA Personal (QR), and internal Chat channels. The existing tables are NOT modified.

  ## New Tables

  ### cc_conversations
  Normalized conversation per contact per channel. One row per unique thread.
  - channel: wa_movi | wa_personal | chat | seguwallet | web_form
  - Links to existing tables via external_conversation_id
  - RLS: owners + office-scoped for managers/admins

  ### cc_messages
  Normalized messages inside a conversation.
  - Supports text, image, audio, video, document, sticker, location, system
  - direction: inbound | outbound
  - external_message_id + channel unique to prevent duplicates
  - raw_payload preserved for debugging

  ## Sync Functions
  - sync_wazzup_to_cc(): Pulls from contact_center_messages (channel=whatsapp, provider=wazzup)
  - sync_wa_personal_to_cc(): Pulls from whatsapp_conversations + whatsapp_messages
  - sync_chat_to_cc(): Pulls from chats + chat_mensajes

  ## Security
  - RLS enabled on both tables
  - Agentes: only their own conversations
  - Empleado/Gerente: office-scoped
  - Administrador: all
*/

-- ─── cc_conversations ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS cc_conversations (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id           uuid REFERENCES usuarios(id) ON DELETE CASCADE,
  office_id               uuid REFERENCES oficinas(id) ON DELETE SET NULL,
  assigned_agent_id       uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  channel                 text NOT NULL CHECK (channel IN ('wa_movi','wa_personal','chat','seguwallet','web_form')),
  external_conversation_id text,
  contact_name            text,
  contact_phone           text,
  contact_email           text,
  avatar_url              text,
  last_message            text,
  last_message_at         timestamptz,
  unread_count            integer NOT NULL DEFAULT 0,
  status                  text NOT NULL DEFAULT 'open' CHECK (status IN ('open','pending','closed','archived')),
  is_group                boolean NOT NULL DEFAULT false,
  group_name              text,
  crm_contact_id          uuid,
  tramite_id              uuid,
  tags                    text[] DEFAULT '{}',
  raw_payload             jsonb,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_user_id, channel, external_conversation_id)
);

ALTER TABLE cc_conversations ENABLE ROW LEVEL SECURITY;

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_cc_conv_owner      ON cc_conversations(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_cc_conv_channel    ON cc_conversations(channel);
CREATE INDEX IF NOT EXISTS idx_cc_conv_status     ON cc_conversations(status);
CREATE INDEX IF NOT EXISTS idx_cc_conv_last_msg   ON cc_conversations(last_message_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_cc_conv_office     ON cc_conversations(office_id);
CREATE INDEX IF NOT EXISTS idx_cc_conv_ext_id     ON cc_conversations(external_conversation_id);

-- Updated at trigger
CREATE OR REPLACE FUNCTION update_cc_conversations_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_cc_conv_updated_at ON cc_conversations;
CREATE TRIGGER trg_cc_conv_updated_at
  BEFORE UPDATE ON cc_conversations
  FOR EACH ROW EXECUTE FUNCTION update_cc_conversations_updated_at();

-- ─── cc_messages ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS cc_messages (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id     uuid NOT NULL REFERENCES cc_conversations(id) ON DELETE CASCADE,
  channel             text NOT NULL CHECK (channel IN ('wa_movi','wa_personal','chat','seguwallet','web_form')),
  external_message_id text,
  direction           text NOT NULL CHECK (direction IN ('inbound','outbound')),
  message_type        text NOT NULL DEFAULT 'text'
                        CHECK (message_type IN ('text','image','audio','video','document','sticker','location','system','unknown')),
  body                text,
  media_url           text,
  media_mime_type     text,
  media_filename      text,
  media_thumbnail_url text,
  location_lat        double precision,
  location_lng        double precision,
  location_label      text,
  sender_name         text,
  sender_user_id      uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  sent_at             timestamptz NOT NULL DEFAULT now(),
  delivered_at        timestamptz,
  read_at             timestamptz,
  status              text NOT NULL DEFAULT 'sent'
                        CHECK (status IN ('pending','sent','delivered','read','failed')),
  raw_payload         jsonb,
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (conversation_id, external_message_id)
);

ALTER TABLE cc_messages ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_cc_msg_conv       ON cc_messages(conversation_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_cc_msg_channel    ON cc_messages(channel);
CREATE INDEX IF NOT EXISTS idx_cc_msg_direction  ON cc_messages(direction);
CREATE INDEX IF NOT EXISTS idx_cc_msg_ext_id     ON cc_messages(external_message_id);

-- ─── RLS policies ─────────────────────────────────────────────────────────────

-- Helper: get current user's role
CREATE OR REPLACE FUNCTION get_current_user_role()
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT rol FROM usuarios WHERE id = auth.uid() LIMIT 1;
$$;

-- Helper: get current user's office_id
CREATE OR REPLACE FUNCTION get_current_user_office()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT oficina_id FROM usuarios WHERE id = auth.uid() LIMIT 1;
$$;

-- cc_conversations SELECT
CREATE POLICY "cc_conv_select"
  ON cc_conversations FOR SELECT
  TO authenticated
  USING (
    get_current_user_role() = 'Administrador'
    OR owner_user_id = auth.uid()
    OR assigned_agent_id = auth.uid()
    OR (
      get_current_user_role() IN ('Gerente', 'Empleado', 'Ejecutivo')
      AND office_id = get_current_user_office()
    )
  );

-- cc_conversations INSERT
CREATE POLICY "cc_conv_insert"
  ON cc_conversations FOR INSERT
  TO authenticated
  WITH CHECK (
    owner_user_id = auth.uid()
    OR get_current_user_role() IN ('Administrador', 'Gerente', 'Empleado', 'Ejecutivo')
  );

-- cc_conversations UPDATE
CREATE POLICY "cc_conv_update"
  ON cc_conversations FOR UPDATE
  TO authenticated
  USING (
    get_current_user_role() = 'Administrador'
    OR owner_user_id = auth.uid()
    OR assigned_agent_id = auth.uid()
    OR (
      get_current_user_role() IN ('Gerente', 'Empleado', 'Ejecutivo')
      AND office_id = get_current_user_office()
    )
  )
  WITH CHECK (
    get_current_user_role() = 'Administrador'
    OR owner_user_id = auth.uid()
    OR assigned_agent_id = auth.uid()
    OR (
      get_current_user_role() IN ('Gerente', 'Empleado', 'Ejecutivo')
      AND office_id = get_current_user_office()
    )
  );

-- cc_messages SELECT: via conversation access
CREATE POLICY "cc_msg_select"
  ON cc_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM cc_conversations c
      WHERE c.id = conversation_id
        AND (
          get_current_user_role() = 'Administrador'
          OR c.owner_user_id = auth.uid()
          OR c.assigned_agent_id = auth.uid()
          OR (
            get_current_user_role() IN ('Gerente', 'Empleado', 'Ejecutivo')
            AND c.office_id = get_current_user_office()
          )
        )
    )
  );

-- cc_messages INSERT
CREATE POLICY "cc_msg_insert"
  ON cc_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM cc_conversations c
      WHERE c.id = conversation_id
        AND (
          get_current_user_role() = 'Administrador'
          OR c.owner_user_id = auth.uid()
          OR c.assigned_agent_id = auth.uid()
          OR (
            get_current_user_role() IN ('Gerente', 'Empleado', 'Ejecutivo')
            AND c.office_id = get_current_user_office()
          )
        )
    )
  );

-- Service role bypass
CREATE POLICY "cc_conv_service_role"
  ON cc_conversations FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "cc_msg_service_role"
  ON cc_messages FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ─── Sync Functions ────────────────────────────────────────────────────────────

/*
  sync_wazzup_to_cc(p_user_id uuid):
  Syncs inbound/outbound contact_center_messages (channel=whatsapp, provider=wazzup)
  into cc_conversations + cc_messages for the given agent.
*/
CREATE OR REPLACE FUNCTION sync_wazzup_to_cc(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_msg          RECORD;
  v_conv_id      uuid;
  v_office_id    uuid;
  v_conv_phone   text;
  v_upserted     integer := 0;
  v_skipped      integer := 0;
BEGIN
  SELECT oficina_id INTO v_office_id FROM usuarios WHERE id = p_user_id;

  FOR v_msg IN
    SELECT
      m.id,
      m.agent_user_id,
      m.direction,
      m.body,
      m.created_at,
      m.status,
      m.provider_message_id,
      m.contact_phone,
      m.contact_name,
      m.metadata,
      m.attachment_urls,
      m.read_at
    FROM contact_center_messages m
    WHERE m.agent_user_id = p_user_id
      AND m.channel = 'whatsapp'
      AND m.provider = 'wazzup'
    ORDER BY m.created_at ASC
  LOOP
    v_conv_phone := COALESCE(v_msg.contact_phone, (v_msg.metadata->>'chat_id')::text, 'unknown');

    -- Upsert conversation
    INSERT INTO cc_conversations (
      owner_user_id, office_id, channel, external_conversation_id,
      contact_name, contact_phone,
      last_message, last_message_at, status
    ) VALUES (
      p_user_id, v_office_id, 'wa_movi', v_conv_phone,
      v_msg.contact_name, v_conv_phone,
      v_msg.body, v_msg.created_at, 'open'
    )
    ON CONFLICT (owner_user_id, channel, external_conversation_id)
    DO UPDATE SET
      last_message    = CASE WHEN EXCLUDED.last_message_at >= cc_conversations.last_message_at THEN EXCLUDED.last_message ELSE cc_conversations.last_message END,
      last_message_at = GREATEST(cc_conversations.last_message_at, EXCLUDED.last_message_at),
      contact_name    = COALESCE(EXCLUDED.contact_name, cc_conversations.contact_name),
      updated_at      = now()
    RETURNING id INTO v_conv_id;

    IF v_conv_id IS NULL THEN
      SELECT id INTO v_conv_id FROM cc_conversations
      WHERE owner_user_id = p_user_id AND channel = 'wa_movi' AND external_conversation_id = v_conv_phone;
    END IF;

    -- Insert message (ignore duplicates)
    INSERT INTO cc_messages (
      conversation_id, channel, external_message_id, direction,
      message_type, body, sender_name, sender_user_id,
      sent_at, status, raw_payload
    ) VALUES (
      v_conv_id, 'wa_movi',
      COALESCE(v_msg.provider_message_id, v_msg.id::text),
      v_msg.direction,
      'text', v_msg.body,
      CASE WHEN v_msg.direction = 'inbound' THEN v_msg.contact_name ELSE NULL END,
      CASE WHEN v_msg.direction = 'outbound' THEN p_user_id ELSE NULL END,
      v_msg.created_at, v_msg.status,
      jsonb_build_object('original_id', v_msg.id)
    )
    ON CONFLICT (conversation_id, external_message_id) DO NOTHING;

    IF FOUND THEN v_upserted := v_upserted + 1;
    ELSE v_skipped := v_skipped + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('channel','wa_movi','upserted',v_upserted,'skipped',v_skipped);
END;
$$;

/*
  sync_wa_personal_to_cc(p_user_id uuid):
  Syncs whatsapp_conversations + whatsapp_messages into cc_conversations + cc_messages.
*/
CREATE OR REPLACE FUNCTION sync_wa_personal_to_cc(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conv         RECORD;
  v_msg          RECORD;
  v_cc_conv_id   uuid;
  v_office_id    uuid;
  v_upserted     integer := 0;
  v_skipped      integer := 0;
BEGIN
  SELECT oficina_id INTO v_office_id FROM usuarios WHERE id = p_user_id;

  FOR v_conv IN
    SELECT c.id, c.remote_phone, c.remote_name, c.remote_avatar_url,
           c.last_message_text, c.last_message_at, c.unread_count, c.is_group, c.group_name
    FROM whatsapp_conversations c
    JOIN whatsapp_sessions s ON s.id = c.session_id
    WHERE s.user_id = p_user_id
  LOOP
    INSERT INTO cc_conversations (
      owner_user_id, office_id, channel, external_conversation_id,
      contact_name, contact_phone, avatar_url,
      last_message, last_message_at, unread_count,
      is_group, group_name, status
    ) VALUES (
      p_user_id, v_office_id, 'wa_personal', v_conv.id::text,
      COALESCE(v_conv.group_name, v_conv.remote_name), v_conv.remote_phone,
      v_conv.remote_avatar_url,
      v_conv.last_message_text, v_conv.last_message_at, v_conv.unread_count,
      v_conv.is_group, v_conv.group_name, 'open'
    )
    ON CONFLICT (owner_user_id, channel, external_conversation_id)
    DO UPDATE SET
      contact_name    = COALESCE(EXCLUDED.contact_name, cc_conversations.contact_name),
      avatar_url      = COALESCE(EXCLUDED.avatar_url, cc_conversations.avatar_url),
      last_message    = CASE WHEN EXCLUDED.last_message_at >= cc_conversations.last_message_at THEN EXCLUDED.last_message ELSE cc_conversations.last_message END,
      last_message_at = GREATEST(cc_conversations.last_message_at, EXCLUDED.last_message_at),
      unread_count    = EXCLUDED.unread_count,
      updated_at      = now()
    RETURNING id INTO v_cc_conv_id;

    IF v_cc_conv_id IS NULL THEN
      SELECT id INTO v_cc_conv_id FROM cc_conversations
      WHERE owner_user_id = p_user_id AND channel = 'wa_personal'
        AND external_conversation_id = v_conv.id::text;
    END IF;

    -- Sync messages for this conversation
    FOR v_msg IN
      SELECT m.id, m.direction, m.message_type, m.content, m.media_url,
             m.media_mime_type, m.media_filename, m.media_thumbnail_url,
             m.status, m.created_at, m.message_timestamp,
             m.location_lat, m.location_lng
      FROM whatsapp_messages m
      WHERE m.conversation_id = v_conv.id
      ORDER BY m.created_at ASC
    LOOP
      INSERT INTO cc_messages (
        conversation_id, channel, external_message_id, direction,
        message_type, body, media_url, media_mime_type, media_filename,
        media_thumbnail_url, location_lat, location_lng,
        sender_user_id, sent_at, status,
        raw_payload
      ) VALUES (
        v_cc_conv_id, 'wa_personal', v_msg.id::text, v_msg.direction,
        COALESCE(v_msg.message_type, 'text'),
        v_msg.content, v_msg.media_url, v_msg.media_mime_type, v_msg.media_filename,
        v_msg.media_thumbnail_url,
        v_msg.location_lat, v_msg.location_lng,
        CASE WHEN v_msg.direction = 'outbound' THEN p_user_id ELSE NULL END,
        COALESCE(v_msg.message_timestamp, v_msg.created_at),
        COALESCE(v_msg.status, 'sent'),
        jsonb_build_object('original_id', v_msg.id)
      )
      ON CONFLICT (conversation_id, external_message_id) DO NOTHING;

      IF FOUND THEN v_upserted := v_upserted + 1;
      ELSE v_skipped := v_skipped + 1;
      END IF;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object('channel','wa_personal','upserted',v_upserted,'skipped',v_skipped);
END;
$$;

/*
  sync_chat_to_cc(p_user_id uuid):
  Syncs internal chat_mensajes into cc_conversations + cc_messages.
  Each chat becomes a conversation; direction is inbound (others) or outbound (self).
*/
CREATE OR REPLACE FUNCTION sync_chat_to_cc(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_chat         RECORD;
  v_msg          RECORD;
  v_cc_conv_id   uuid;
  v_office_id    uuid;
  v_peer_name    text;
  v_upserted     integer := 0;
  v_skipped      integer := 0;
BEGIN
  SELECT oficina_id INTO v_office_id FROM usuarios WHERE id = p_user_id;

  FOR v_chat IN
    SELECT c.id, c.nombre, c.tipo, c.ultimo_mensaje_at,
           cm.unido_at
    FROM chats c
    JOIN chat_miembros cm ON cm.chat_id = c.id AND cm.usuario_id = p_user_id
    WHERE c.eliminado IS NOT TRUE
  LOOP
    -- Get peer name for direct chats
    IF v_chat.tipo = 'direct' THEN
      SELECT CONCAT(u.nombres, ' ', u.apellido_paterno)
      INTO v_peer_name
      FROM chat_miembros cm
      JOIN usuarios u ON u.id = cm.usuario_id
      WHERE cm.chat_id = v_chat.id AND cm.usuario_id <> p_user_id
      LIMIT 1;
    ELSE
      v_peer_name := v_chat.nombre;
    END IF;

    INSERT INTO cc_conversations (
      owner_user_id, office_id, channel, external_conversation_id,
      contact_name, last_message_at, is_group, group_name, status
    ) VALUES (
      p_user_id, v_office_id, 'chat', v_chat.id::text,
      v_peer_name, v_chat.ultimo_mensaje_at,
      v_chat.tipo = 'group', v_chat.nombre,
      'open'
    )
    ON CONFLICT (owner_user_id, channel, external_conversation_id)
    DO UPDATE SET
      contact_name    = COALESCE(EXCLUDED.contact_name, cc_conversations.contact_name),
      last_message_at = GREATEST(cc_conversations.last_message_at, EXCLUDED.last_message_at),
      updated_at      = now()
    RETURNING id INTO v_cc_conv_id;

    IF v_cc_conv_id IS NULL THEN
      SELECT id INTO v_cc_conv_id FROM cc_conversations
      WHERE owner_user_id = p_user_id AND channel = 'chat'
        AND external_conversation_id = v_chat.id::text;
    END IF;

    FOR v_msg IN
      SELECT m.id, m.remitente_id, m.mensaje, m.created_at, m.eliminado
      FROM chat_mensajes m
      WHERE m.chat_id = v_chat.id
        AND (m.eliminado IS NOT TRUE)
      ORDER BY m.created_at ASC
    LOOP
      INSERT INTO cc_messages (
        conversation_id, channel, external_message_id, direction,
        message_type, body, sender_user_id,
        sent_at, status, raw_payload
      ) VALUES (
        v_cc_conv_id, 'chat', v_msg.id::text,
        CASE WHEN v_msg.remitente_id = p_user_id THEN 'outbound' ELSE 'inbound' END,
        'text', v_msg.mensaje, v_msg.remitente_id,
        v_msg.created_at, 'sent',
        jsonb_build_object('original_id', v_msg.id)
      )
      ON CONFLICT (conversation_id, external_message_id) DO NOTHING;

      IF FOUND THEN v_upserted := v_upserted + 1;
      ELSE v_skipped := v_skipped + 1;
      END IF;
    END LOOP;

    -- Update last_message text from latest message
    UPDATE cc_conversations
    SET last_message = (
      SELECT body FROM cc_messages
      WHERE conversation_id = v_cc_conv_id
      ORDER BY sent_at DESC LIMIT 1
    )
    WHERE id = v_cc_conv_id;
  END LOOP;

  RETURN jsonb_build_object('channel','chat','upserted',v_upserted,'skipped',v_skipped);
END;
$$;

/*
  sync_all_channels_for_user(p_user_id uuid):
  Convenience function to sync all channels at once.
*/
CREATE OR REPLACE FUNCTION sync_all_channels_for_user(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wazzup   jsonb;
  v_personal jsonb;
  v_chat     jsonb;
BEGIN
  v_wazzup   := sync_wazzup_to_cc(p_user_id);
  v_personal := sync_wa_personal_to_cc(p_user_id);
  v_chat     := sync_chat_to_cc(p_user_id);
  RETURN jsonb_build_object(
    'wa_movi',     v_wazzup,
    'wa_personal', v_personal,
    'chat',        v_chat
  );
END;
$$;

-- Grant execute to authenticated users (for self-sync)
GRANT EXECUTE ON FUNCTION sync_all_channels_for_user(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION sync_wazzup_to_cc(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION sync_wa_personal_to_cc(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION sync_chat_to_cc(uuid) TO authenticated;
