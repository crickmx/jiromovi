/*
  # Add phone_number to commission_agents

  1. Changes
    - Add phone_number column to commission_agents
    - Update sync function to copy phone from usuarios
    - Sync existing data
*/

-- Add phone_number column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'commission_agents' AND column_name = 'phone_number'
  ) THEN
    ALTER TABLE commission_agents 
    ADD COLUMN phone_number text;
  END IF;
END $$;

-- Update sync function to include phone_number
CREATE OR REPLACE FUNCTION sync_usuario_to_commission_agent()
RETURNS TRIGGER AS $$
DECLARE
  v_commission_office_id uuid;
  v_phone text;
BEGIN
  -- Only sync if user has email_laboral
  IF NEW.email_laboral IS NOT NULL AND NEW.email_laboral != '' THEN
    
    -- Get the commission_office_id from the oficina_id
    v_commission_office_id := NULL;
    IF NEW.oficina_id IS NOT NULL THEN
      SELECT id INTO v_commission_office_id
      FROM commission_offices
      WHERE oficina_id = NEW.oficina_id;
    END IF;
    
    -- Prioritize celular_laboral, fallback to celular_personal
    v_phone := COALESCE(NEW.celular_laboral, NEW.celular_personal);
    
    -- Insert or update commission agent
    INSERT INTO commission_agents (
      usuario_id,
      name,
      email,
      phone_number,
      office_id,
      created_at
    ) VALUES (
      NEW.id,
      NEW.nombre_completo,
      NEW.email_laboral,
      v_phone,
      v_commission_office_id,
      NOW()
    )
    ON CONFLICT (usuario_id) 
    DO UPDATE SET
      name = EXCLUDED.name,
      email = EXCLUDED.email,
      phone_number = EXCLUDED.phone_number,
      office_id = EXCLUDED.office_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Sync phone_number for existing commission_agents
UPDATE commission_agents ca
SET phone_number = COALESCE(u.celular_laboral, u.celular_personal)
FROM usuarios u
WHERE ca.usuario_id = u.id
  AND ca.phone_number IS NULL;
