/*
  # Auto-sync triggers for Centro de Contacto Unificado

  ## Summary
  Adds PostgreSQL triggers on the three source tables so that new messages
  are automatically propagated to cc_conversations + cc_messages without
  any manual "Sincronizar" button click.

  ## Triggers added
  1. contact_center_messages → trg_cc_sync_wazzup
     Fires AFTER INSERT on contact_center_messages WHERE provider='wazzup'
  2. whatsapp_messages → trg_cc_sync_wa_personal
     Fires AFTER INSERT on whatsapp_messages
  3. chat_mensajes → trg_cc_sync_chat
     Fires AFTER INSERT on chat_mensajes

  ## How it works
  Each trigger function resolves the owner_user_id from context, then
  upserts a single conversation row and inserts a single message row.
  Uses ON CONFLICT DO NOTHING / DO UPDATE to stay idempotent.
*/

-- ─── 1. WA MOVI: contact_center_messages → cc ──────────────────────────────

CREATE OR REPLACE FUNCTION trg_fn_cc_sync_wazzup()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conv_id    uuid;
  v_office_id  uuid;
  v_conv_phone text;
BEGIN
  -- Only sync wazzup whatsapp messages
  IF NEW.provider <> 'wazzup' OR NEW.channel <> 'whatsapp' THEN
    RETURN NEW;
  END IF;
  IF NEW.agent_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT oficina_id INTO v_office_id FROM usuarios WHERE id = NEW.agent_user_id;
  v_conv_phone := COALESCE(NEW.contact_phone, (NEW.metadata->>'chat_id')::text, 'unknown');

  -- Upsert conversation
  INSERT INTO cc_conversations (
    owner_user_id, office_id, channel, external_conversation_id,
    contact_name, contact_phone, last_message, last_message_at, status
  ) VALUES (
    NEW.agent_user_id, v_office_id, 'wa_movi', v_conv_phone,
    NEW.contact_name, v_conv_phone,
    NEW.body, NEW.created_at, 'open'
  )
  ON CONFLICT (owner_user_id, channel, external_conversation_id)
  DO UPDATE SET
    last_message    = CASE WHEN EXCLUDED.last_message_at >= cc_conversations.last_message_at
                           THEN EXCLUDED.last_message ELSE cc_conversations.last_message END,
    last_message_at = GREATEST(cc_conversations.last_message_at, EXCLUDED.last_message_at),
    contact_name    = COALESCE(EXCLUDED.contact_name, cc_conversations.contact_name),
    unread_count    = CASE WHEN EXCLUDED.last_message_at > cc_conversations.last_message_at
                           AND NEW.direction = 'inbound'
                           THEN cc_conversations.unread_count + 1
                           ELSE cc_conversations.unread_count END,
    updated_at      = now()
  RETURNING id INTO v_conv_id;

  IF v_conv_id IS NULL THEN
    SELECT id INTO v_conv_id FROM cc_conversations
    WHERE owner_user_id = NEW.agent_user_id
      AND channel = 'wa_movi'
      AND external_conversation_id = v_conv_phone;
  END IF;

  -- Insert message (idempotent)
  INSERT INTO cc_messages (
    conversation_id, channel, external_message_id, direction,
    message_type, body, sender_name, sender_user_id,
    sent_at, status, raw_payload
  ) VALUES (
    v_conv_id, 'wa_movi',
    COALESCE(NEW.provider_message_id, NEW.id::text),
    NEW.direction,
    'text', NEW.body,
    CASE WHEN NEW.direction = 'inbound' THEN NEW.contact_name ELSE NULL END,
    CASE WHEN NEW.direction = 'outbound' THEN NEW.agent_user_id ELSE NULL END,
    NEW.created_at, COALESCE(NEW.status, 'sent'),
    jsonb_build_object('original_id', NEW.id)
  )
  ON CONFLICT (conversation_id, external_message_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cc_sync_wazzup ON contact_center_messages;
CREATE TRIGGER trg_cc_sync_wazzup
  AFTER INSERT ON contact_center_messages
  FOR EACH ROW EXECUTE FUNCTION trg_fn_cc_sync_wazzup();


-- ─── 2. WA Personal: whatsapp_messages → cc ────────────────────────────────

CREATE OR REPLACE FUNCTION trg_fn_cc_sync_wa_personal()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conv_id      uuid;
  v_cc_conv_id   uuid;
  v_user_id      uuid;
  v_office_id    uuid;
  v_remote_phone text;
  v_remote_name  text;
  v_avatar_url   text;
  v_is_group     boolean;
  v_group_name   text;
BEGIN
  -- Resolve owner from whatsapp_conversations → whatsapp_sessions → user
  SELECT wc.remote_phone, wc.remote_name, wc.remote_avatar_url,
         wc.is_group, wc.group_name, ws.user_id
  INTO v_remote_phone, v_remote_name, v_avatar_url, v_is_group, v_group_name, v_user_id
  FROM whatsapp_conversations wc
  JOIN whatsapp_sessions ws ON ws.id = wc.session_id
  WHERE wc.id = NEW.conversation_id
  LIMIT 1;

  IF v_user_id IS NULL THEN RETURN NEW; END IF;

  SELECT oficina_id INTO v_office_id FROM usuarios WHERE id = v_user_id;
  v_conv_id := NEW.conversation_id;

  INSERT INTO cc_conversations (
    owner_user_id, office_id, channel, external_conversation_id,
    contact_name, contact_phone, avatar_url,
    last_message, last_message_at,
    is_group, group_name, status
  ) VALUES (
    v_user_id, v_office_id, 'wa_personal', v_conv_id::text,
    COALESCE(v_group_name, v_remote_name), v_remote_phone, v_avatar_url,
    NEW.content, COALESCE(NEW.message_timestamp, NEW.created_at),
    COALESCE(v_is_group, false), v_group_name, 'open'
  )
  ON CONFLICT (owner_user_id, channel, external_conversation_id)
  DO UPDATE SET
    last_message    = CASE WHEN EXCLUDED.last_message_at >= cc_conversations.last_message_at
                           THEN EXCLUDED.last_message ELSE cc_conversations.last_message END,
    last_message_at = GREATEST(cc_conversations.last_message_at, EXCLUDED.last_message_at),
    avatar_url      = COALESCE(EXCLUDED.avatar_url, cc_conversations.avatar_url),
    unread_count    = CASE WHEN EXCLUDED.last_message_at > cc_conversations.last_message_at
                           AND NEW.direction = 'inbound'
                           THEN cc_conversations.unread_count + 1
                           ELSE cc_conversations.unread_count END,
    updated_at      = now()
  RETURNING id INTO v_cc_conv_id;

  IF v_cc_conv_id IS NULL THEN
    SELECT id INTO v_cc_conv_id FROM cc_conversations
    WHERE owner_user_id = v_user_id
      AND channel = 'wa_personal'
      AND external_conversation_id = v_conv_id::text;
  END IF;

  INSERT INTO cc_messages (
    conversation_id, channel, external_message_id, direction,
    message_type, body, media_url, media_mime_type, media_filename,
    media_thumbnail_url,
    sender_user_id, sent_at, status, raw_payload
  ) VALUES (
    v_cc_conv_id, 'wa_personal', NEW.id::text, NEW.direction,
    COALESCE(NEW.message_type, 'text'),
    NEW.content, NEW.media_url, NEW.media_mime_type, NEW.media_filename,
    NEW.media_thumbnail_url,
    CASE WHEN NEW.direction = 'outbound' THEN v_user_id ELSE NULL END,
    COALESCE(NEW.message_timestamp, NEW.created_at),
    COALESCE(NEW.status, 'sent'),
    jsonb_build_object('original_id', NEW.id)
  )
  ON CONFLICT (conversation_id, external_message_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cc_sync_wa_personal ON whatsapp_messages;
CREATE TRIGGER trg_cc_sync_wa_personal
  AFTER INSERT ON whatsapp_messages
  FOR EACH ROW EXECUTE FUNCTION trg_fn_cc_sync_wa_personal();


-- ─── 3. Chat: chat_mensajes → cc ───────────────────────────────────────────

CREATE OR REPLACE FUNCTION trg_fn_cc_sync_chat()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_member       RECORD;
  v_cc_conv_id   uuid;
  v_office_id    uuid;
  v_peer_name    text;
  v_chat_tipo    text;
  v_chat_nombre  text;
  v_last_at      timestamptz;
BEGIN
  -- Skip deleted messages
  IF NEW.eliminado IS TRUE THEN RETURN NEW; END IF;

  SELECT tipo, nombre, ultimo_mensaje_at
  INTO v_chat_tipo, v_chat_nombre, v_last_at
  FROM chats WHERE id = NEW.chat_id;

  -- Sync for each member of the chat
  FOR v_member IN
    SELECT cm.usuario_id FROM chat_miembros cm WHERE cm.chat_id = NEW.chat_id
  LOOP
    SELECT oficina_id INTO v_office_id FROM usuarios WHERE id = v_member.usuario_id;

    -- Peer name for direct chats
    IF v_chat_tipo = 'direct' THEN
      SELECT CONCAT(u.nombres, ' ', u.apellido_paterno)
      INTO v_peer_name
      FROM chat_miembros cm
      JOIN usuarios u ON u.id = cm.usuario_id
      WHERE cm.chat_id = NEW.chat_id AND cm.usuario_id <> v_member.usuario_id
      LIMIT 1;
    ELSE
      v_peer_name := v_chat_nombre;
    END IF;

    INSERT INTO cc_conversations (
      owner_user_id, office_id, channel, external_conversation_id,
      contact_name, last_message, last_message_at,
      is_group, group_name, status
    ) VALUES (
      v_member.usuario_id, v_office_id, 'chat', NEW.chat_id::text,
      v_peer_name, NEW.mensaje, COALESCE(v_last_at, NEW.created_at),
      v_chat_tipo = 'group', v_chat_nombre, 'open'
    )
    ON CONFLICT (owner_user_id, channel, external_conversation_id)
    DO UPDATE SET
      last_message    = EXCLUDED.last_message,
      last_message_at = GREATEST(cc_conversations.last_message_at, EXCLUDED.last_message_at),
      contact_name    = COALESCE(EXCLUDED.contact_name, cc_conversations.contact_name),
      unread_count    = CASE WHEN NEW.remitente_id <> v_member.usuario_id
                             THEN cc_conversations.unread_count + 1
                             ELSE cc_conversations.unread_count END,
      updated_at      = now()
    RETURNING id INTO v_cc_conv_id;

    IF v_cc_conv_id IS NULL THEN
      SELECT id INTO v_cc_conv_id FROM cc_conversations
      WHERE owner_user_id = v_member.usuario_id
        AND channel = 'chat'
        AND external_conversation_id = NEW.chat_id::text;
    END IF;

    INSERT INTO cc_messages (
      conversation_id, channel, external_message_id, direction,
      message_type, body, sender_user_id,
      sent_at, status, raw_payload
    ) VALUES (
      v_cc_conv_id, 'chat', NEW.id::text,
      CASE WHEN NEW.remitente_id = v_member.usuario_id THEN 'outbound' ELSE 'inbound' END,
      'text', NEW.mensaje, NEW.remitente_id,
      NEW.created_at, 'sent',
      jsonb_build_object('original_id', NEW.id)
    )
    ON CONFLICT (conversation_id, external_message_id) DO NOTHING;

  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cc_sync_chat ON chat_mensajes;
CREATE TRIGGER trg_cc_sync_chat
  AFTER INSERT ON chat_mensajes
  FOR EACH ROW EXECUTE FUNCTION trg_fn_cc_sync_chat();
