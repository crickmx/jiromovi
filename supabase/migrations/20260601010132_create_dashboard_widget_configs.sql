/*
  # Dashboard Widget Configuration System

  ## Summary
  Creates a per-user, per-role dashboard configuration system that stores widget
  layout preferences, visibility, position, and custom settings.

  ## New Tables
  - `dashboard_widget_configs` — stores each user's widget configuration
    - `id` (uuid, pk)
    - `usuario_id` (uuid, fk → usuarios)
    - `widget_id` (text) — identifier like 'produccion', 'comisiones', etc.
    - `rol` (text) — the role this config belongs to
    - `visible` (boolean)
    - `position` (integer) — sort order
    - `width` (text) — 'full' | 'half' | 'third'
    - `custom_settings` (jsonb)
    - `created_at`, `updated_at`

  ## Security
  - RLS enabled
  - Users can only read/write their own configs
*/

CREATE TABLE IF NOT EXISTS dashboard_widget_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  widget_id text NOT NULL,
  rol text NOT NULL,
  visible boolean NOT NULL DEFAULT true,
  position integer NOT NULL DEFAULT 0,
  width text NOT NULL DEFAULT 'half' CHECK (width IN ('full', 'half', 'third')),
  custom_settings jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS dashboard_widget_configs_user_widget_idx
  ON dashboard_widget_configs(usuario_id, widget_id);

CREATE INDEX IF NOT EXISTS dashboard_widget_configs_usuario_id_idx
  ON dashboard_widget_configs(usuario_id);

ALTER TABLE dashboard_widget_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own dashboard configs"
  ON dashboard_widget_configs FOR SELECT
  TO authenticated
  USING (auth.uid() = usuario_id);

CREATE POLICY "Users can insert own dashboard configs"
  ON dashboard_widget_configs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = usuario_id);

CREATE POLICY "Users can update own dashboard configs"
  ON dashboard_widget_configs FOR UPDATE
  TO authenticated
  USING (auth.uid() = usuario_id)
  WITH CHECK (auth.uid() = usuario_id);

CREATE POLICY "Users can delete own dashboard configs"
  ON dashboard_widget_configs FOR DELETE
  TO authenticated
  USING (auth.uid() = usuario_id);
