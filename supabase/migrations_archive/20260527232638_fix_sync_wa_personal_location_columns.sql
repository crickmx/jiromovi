/*
  # Fix sync_wa_personal_to_cc location columns

  whatsapp_messages does not have location_lat/location_lng columns.
  Replace the function to omit those fields and use NULL defaults.
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
      last_message    = CASE WHEN EXCLUDED.last_message_at >= cc_conversations.last_message_at
                             THEN EXCLUDED.last_message ELSE cc_conversations.last_message END,
      last_message_at = GREATEST(cc_conversations.last_message_at, EXCLUDED.last_message_at),
      unread_count    = EXCLUDED.unread_count,
      updated_at      = now()
    RETURNING id INTO v_cc_conv_id;

    IF v_cc_conv_id IS NULL THEN
      SELECT id INTO v_cc_conv_id FROM cc_conversations
      WHERE owner_user_id = p_user_id AND channel = 'wa_personal'
        AND external_conversation_id = v_conv.id::text;
    END IF;

    FOR v_msg IN
      SELECT m.id, m.direction, m.message_type, m.content, m.media_url,
             m.media_mime_type, m.media_filename, m.media_thumbnail_url,
             m.status, m.created_at, m.message_timestamp
      FROM whatsapp_messages m
      WHERE m.conversation_id = v_conv.id
      ORDER BY m.created_at ASC
    LOOP
      INSERT INTO cc_messages (
        conversation_id, channel, external_message_id, direction,
        message_type, body, media_url, media_mime_type, media_filename,
        media_thumbnail_url,
        sender_user_id, sent_at, status,
        raw_payload
      ) VALUES (
        v_cc_conv_id, 'wa_personal', v_msg.id::text, v_msg.direction,
        COALESCE(v_msg.message_type, 'text'),
        v_msg.content, v_msg.media_url, v_msg.media_mime_type, v_msg.media_filename,
        v_msg.media_thumbnail_url,
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
