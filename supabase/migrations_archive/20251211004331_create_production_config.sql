/*
  # Crear tabla de configuración de producción

  1. Nueva tabla
    - `production_config`
      - `id` (uuid, primary key)
      - `google_sheet_url` (text) - URL del Google Sheet configurado
      - `auto_sync_enabled` (boolean) - Si está habilitada la sincronización automática
      - `sync_frequency_hours` (integer) - Frecuencia de sincronización en horas
      - `last_sync_at` (timestamptz) - Última vez que se sincronizó
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Seguridad
    - Habilitar RLS
    - Solo administradores pueden leer y modificar la configuración
*/

CREATE TABLE IF NOT EXISTS production_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  google_sheet_url text,
  auto_sync_enabled boolean DEFAULT false,
  sync_frequency_hours integer DEFAULT 24,
  last_sync_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE production_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view production config"
  ON production_config
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'administrador'
    )
  );

CREATE POLICY "Admins can update production config"
  ON production_config
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'administrador'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'administrador'
    )
  );

CREATE POLICY "Admins can insert production config"
  ON production_config
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'administrador'
    )
  );

CREATE TRIGGER update_production_config_updated_at
  BEFORE UPDATE ON production_config
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

INSERT INTO production_config (google_sheet_url, auto_sync_enabled, sync_frequency_hours)
VALUES ('https://docs.google.com/spreadsheets/d/1FladEQiSlbwHQoBKGtPMq5WI-MSXYPm2HcfUZsEadbk/edit?usp=sharing', false, 24)
ON CONFLICT DO NOTHING;
