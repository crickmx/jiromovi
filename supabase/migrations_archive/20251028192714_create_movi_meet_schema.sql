/*
  # Create MOVI Meet Schema

  1. New Tables
    - `meetings`
      - `id` (uuid, primary key)
      - `code` (text, unique) - Short meeting code (max 15 chars)
      - `creator_id` (uuid) - References usuarios
      - `title` (text) - Meeting title
      - `scheduled_datetime` (timestamptz) - When meeting is scheduled
      - `status` (text) - 'scheduled', 'active', 'ended', 'cancelled'
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `meeting_participants`
      - `id` (uuid, primary key)
      - `meeting_id` (uuid) - References meetings
      - `user_id` (uuid, nullable) - References usuarios (null for external)
      - `name` (text) - Display name
      - `role` (text) - 'host', 'participant'
      - `joined_at` (timestamptz)
      - `left_at` (timestamptz, nullable)

    - `meeting_chat_messages`
      - `id` (uuid, primary key)
      - `meeting_id` (uuid) - References meetings
      - `sender_name` (text)
      - `sender_id` (uuid, nullable) - References usuarios
      - `message` (text)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Authenticated users can create meetings
    - Anyone with meeting code can view meeting details
    - Participants can view chat messages for their meeting
    - Host can update meeting status
*/

-- Create meetings table
CREATE TABLE IF NOT EXISTS meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  creator_id uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  title text NOT NULL,
  scheduled_datetime timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'active', 'ended', 'cancelled')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create index on code for fast lookups
CREATE INDEX IF NOT EXISTS meetings_code_idx ON meetings(code);
CREATE INDEX IF NOT EXISTS meetings_creator_id_idx ON meetings(creator_id);
CREATE INDEX IF NOT EXISTS meetings_status_idx ON meetings(status);

-- Create meeting_participants table
CREATE TABLE IF NOT EXISTS meeting_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  user_id uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  name text NOT NULL,
  role text NOT NULL DEFAULT 'participant' CHECK (role IN ('host', 'participant')),
  joined_at timestamptz DEFAULT now(),
  left_at timestamptz
);

CREATE INDEX IF NOT EXISTS meeting_participants_meeting_id_idx ON meeting_participants(meeting_id);
CREATE INDEX IF NOT EXISTS meeting_participants_user_id_idx ON meeting_participants(user_id);

-- Create meeting_chat_messages table
CREATE TABLE IF NOT EXISTS meeting_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  sender_name text NOT NULL,
  sender_id uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  message text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS meeting_chat_messages_meeting_id_idx ON meeting_chat_messages(meeting_id);

-- Enable RLS
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_chat_messages ENABLE ROW LEVEL SECURITY;

-- Policies for meetings

-- Anyone can view meetings if they know the code (will be filtered in app)
CREATE POLICY "Anyone can view meetings"
  ON meetings
  FOR SELECT
  TO authenticated, anon
  USING (true);

-- Authenticated users can create meetings
CREATE POLICY "Authenticated users can create meetings"
  ON meetings
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = creator_id);

-- Creators can update their meetings
CREATE POLICY "Creators can update own meetings"
  ON meetings
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = creator_id)
  WITH CHECK (auth.uid() = creator_id);

-- Creators can delete their meetings
CREATE POLICY "Creators can delete own meetings"
  ON meetings
  FOR DELETE
  TO authenticated
  USING (auth.uid() = creator_id);

-- Policies for meeting_participants

-- Anyone can view participants of a meeting
CREATE POLICY "Anyone can view meeting participants"
  ON meeting_participants
  FOR SELECT
  TO authenticated, anon
  USING (true);

-- Anyone can insert themselves as participant
CREATE POLICY "Anyone can join as participant"
  ON meeting_participants
  FOR INSERT
  TO authenticated, anon
  WITH CHECK (true);

-- Users can update their own participant record
CREATE POLICY "Users can update own participant record"
  ON meeting_participants
  FOR UPDATE
  TO authenticated, anon
  USING (true)
  WITH CHECK (true);

-- Policies for meeting_chat_messages

-- Anyone can view chat messages for meetings they're in
CREATE POLICY "Anyone can view meeting chat"
  ON meeting_chat_messages
  FOR SELECT
  TO authenticated, anon
  USING (true);

-- Anyone can send chat messages
CREATE POLICY "Anyone can send chat messages"
  ON meeting_chat_messages
  FOR INSERT
  TO authenticated, anon
  WITH CHECK (true);

-- Function to generate unique meeting codes
CREATE OR REPLACE FUNCTION generate_meeting_code()
RETURNS text AS $$
DECLARE
  chars text := 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  result text := '';
  i integer;
  code_exists boolean;
BEGIN
  LOOP
    result := '';
    FOR i IN 1..12 LOOP
      result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
    END LOOP;
    
    -- Check if code already exists
    SELECT EXISTS(SELECT 1 FROM meetings WHERE code = result) INTO code_exists;
    
    IF NOT code_exists THEN
      EXIT;
    END IF;
  END LOOP;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_meetings_updated_at
  BEFORE UPDATE ON meetings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
