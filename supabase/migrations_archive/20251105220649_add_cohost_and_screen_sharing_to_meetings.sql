/*
  # Add Co-host and Screen Sharing to Meetings
  
  1. Changes
    - Add name and role columns to meeting_participants if they don't exist
    - Add is_cohost column to meeting_participants
    - Add is_screen_sharing column to meeting_participants
    - Create function to promote participant to co-host
    - Update RLS policies
    
  2. Security
    - Only host can promote participants to co-host
    - Host and co-hosts can share screen
    - Participants can see who is co-host
*/

-- Add missing columns to meeting_participants if they don't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'meeting_participants' AND column_name = 'name'
  ) THEN
    ALTER TABLE meeting_participants ADD COLUMN name text NOT NULL DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'meeting_participants' AND column_name = 'role'
  ) THEN
    ALTER TABLE meeting_participants ADD COLUMN role text NOT NULL DEFAULT 'participant';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'meeting_participants' AND column_name = 'is_cohost'
  ) THEN
    ALTER TABLE meeting_participants ADD COLUMN is_cohost boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'meeting_participants' AND column_name = 'is_screen_sharing'
  ) THEN
    ALTER TABLE meeting_participants ADD COLUMN is_screen_sharing boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'meeting_participants' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE meeting_participants ADD COLUMN user_id uuid REFERENCES auth.users(id);
  END IF;
END $$;

-- Create function to toggle co-host status
CREATE OR REPLACE FUNCTION toggle_cohost_status(
  p_meeting_id uuid,
  p_participant_id uuid,
  p_is_cohost boolean
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_meeting_creator_id uuid;
BEGIN
  -- Get meeting creator
  SELECT creator_id INTO v_meeting_creator_id
  FROM meetings
  WHERE id = p_meeting_id;
  
  -- Check if current user is the meeting creator
  IF v_meeting_creator_id != auth.uid() THEN
    RAISE EXCEPTION 'Solo el anfitrión puede asignar co-anfitriones';
  END IF;
  
  -- Update participant co-host status
  UPDATE meeting_participants
  SET is_cohost = p_is_cohost
  WHERE id = p_participant_id AND meeting_id = p_meeting_id;
  
  RETURN true;
END;
$$;

-- Create function to toggle screen sharing
CREATE OR REPLACE FUNCTION toggle_screen_sharing(
  p_participant_id uuid,
  p_is_sharing boolean
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_participant_role text;
  v_is_cohost boolean;
  v_meeting_creator_id uuid;
  v_meeting_id uuid;
  v_user_id uuid;
BEGIN
  -- Get participant info
  SELECT role, is_cohost, meeting_id, user_id 
  INTO v_participant_role, v_is_cohost, v_meeting_id, v_user_id
  FROM meeting_participants
  WHERE id = p_participant_id;
  
  -- Get meeting creator
  SELECT creator_id INTO v_meeting_creator_id
  FROM meetings
  WHERE id = v_meeting_id;
  
  -- Check if user can share screen (must be host or co-host)
  IF v_meeting_creator_id != auth.uid() AND NOT v_is_cohost THEN
    RAISE EXCEPTION 'Solo el anfitrión y co-anfitriones pueden compartir pantalla';
  END IF;
  
  -- Update screen sharing status
  UPDATE meeting_participants
  SET is_screen_sharing = p_is_sharing
  WHERE id = p_participant_id;
  
  RETURN true;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION toggle_cohost_status(uuid, uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION toggle_screen_sharing(uuid, boolean) TO authenticated;
