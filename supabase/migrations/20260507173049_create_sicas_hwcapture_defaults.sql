/*
  # Create SICAS HWCAPTURE Defaults Configuration

  1. New Tables
    - `sicas_hwcapture_defaults`
      - `id` (uuid, primary key)
      - `field_name` (text, unique) - The SICAS field name (e.g., IDTipoDocto, IDMon, IDFPago)
      - `field_label` (text) - Human-readable label in Spanish
      - `default_value` (text) - The default SICAS ID value
      - `default_label` (text) - Human-readable description of the value
      - `catalog_type_id` (int) - Reference to sicas_catalog_types for lookup
      - `is_required` (boolean) - Whether this field is mandatory for HWCAPTURE
      - `notes` (text) - Admin notes
      - `created_at` / `updated_at` (timestamptz)

  2. Security
    - Enable RLS on table
    - Admin-only write access
    - Authenticated read access

  3. Seed Data
    - Insert placeholder defaults that admin must configure with real SICAS IDs
*/

-- Create the defaults configuration table
CREATE TABLE IF NOT EXISTS sicas_hwcapture_defaults (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  field_name text UNIQUE NOT NULL,
  field_label text NOT NULL,
  default_value text,
  default_label text,
  catalog_type_id int REFERENCES sicas_catalog_types(id),
  is_required boolean DEFAULT true,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE sicas_hwcapture_defaults ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read defaults
CREATE POLICY "Authenticated users can read hwcapture defaults"
  ON sicas_hwcapture_defaults FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

-- Only admins can modify (via service role in edge functions)
CREATE POLICY "Service role can manage hwcapture defaults"
  ON sicas_hwcapture_defaults FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Insert required field configurations (values TBD - admin must configure after catalog sync)
INSERT INTO sicas_hwcapture_defaults (field_name, field_label, default_value, default_label, catalog_type_id, is_required, notes)
VALUES
  ('IDTipoDocto', 'Tipo de Documento', NULL, NULL, 24, true, 'ID del tipo de documento en SICAS. Normalmente "Poliza". Sincronizar catalogo tipo 24 para obtener IDs.'),
  ('IDCia', 'Aseguradora (default)', NULL, NULL, 12, false, 'ID de aseguradora default. Solo se usa si no se detecta del documento. Sincronizar catalogo tipo 12.'),
  ('IDRamo', 'Ramo (default)', NULL, NULL, 9, false, 'ID del ramo de seguros default. Sincronizar catalogo tipo 9.'),
  ('IDSubRamo', 'SubRamo (default)', NULL, NULL, 10, false, 'ID del subramo default. Sincronizar catalogo tipo 10.'),
  ('IDMon', 'Moneda (default)', NULL, NULL, 6, true, 'ID de moneda default (Pesos MXN). Sincronizar catalogo tipo 6.'),
  ('IDFPago', 'Forma de Pago (default)', NULL, NULL, 8, false, 'ID de forma de pago default. Sincronizar catalogo tipo 8.'),
  ('IDEjecutivo', 'Ejecutivo (default)', NULL, NULL, 16, true, 'ID del ejecutivo de cuenta default. Sincronizar catalogo tipo 16.'),
  ('IDGrupo', 'Grupo (default)', NULL, NULL, NULL, true, 'ID del grupo default. Revisar si existe catalogo en SICAS o es un valor fijo.'),
  ('Estatus', 'Estatus de Poliza', 'V', 'Vigente', 40, true, 'Estatus del documento. "V" = Vigente. Verificar con catalogo tipo 40 si acepta texto o ID.')
ON CONFLICT (field_name) DO NOTHING;

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_sicas_hwcapture_defaults_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_sicas_hwcapture_defaults_updated_at'
  ) THEN
    CREATE TRIGGER trigger_sicas_hwcapture_defaults_updated_at
      BEFORE UPDATE ON sicas_hwcapture_defaults
      FOR EACH ROW
      EXECUTE FUNCTION update_sicas_hwcapture_defaults_updated_at();
  END IF;
END $$;
