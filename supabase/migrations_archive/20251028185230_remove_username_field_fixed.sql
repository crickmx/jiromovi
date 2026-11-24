/*
  # Remove Username Field from Authentication

  1. Changes
    - Update empty email_laboral values with temporary emails
    - Make email_laboral NOT NULL and UNIQUE (primary login identifier)
    - Drop the username column from usuarios table

  2. Rationale
    - Users will now login exclusively with their email_laboral and password
    - Removes redundant username field
    - Simplifies authentication flow
*/

-- Update any empty email_laboral values with username-based temporary emails
UPDATE usuarios 
SET email_laboral = username || '@jiro.mx'
WHERE email_laboral IS NULL OR email_laboral = '';

-- Make email_laboral NOT NULL
ALTER TABLE usuarios ALTER COLUMN email_laboral SET NOT NULL;

-- Add UNIQUE constraint to email_laboral
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'usuarios_email_laboral_key'
  ) THEN
    ALTER TABLE usuarios ADD CONSTRAINT usuarios_email_laboral_key UNIQUE (email_laboral);
  END IF;
END $$;

-- Drop the username column
ALTER TABLE usuarios DROP COLUMN IF EXISTS username;
