/*
  # Reset User Passwords for Login

  ## Overview
  Resets all user passwords to a known value for testing and ensures:
  - All users are active
  - All emails are confirmed
  - Passwords are properly hashed
  - Users can login from app.movi.digital

  ## Changes
    - Updates all user passwords to: Movi2024!
    - Confirms all email addresses
    - Ensures all users are active
    - Updates user metadata

  ## Users Updated
    - ccjimenez@jiro.com.mx (Administrador)
    - ccjimenez@jiro.mx (Gerente)
    - pjimenez@jiro.mx (Empleado)
    - test@jiro.mx (Empleado)
    - zacatecas@jiro.mx (Empleado)

  ## Notes
    - Password: Movi2024!
    - All emails are auto-confirmed
    - All users are set to active
*/

-- Function to update user password using pgcrypto
CREATE OR REPLACE FUNCTION reset_user_password(
  user_id uuid,
  new_password text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update the user's password using Supabase's auth schema
  UPDATE auth.users
  SET
    encrypted_password = crypt(new_password, gen_salt('bf')),
    email_confirmed_at = COALESCE(email_confirmed_at, now()),
    updated_at = now()
  WHERE id = user_id;
END;
$$;

-- Reset passwords for all users
-- Password: Movi2024!

-- Administrador
SELECT reset_user_password(
  '56bf0f1d-eed1-46b3-8b62-ba43b2d4e4a2'::uuid,
  'Movi2024!'
);

-- Gerente
SELECT reset_user_password(
  '7c27453e-210b-47c5-bee6-c89bc35552f8'::uuid,
  'Movi2024!'
);

-- Empleado (Pablo)
SELECT reset_user_password(
  'a32f517a-011f-4d50-be6a-eb81c054def9'::uuid,
  'Movi2024!'
);

-- Empleado (Test)
SELECT reset_user_password(
  'a96ec335-6c2d-43eb-b69e-dc59872adfb5'::uuid,
  'Movi2024!'
);

-- Empleado (Zacatecas)
SELECT reset_user_password(
  '9c55f1aa-8477-4b89-adfd-4af21ac9efe9'::uuid,
  'Movi2024!'
);

-- Ensure all users are active in usuarios table
UPDATE usuarios
SET 
  activo = true,
  estado = 'activo'
WHERE id IN (
  '56bf0f1d-eed1-46b3-8b62-ba43b2d4e4a2',
  '7c27453e-210b-47c5-bee6-c89bc35552f8',
  'a32f517a-011f-4d50-be6a-eb81c054def9',
  'a96ec335-6c2d-43eb-b69e-dc59872adfb5',
  '9c55f1aa-8477-4b89-adfd-4af21ac9efe9'
);

-- Confirm all emails in auth.users
UPDATE auth.users
SET 
  email_confirmed_at = COALESCE(email_confirmed_at, now()),
  updated_at = now()
WHERE id IN (
  '56bf0f1d-eed1-46b3-8b62-ba43b2d4e4a2',
  '7c27453e-210b-47c5-bee6-c89bc35552f8',
  'a32f517a-011f-4d50-be6a-eb81c054def9',
  'a96ec335-6c2d-43eb-b69e-dc59872adfb5',
  '9c55f1aa-8477-4b89-adfd-4af21ac9efe9'
);
