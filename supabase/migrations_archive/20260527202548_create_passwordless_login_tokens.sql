/*
  # Passwordless Login Tokens

  ## Summary
  Creates a secure table for passwordless authentication via 6-character
  alphanumeric codes and magic links. No passwords are stored anywhere.

  ## New Tables
  - `passwordless_login_tokens`
    - `id` (uuid, primary key)
    - `user_id` (uuid, references auth.users) - the user this token belongs to
    - `platform` (text) - 'movi' or 'seguwallet'
    - `email` (text) - email used for lookup
    - `phone` (text, nullable) - phone used for WhatsApp
    - `code_hash` (text) - SHA-256 hash of the 6-char code (never store plain)
    - `magic_token_hash` (text) - SHA-256 hash of the magic link UUID
    - `expires_at` (timestamptz) - 10 minutes from creation
    - `used_at` (timestamptz, nullable) - set when consumed
    - `attempts` (int) - failed verification attempts, max 5
    - `created_at` (timestamptz)
    - `ip_address` (text, nullable)
    - `user_agent` (text, nullable)

  ## Security
  - RLS enabled, only service_role can access (edge functions use service role)
  - Rate limit enforced via application logic (max 1 active token per user)
  - Codes expire after 10 minutes
  - Single use (used_at set on first use)
  - Hashed storage (no plaintext codes or tokens)
*/

CREATE TABLE IF NOT EXISTS passwordless_login_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform text NOT NULL CHECK (platform IN ('movi', 'seguwallet')),
  email text NOT NULL,
  phone text,
  code_hash text NOT NULL,
  magic_token_hash text NOT NULL,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '10 minutes'),
  used_at timestamptz,
  attempts integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  ip_address text,
  user_agent text
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_passwordless_tokens_user_platform
  ON passwordless_login_tokens(user_id, platform);

CREATE INDEX IF NOT EXISTS idx_passwordless_tokens_email
  ON passwordless_login_tokens(email);

CREATE INDEX IF NOT EXISTS idx_passwordless_tokens_expires
  ON passwordless_login_tokens(expires_at)
  WHERE used_at IS NULL;

-- RLS: only service_role can access (edge functions)
ALTER TABLE passwordless_login_tokens ENABLE ROW LEVEL SECURITY;

-- No policies needed for authenticated users - only service role (edge functions) should access this table
-- This keeps authentication tokens completely protected from client-side access
