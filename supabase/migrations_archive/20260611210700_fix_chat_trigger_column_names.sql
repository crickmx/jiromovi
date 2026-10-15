
-- Fix sync_chat_to_cc: u.nombres -> u.nombre, u.apellido_paterno -> u.apellidos
CREATE OR REPLACE FUNCTION sync_chat_to_cc(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
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
SELECT CONCAT(u.nombre, ' ', u.apellidos)
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

-- Fix trg_fn_cc_sync_chat trigger function: u.nombres -> u.nombre, u.apellido_paterno -> u.apellidos
CREATE OR REPLACE FUNCTION trg_fn_cc_sync_chat()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
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
SELECT CONCAT(u.nombre, ' ', u.apellidos)
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
