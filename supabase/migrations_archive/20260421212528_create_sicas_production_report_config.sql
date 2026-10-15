/*
  # SICAS Production Report Configuration

  1. New Tables
    - `sicas_production_config` - configurable filter fields and keycodes for SICAS reports
      - `id` (uuid, primary key)
      - `report_filter_mode` (text) - vendor | agent | custom
      - `report_filter_field` (text) - SICAS field to filter by (e.g. DatDocumentos.IDVend)
      - `report_keycode_all` (text) - keycode for all documents
      - `report_keycode_policies` (text) - keycode for policies only
      - `report_keycode_bonds` (text) - keycode for bonds only
      - `detail_keycode` (text) - keycode for document detail
      - `detail_identity_field` (text) - SICAS identity for digital center
      - `fields_requested_list` (text) - comma-separated fields for list view
      - `default_page_size` (int) - default page size
      - `activo` (boolean) - active config

  2. Security
    - RLS enabled
    - Only admin can manage
    - Service role has full access
*/

CREATE TABLE IF NOT EXISTS sicas_production_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_filter_mode text NOT NULL DEFAULT 'vendor',
  report_filter_field text NOT NULL DEFAULT 'DatDocumentos.IDVend',
  report_keycode_all text NOT NULL DEFAULT 'HWS_DOCTOS',
  report_keycode_policies text NOT NULL DEFAULT 'HWSDOC',
  report_keycode_bonds text NOT NULL DEFAULT 'HWSInventario',
  detail_keycode text NOT NULL DEFAULT 'HWCAPTURE',
  detail_identity_field text NOT NULL DEFAULT 'H02',
  fields_requested_list text DEFAULT '',
  default_page_size integer NOT NULL DEFAULT 25,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE sicas_production_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sicas_production_config_select_admin"
  ON sicas_production_config FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'Administrador')
  );

CREATE POLICY "sicas_production_config_update_admin"
  ON sicas_production_config FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'Administrador')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'Administrador')
  );

CREATE POLICY "sicas_production_config_select_service"
  ON sicas_production_config FOR SELECT TO service_role
  USING (true);

-- Insert default configuration
INSERT INTO sicas_production_config (
  report_filter_mode,
  report_filter_field,
  report_keycode_all,
  report_keycode_policies,
  report_keycode_bonds,
  detail_keycode,
  detail_identity_field,
  default_page_size,
  activo
) VALUES (
  'vendor',
  'DatDocumentos.IDVend',
  'HWS_DOCTOS',
  'HWSDOC',
  'HWSInventario',
  'HWCAPTURE',
  'H02',
  25,
  true
);
