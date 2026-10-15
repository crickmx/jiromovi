/*
  # Fix WhatsApp send message issues and create contacts table

  1. Modified Tables
    - `whatsapp_conversations`
      - Make `session_id` nullable (edge function creates conversations during send without session reference)
    
  2. New Tables
    - `whatsapp_contacts` — Per-user contact name resolution
      - `id` (uuid, primary key)
      - `user_id` (uuid, FK to auth.users) — owner
      - `jid` (text) — WhatsApp JID (phone@s.whatsapp.net)
      - `phone` (text) — normalized phone number
      - `display_name` (text) — computed best name (read by UI)
      - `saved_name` (text) — name from contacts.set (phone book)
      - `local_alias` (text) — user-defined alias in MOVI
      - `push_name` (text) — from pushName in messages
      - `notify_name` (text) — from notifyName/notify in contacts
      - `profile_name` (text) — profile name
      - `verified_name` (text) — verified business name
      - `business_name` (text) — business name
      - `short_name` (text) — short name
      - `is_business` (boolean, default false)
      - `profile_pic_url` (text) — avatar URL
      - `raw_contact_data` (jsonb) — full contact data for debugging
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  3. Security
    - RLS enabled on whatsapp_contacts
    - Users can only CRUD their own contacts
    - Unique constraint on (user_id, phone) to prevent duplicates

  4. Important Notes
    - session_id made nullable so edge function can insert conversations during message send
    - display_name is computed via priority: local_alias > saved_name > notify_name > push_name > verified_name > business_name > phone
    - Service role used by whatsapp-server bypasses RLS for sync operations
*/

-- Make session_id nullable on whatsapp_conversations
ALTER TABLE whatsapp_conversations ALTER COLUMN session_id DROP NOT NULL;

-- Create whatsapp_contacts table
CREATE TABLE IF NOT EXISTS whatsapp_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  jid text,
  phone text NOT NULL,
  display_name text,
  saved_name text,
  local_alias text,
  push_name text,
  notify_name text,
  profile_name text,
  verified_name text,
  business_name text,
  short_name text,
  is_business boolean NOT NULL DEFAULT false,
  profile_pic_url text,
  raw_contact_data jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Unique constraint: one contact per user per phone
CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_contacts_user_phone
  ON whatsapp_contacts(user_id, phone);

-- Index for lookups
CREATE INDEX IF NOT EXISTS idx_whatsapp_contacts_user_id
  ON whatsapp_contacts(user_id);

-- Enable RLS
ALTER TABLE whatsapp_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own contacts"
  ON whatsapp_contacts FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own contacts"
  ON whatsapp_contacts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own contacts"
  ON whatsapp_contacts FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own contacts"
  ON whatsapp_contacts FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Auto-update updated_at trigger
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_whatsapp_contacts_updated_at') THEN
    CREATE TRIGGER trg_whatsapp_contacts_updated_at
      BEFORE UPDATE ON whatsapp_contacts
      FOR EACH ROW EXECUTE FUNCTION update_whatsapp_updated_at();
  END IF;
END $$;

-- Function to compute display_name based on priority
CREATE OR REPLACE FUNCTION compute_whatsapp_display_name()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.display_name = COALESCE(
    NULLIF(TRIM(NEW.local_alias), ''),
    NULLIF(TRIM(NEW.saved_name), ''),
    NULLIF(TRIM(NEW.notify_name), ''),
    NULLIF(TRIM(NEW.push_name), ''),
    NULLIF(TRIM(NEW.verified_name), ''),
    NULLIF(TRIM(NEW.business_name), ''),
    NULLIF(TRIM(NEW.short_name), ''),
    NULLIF(TRIM(NEW.profile_name), ''),
    NEW.phone
  );
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_whatsapp_contacts_display_name') THEN
    CREATE TRIGGER trg_whatsapp_contacts_display_name
      BEFORE INSERT OR UPDATE ON whatsapp_contacts
      FOR EACH ROW EXECUTE FUNCTION compute_whatsapp_display_name();
  END IF;
END $$;
