/*
  # Create SICAS Delivery Resolutions Table

  1. New Tables
    - `sicas_delivery_resolutions`
      - `id` (uuid, primary key)
      - `delivery_id` (uuid, FK to policy_deliveries)
      - `policy_number` (text)
      - `insured_name` (text)
      - `premium` (numeric)
      - `start_date` (date)
      - `end_date` (date)
      - `sicas_client_id` (integer)
      - `sicas_vendor_id` (integer)
      - `sicas_executive_id` (integer)
      - `sicas_group_id` (integer, default 25)
      - `sicas_currency_id` (integer, default 1)
      - `sicas_payment_form_id` (integer, default 1)
      - `status` (text, default 'V')
      - `sources_json` (jsonb)
      - `confidence_json` (jsonb)
      - `missing_fields_json` (jsonb)
      - `auto_resolved` (boolean, default true)
      - `resolution_status` (text)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS
    - Policies for authenticated users (admin/gerente write, all read)

  3. Notes
    - One resolution per delivery (upsert pattern)
    - Stores auto-resolved field values with source tracking
    - Used by auto-resolve process before HWCAPTURE registration
*/

CREATE TABLE IF NOT EXISTS sicas_delivery_resolutions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id uuid NOT NULL REFERENCES policy_deliveries(id) ON DELETE CASCADE,
  policy_number text,
  insured_name text,
  premium numeric,
  start_date date,
  end_date date,
  sicas_client_id integer,
  sicas_vendor_id integer,
  sicas_executive_id integer,
  sicas_group_id integer DEFAULT 25,
  sicas_currency_id integer DEFAULT 1,
  sicas_payment_form_id integer DEFAULT 1,
  status text DEFAULT 'V',
  sources_json jsonb DEFAULT '{}'::jsonb,
  confidence_json jsonb DEFAULT '{}'::jsonb,
  missing_fields_json jsonb DEFAULT '[]'::jsonb,
  auto_resolved boolean DEFAULT true,
  resolution_status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT sicas_delivery_resolutions_delivery_unique UNIQUE (delivery_id)
);

CREATE INDEX IF NOT EXISTS idx_sicas_delivery_resolutions_delivery_id ON sicas_delivery_resolutions(delivery_id);

ALTER TABLE sicas_delivery_resolutions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view resolutions"
  ON sicas_delivery_resolutions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin and gerente can insert resolutions"
  ON sicas_delivery_resolutions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol IN ('admin', 'gerente', 'ejecutivo')
    )
  );

CREATE POLICY "Admin and gerente can update resolutions"
  ON sicas_delivery_resolutions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol IN ('admin', 'gerente', 'ejecutivo')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol IN ('admin', 'gerente', 'ejecutivo')
    )
  );

CREATE POLICY "Service role full access to resolutions"
  ON sicas_delivery_resolutions FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
