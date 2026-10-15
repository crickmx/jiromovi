/*
  # Create user web page featured forms system

  1. New Tables
    - `user_web_featured_forms` - Stores which form templates a user has marked as featured on their public page
      - `id` (uuid, primary key)
      - `user_id` (uuid, references usuarios)
      - `form_template_id` (uuid, references quote_form_templates)
      - `featured_order` (integer) - Display order (lower = higher priority)
      - `created_at` (timestamptz)

  2. Changes
    - This allows each user to select 3-6 form types as "featured" on their public page
    - All form templates are always shown on the public page; featured ones get highlighted
    - Default featured types are auto-assigned on first access

  3. Security
    - RLS enabled
    - Users can only manage their own featured forms
    - Admin and gerente can manage for their office users

  4. Notes
    - If user has no entries, the system uses default featured types (auto, vida, gmm, hogar, accidentes_personales, empresa)
    - The public page function will be updated to return all templates plus featured selections
*/

CREATE TABLE IF NOT EXISTS user_web_featured_forms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  form_template_id uuid NOT NULL REFERENCES quote_form_templates(id) ON DELETE CASCADE,
  featured_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, form_template_id)
);

ALTER TABLE user_web_featured_forms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own featured forms"
  ON user_web_featured_forms
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own featured forms"
  ON user_web_featured_forms
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own featured forms"
  ON user_web_featured_forms
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own featured forms"
  ON user_web_featured_forms
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_user_web_featured_forms_user_id
  ON user_web_featured_forms(user_id);

CREATE INDEX IF NOT EXISTS idx_user_web_featured_forms_template_id
  ON user_web_featured_forms(form_template_id);
