/*
  # Make WhatsApp conversations private per user

  WA MOVI and WA Personal must only be visible and mutable by their owner.
  Service-role webhook/server operations continue to bypass RLS.
*/

-- Remove every legacy role-, office-, assignment-, and admin-wide policy.
DROP POLICY IF EXISTS "Admins can view all contact center messages" ON contact_center_messages;
DROP POLICY IF EXISTS "Gerentes can view office contact center messages" ON contact_center_messages;
DROP POLICY IF EXISTS "Empleados can view office contact center messages" ON contact_center_messages;
DROP POLICY IF EXISTS "Gerentes can view external contact center messages" ON contact_center_messages;
DROP POLICY IF EXISTS "Empleados can view external contact center messages" ON contact_center_messages;
DROP POLICY IF EXISTS "Empleados can view assigned agent contact center messages" ON contact_center_messages;
DROP POLICY IF EXISTS "Ejecutivos can view assigned agent contact center messages" ON contact_center_messages;

DROP POLICY IF EXISTS "Admins can insert contact center messages" ON contact_center_messages;
DROP POLICY IF EXISTS "Gerentes can insert office contact center messages" ON contact_center_messages;
DROP POLICY IF EXISTS "Empleados can insert office contact center messages" ON contact_center_messages;
DROP POLICY IF EXISTS "Empleados can insert contact center messages" ON contact_center_messages;
DROP POLICY IF EXISTS "Ejecutivos can insert contact center messages" ON contact_center_messages;

DROP POLICY IF EXISTS "Admins can update contact center messages" ON contact_center_messages;
DROP POLICY IF EXISTS "Gerentes can update office contact center messages" ON contact_center_messages;
DROP POLICY IF EXISTS "Empleados can update office contact center messages" ON contact_center_messages;
DROP POLICY IF EXISTS "Empleados can update contact center messages" ON contact_center_messages;
DROP POLICY IF EXISTS "Ejecutivos can update contact center messages" ON contact_center_messages;
DROP POLICY IF EXISTS "Users can view own contact center messages" ON contact_center_messages;
DROP POLICY IF EXISTS "Users can insert own contact center messages" ON contact_center_messages;
DROP POLICY IF EXISTS "Users can update own contact center messages" ON contact_center_messages;

CREATE POLICY "Users can view own contact center messages"
  ON contact_center_messages FOR SELECT
  TO authenticated
  USING (agent_user_id = (SELECT auth.uid()));

CREATE POLICY "Users can insert own contact center messages"
  ON contact_center_messages FOR INSERT
  TO authenticated
  WITH CHECK (agent_user_id = (SELECT auth.uid()));

CREATE POLICY "Users can update own contact center messages"
  ON contact_center_messages FOR UPDATE
  TO authenticated
  USING (agent_user_id = (SELECT auth.uid()))
  WITH CHECK (agent_user_id = (SELECT auth.uid()));

-- Attachments follow the same ownership boundary as their parent messages.
DROP POLICY IF EXISTS "Admins view all cc attachments" ON contact_center_attachments;
DROP POLICY IF EXISTS "Gerentes view office cc attachments" ON contact_center_attachments;
DROP POLICY IF EXISTS "Empleados view office cc attachments" ON contact_center_attachments;
DROP POLICY IF EXISTS "Auth users insert cc attachments" ON contact_center_attachments;
DROP POLICY IF EXISTS "Users can view own contact center attachments" ON contact_center_attachments;
DROP POLICY IF EXISTS "Users can insert own contact center attachments" ON contact_center_attachments;

CREATE POLICY "Users can view own contact center attachments"
  ON contact_center_attachments FOR SELECT
  TO authenticated
  USING (
    agent_user_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1
      FROM contact_center_messages message
      WHERE message.id = contact_center_attachments.message_id
        AND message.agent_user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Users can insert own contact center attachments"
  ON contact_center_attachments FOR INSERT
  TO authenticated
  WITH CHECK (
    agent_user_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1
      FROM contact_center_messages message
      WHERE message.id = contact_center_attachments.message_id
        AND message.agent_user_id = (SELECT auth.uid())
    )
  );

-- Lock down the normalized contact-center mirror as well, so a future UI
-- cannot reintroduce office/admin-wide visibility by switching data sources.
DROP POLICY IF EXISTS "cc_conv_select" ON cc_conversations;
DROP POLICY IF EXISTS "cc_conv_insert" ON cc_conversations;
DROP POLICY IF EXISTS "cc_conv_update" ON cc_conversations;
DROP POLICY IF EXISTS "cc_msg_select" ON cc_messages;
DROP POLICY IF EXISTS "cc_msg_insert" ON cc_messages;

CREATE POLICY "cc_conv_select"
  ON cc_conversations FOR SELECT
  TO authenticated
  USING (owner_user_id = (SELECT auth.uid()));

CREATE POLICY "cc_conv_insert"
  ON cc_conversations FOR INSERT
  TO authenticated
  WITH CHECK (owner_user_id = (SELECT auth.uid()));

CREATE POLICY "cc_conv_update"
  ON cc_conversations FOR UPDATE
  TO authenticated
  USING (owner_user_id = (SELECT auth.uid()))
  WITH CHECK (owner_user_id = (SELECT auth.uid()));

CREATE POLICY "cc_msg_select"
  ON cc_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM cc_conversations conversation
      WHERE conversation.id = cc_messages.conversation_id
        AND conversation.owner_user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "cc_msg_insert"
  ON cc_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM cc_conversations conversation
      WHERE conversation.id = cc_messages.conversation_id
        AND conversation.owner_user_id = (SELECT auth.uid())
    )
  );

-- The previous SECURITY DEFINER function trusted caller-supplied user IDs.
-- Keep its signature for frontend compatibility, but require the authenticated
-- user to be both the conversation owner and the recorded reader.
CREATE OR REPLACE FUNCTION mark_contact_messages_read(
  p_agent_user_id uuid,
  p_user_id uuid
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int;
  v_caller uuid := auth.uid();
BEGIN
  IF v_caller IS NULL
     OR p_agent_user_id IS DISTINCT FROM v_caller
     OR p_user_id IS DISTINCT FROM v_caller THEN
    RAISE EXCEPTION 'Not authorized to mark this conversation as read'
      USING ERRCODE = '42501';
  END IF;

  UPDATE contact_center_messages
  SET read_at = now(),
      read_by_user_id = v_caller
  WHERE agent_user_id = v_caller
    AND direction = 'inbound'
    AND read_at IS NULL;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION mark_contact_messages_read(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION mark_contact_messages_read(uuid, uuid) TO authenticated;
