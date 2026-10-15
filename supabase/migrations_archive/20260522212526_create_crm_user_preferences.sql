/*
  # Create CRM User Preferences

  1. New Tables
    - `crm_user_preferences`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references usuarios)
      - `default_view` (text: 'dashboard', 'tabla', 'tarjetas', 'kanban')
      - `dashboard_blocks` (jsonb: which blocks to show in "Que hacer hoy")
      - `table_columns` (jsonb: which columns to show in table view)
      - `saved_filters` (jsonb: saved filter presets)
      - `no_contact_hours` (integer: hours before lead is considered "sin seguimiento")
      - `automations_active` (boolean)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS
    - Users can only read/update their own preferences
*/

CREATE TABLE IF NOT EXISTS crm_user_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  default_view text NOT NULL DEFAULT 'dashboard',
  dashboard_blocks jsonb NOT NULL DEFAULT '["leads_nuevos","tareas_vencidas","tareas_hoy","sin_seguimiento","seguimiento_cotizaciones"]'::jsonb,
  table_columns jsonb NOT NULL DEFAULT '["nombre_completo","celular","estatus","fuente_origen","tipo_seguro","fecha_creacion"]'::jsonb,
  saved_filters jsonb NOT NULL DEFAULT '[]'::jsonb,
  no_contact_hours integer NOT NULL DEFAULT 24,
  automations_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE crm_user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own CRM preferences"
  ON crm_user_preferences
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own CRM preferences"
  ON crm_user_preferences
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own CRM preferences"
  ON crm_user_preferences
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
