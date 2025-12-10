/*
  # Link Commission Agents to Usuarios

  1. Changes to `commission_agents` table
    - Add `usuario_id` column linking to usuarios table
    - Add unique constraint on usuario_id
    - Update existing records to link based on email_laboral

  2. Function to sync usuarios to commission_agents
    - Automatically creates commission agent when user is created/updated
    - Syncs name and email from usuarios table

  3. Trigger to keep data in sync
    - Runs on insert/update of usuarios
    - Only for users with email_laboral
*/

-- Add usuario_id column to commission_agents
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'commission_agents' AND column_name = 'usuario_id'
  ) THEN
    ALTER TABLE commission_agents 
    ADD COLUMN usuario_id uuid REFERENCES usuarios(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add unique constraint on usuario_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'commission_agents_usuario_id_key'
  ) THEN
    ALTER TABLE commission_agents 
    ADD CONSTRAINT commission_agents_usuario_id_key UNIQUE (usuario_id);
  END IF;
END $$;

-- Create index on usuario_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_commission_agents_usuario_id ON commission_agents(usuario_id);

-- Function to sync usuarios to commission_agents
CREATE OR REPLACE FUNCTION sync_usuario_to_commission_agent()
RETURNS TRIGGER AS $$
DECLARE
  v_commission_office_id uuid;
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
    
    -- Insert or update commission agent
    INSERT INTO commission_agents (
      usuario_id,
      name,
      email,
      office_id,
      created_at
    ) VALUES (
      NEW.id,
      NEW.nombre_completo,
      NEW.email_laboral,
      v_commission_office_id,
      NOW()
    )
    ON CONFLICT (usuario_id) 
    DO UPDATE SET
      name = EXCLUDED.name,
      email = EXCLUDED.email,
      office_id = EXCLUDED.office_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to sync usuarios to commission_agents
DROP TRIGGER IF EXISTS sync_usuario_commission_agent ON usuarios;
CREATE TRIGGER sync_usuario_commission_agent
  AFTER INSERT OR UPDATE ON usuarios
  FOR EACH ROW
  EXECUTE FUNCTION sync_usuario_to_commission_agent();

-- Populate commission_agents with existing usuarios
INSERT INTO commission_agents (usuario_id, name, email, office_id, created_at)
SELECT 
  u.id,
  u.nombre_completo,
  u.email_laboral,
  co.id,
  NOW()
FROM usuarios u
LEFT JOIN commission_offices co ON co.oficina_id = u.oficina_id
WHERE u.email_laboral IS NOT NULL 
  AND u.email_laboral != ''
ON CONFLICT (usuario_id) DO NOTHING;

-- Update email constraint to allow duplicates when linked to usuarios
-- (since usuarios handles uniqueness)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'commission_agents_email_key'
  ) THEN
    ALTER TABLE commission_agents DROP CONSTRAINT commission_agents_email_key;
  END IF;
END $$;
