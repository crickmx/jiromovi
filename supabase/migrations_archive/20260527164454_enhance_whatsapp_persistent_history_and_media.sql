/*
  # Enhance WhatsApp module for persistent history and media storage

  1. Modified Tables
    - `whatsapp_messages`
      - Add `media_storage_path` (text) - path in Supabase Storage
      - Add `media_file_size` (bigint) - file size in bytes
      - Add `media_thumbnail_url` (text) - thumbnail for images/videos
      - Add `media_caption` (text) - caption for media messages
      - Add `media_download_status` (text) - pending/downloaded/failed
      - Add `message_timestamp` (timestamptz) - original WhatsApp timestamp
      - Add unique constraint on (user_id, wa_message_id) for upsert support
    
    - `whatsapp_conversations`
      - Add unique constraint on (user_id, remote_phone) for upsert support
    
    - `whatsapp_audit_log`
      - Expand action types to include sync events

  2. New Storage
    - Bucket `whatsapp-media` for storing downloaded media files

  3. Security
    - Storage policies for whatsapp-media bucket (user-scoped)
    - Service role access for server-side inserts/updates

  4. Important Notes
    - wa_message_id + user_id unique enables conflict-free upserts
    - media_download_status tracks whether media has been fetched
    - message_timestamp preserves original WhatsApp ordering
*/

-- Add new columns to whatsapp_messages
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'whatsapp_messages' AND column_name = 'media_storage_path'
  ) THEN
    ALTER TABLE whatsapp_messages ADD COLUMN media_storage_path text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'whatsapp_messages' AND column_name = 'media_file_size'
  ) THEN
    ALTER TABLE whatsapp_messages ADD COLUMN media_file_size bigint;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'whatsapp_messages' AND column_name = 'media_thumbnail_url'
  ) THEN
    ALTER TABLE whatsapp_messages ADD COLUMN media_thumbnail_url text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'whatsapp_messages' AND column_name = 'media_caption'
  ) THEN
    ALTER TABLE whatsapp_messages ADD COLUMN media_caption text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'whatsapp_messages' AND column_name = 'media_download_status'
  ) THEN
    ALTER TABLE whatsapp_messages ADD COLUMN media_download_status text DEFAULT 'none'
      CHECK (media_download_status IN ('none', 'pending', 'downloading', 'downloaded', 'failed'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'whatsapp_messages' AND column_name = 'message_timestamp'
  ) THEN
    ALTER TABLE whatsapp_messages ADD COLUMN message_timestamp timestamptz;
  END IF;
END $$;

-- Add unique constraint on (user_id, wa_message_id) for upsert
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'whatsapp_messages_user_wa_id_unique'
  ) THEN
    -- First clean up any existing duplicates
    DELETE FROM whatsapp_messages a
    USING whatsapp_messages b
    WHERE a.id > b.id
      AND a.user_id = b.user_id
      AND a.wa_message_id = b.wa_message_id
      AND a.wa_message_id IS NOT NULL;

    CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_messages_user_wa_id_unique
      ON whatsapp_messages(user_id, wa_message_id)
      WHERE wa_message_id IS NOT NULL;
  END IF;
END $$;

-- Add unique constraint on whatsapp_conversations (user_id, remote_phone)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'whatsapp_conversations_user_phone_unique'
  ) THEN
    -- Clean up any existing duplicates (keep most recent)
    DELETE FROM whatsapp_conversations a
    USING whatsapp_conversations b
    WHERE a.id < b.id
      AND a.user_id = b.user_id
      AND a.remote_phone = b.remote_phone;

    CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_conversations_user_phone_unique
      ON whatsapp_conversations(user_id, remote_phone);
  END IF;
END $$;

-- Expand audit log action types
ALTER TABLE whatsapp_audit_log DROP CONSTRAINT IF EXISTS whatsapp_audit_log_action_check;
ALTER TABLE whatsapp_audit_log ADD CONSTRAINT whatsapp_audit_log_action_check
  CHECK (action IN (
    'connect', 'disconnect', 'error', 'admin_view', 'send_message',
    'qr_generated', 'session_expired', 'disconnected',
    'sync_history_started', 'sync_history_completed', 'sync_history_error',
    'media_download_started', 'media_download_completed', 'media_download_error',
    'reconnect'
  ));

-- Expand message_type to support more types
ALTER TABLE whatsapp_messages DROP CONSTRAINT IF EXISTS whatsapp_messages_message_type_check;
ALTER TABLE whatsapp_messages ADD CONSTRAINT whatsapp_messages_message_type_check
  CHECK (message_type IN ('text', 'image', 'document', 'audio', 'video', 'sticker', 'location', 'contact', 'voice_note', 'unknown'));

-- Create whatsapp-media storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'whatsapp-media',
  'whatsapp-media',
  false,
  104857600, -- 100MB
  NULL -- allow all mime types
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for whatsapp-media
DO $$
BEGIN
  -- Users can read their own media
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can read own whatsapp media' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "Users can read own whatsapp media"
      ON storage.objects FOR SELECT
      TO authenticated
      USING (
        bucket_id = 'whatsapp-media'
        AND (storage.foldername(name))[1] = auth.uid()::text
      );
  END IF;

  -- Users can upload their own media
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can upload own whatsapp media' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "Users can upload own whatsapp media"
      ON storage.objects FOR INSERT
      TO authenticated
      WITH CHECK (
        bucket_id = 'whatsapp-media'
        AND (storage.foldername(name))[1] = auth.uid()::text
      );
  END IF;
END $$;

-- Add index for message_timestamp ordering
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_timestamp
  ON whatsapp_messages(conversation_id, message_timestamp DESC NULLS LAST);

-- Add index for media download status (to find pending downloads)
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_media_pending
  ON whatsapp_messages(user_id, media_download_status)
  WHERE media_download_status = 'pending';
