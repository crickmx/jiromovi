/*
  # Fix passwordless_login_tokens: add 'chava' to platform constraint

  ## Problem
  The platform CHECK constraint on passwordless_login_tokens only allows 'movi' and 'seguwallet'.
  The send-login-code edge function uses platform='chava' for agentedeseguros.ai users, causing
  a CHECK constraint violation (HTTP 500) when users try to log in or register.

  ## Changes
  - Drop existing platform CHECK constraint
  - Re-add constraint with 'chava' included
*/

ALTER TABLE passwordless_login_tokens
DROP CONSTRAINT IF EXISTS passwordless_login_tokens_platform_check;

ALTER TABLE passwordless_login_tokens
ADD CONSTRAINT passwordless_login_tokens_platform_check
CHECK (platform = ANY (ARRAY['movi'::text, 'seguwallet'::text, 'chava'::text]));
