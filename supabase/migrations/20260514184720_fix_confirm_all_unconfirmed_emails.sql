/*
  # Confirm all unconfirmed user emails

  1. Changes
    - Sets `email_confirmed_at` to `now()` for all users in auth.users where it is NULL
    - This fixes the "Email not confirmed" error blocking login
    - Per project requirements, email confirmation must be DISABLED

  2. Important Notes
    - 50 users currently affected
    - All were created via register-employee with email_confirm: false
    - This is a one-time fix; the edge function will also be updated to prevent recurrence
*/

UPDATE auth.users
SET email_confirmed_at = now()
WHERE email_confirmed_at IS NULL;
