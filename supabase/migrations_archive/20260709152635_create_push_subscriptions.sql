/*
# Create push_subscriptions table for Web Push Notifications

1. New Tables
  - `push_subscriptions`
    - `id` (uuid, primary key)
    - `usuario_id` (uuid, FK to auth.users, not null)
    - `endpoint` (text, not null) - the push service URL
    - `p256dh` (text, not null) - client public key
    - `auth_key` (text, not null) - client auth secret
    - `created_at` (timestamptz)
    - `updated_at` (timestamptz)
    - Unique constraint on (usuario_id, endpoint) to prevent duplicate subscriptions

2. Security
  - Enable RLS on `push_subscriptions`
  - Authenticated users can manage only their own subscriptions

3. Notes
  - Used by the Web Push notification system to deliver push notifications
    to users' browsers when they receive missed calls
*/

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth_key text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(usuario_id, endpoint)
);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_usuario_id ON push_subscriptions(usuario_id);

DROP POLICY IF EXISTS "select_own_push_subscriptions" ON push_subscriptions;
CREATE POLICY "select_own_push_subscriptions" ON push_subscriptions FOR SELECT
  TO authenticated USING (auth.uid() = usuario_id);

DROP POLICY IF EXISTS "insert_own_push_subscriptions" ON push_subscriptions;
CREATE POLICY "insert_own_push_subscriptions" ON push_subscriptions FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = usuario_id);

DROP POLICY IF EXISTS "update_own_push_subscriptions" ON push_subscriptions;
CREATE POLICY "update_own_push_subscriptions" ON push_subscriptions FOR UPDATE
  TO authenticated USING (auth.uid() = usuario_id) WITH CHECK (auth.uid() = usuario_id);

DROP POLICY IF EXISTS "delete_own_push_subscriptions" ON push_subscriptions;
CREATE POLICY "delete_own_push_subscriptions" ON push_subscriptions FOR DELETE
  TO authenticated USING (auth.uid() = usuario_id);
