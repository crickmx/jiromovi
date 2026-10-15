ALTER TABLE telefonia_config
  ADD COLUMN IF NOT EXISTS oauth_token text,
  ADD COLUMN IF NOT EXISTS oauth_token_expires_at timestamptz;