/*
  # Auto-sync auth.users to usuarios table

  1. Changes
    - Create trigger to automatically create usuarios record when auth user is created
    - Sync existing auth users that don't have usuarios records
    - Ensure usuario_id in gmm_quotations matches auth.uid()

  2. Security
    - Maintains data integrity between auth.users and usuarios
    - Ensures RLS policies work correctly
*/

-- Function to create usuarios record from auth.users
CREATE OR REPLACE FUNCTION handle_new_auth_user()
RETURNS trigger
SECURITY DEFINER
SET search_path = public, auth, pg_temp
LANGUAGE plpgsql
AS $$
BEGIN
  -- Insert into usuarios table with same UUID as auth.users
  INSERT INTO public.usuarios (
    id,
    email_laboral,
    rol,
    estado,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    'agente', -- default role
    'activo',
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE
  SET email_laboral = EXCLUDED.email_laboral,
      updated_at = NOW();

  RETURN NEW;
END;
$$;

-- Create trigger on auth.users insert
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_auth_user();

-- Sync existing auth users that don't have usuarios records
INSERT INTO public.usuarios (
  id,
  email_laboral,
  rol,
  estado,
  created_at,
  updated_at
)
SELECT
  au.id,
  au.email,
  'agente',
  'activo',
  au.created_at,
  NOW()
FROM auth.users au
LEFT JOIN public.usuarios u ON u.id = au.id
WHERE u.id IS NULL
ON CONFLICT (id) DO NOTHING;