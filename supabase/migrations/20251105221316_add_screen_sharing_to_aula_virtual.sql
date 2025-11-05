/*
  # Add Screen Sharing to Aula Virtual
  
  1. Changes
    - Add is_screen_sharing column to aula_virtual_participantes
    - Create function to toggle screen sharing for instructors
    
  2. Security
    - Only instructors can share screen
    - Function validates instructor role before allowing
*/

-- Add screen sharing tracking column
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'aula_virtual_participantes' AND column_name = 'is_screen_sharing'
  ) THEN
    ALTER TABLE aula_virtual_participantes ADD COLUMN is_screen_sharing boolean DEFAULT false;
  END IF;
END $$;

-- Create function to toggle screen sharing for aula virtual
CREATE OR REPLACE FUNCTION toggle_aula_screen_sharing(
  p_participant_id uuid,
  p_is_sharing boolean
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_puede_compartir boolean;
  v_rol_participante text;
BEGIN
  -- Get participant info
  SELECT puede_compartir_pantalla, rol_participante
  INTO v_puede_compartir, v_rol_participante
  FROM aula_virtual_participantes
  WHERE id = p_participant_id;
  
  -- Check if participant can share screen (must be instructor or have permission)
  IF NOT v_puede_compartir THEN
    RAISE EXCEPTION 'Solo los instructores pueden compartir pantalla';
  END IF;
  
  -- Update screen sharing status
  UPDATE aula_virtual_participantes
  SET is_screen_sharing = p_is_sharing
  WHERE id = p_participant_id;
  
  RETURN true;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION toggle_aula_screen_sharing(uuid, boolean) TO authenticated;
