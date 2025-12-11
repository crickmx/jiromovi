/*
  # Configuración de Google Sheets para Producción

  1. Nueva Tabla
    - `production_google_sheets_config`
      - `id` (uuid, primary key)
      - `sheet_url` (text) - URL pública de Google Sheets
      - `sheet_id` (text) - ID extraído del URL
      - `configurado_por_user_id` (uuid) - Usuario que configuró
      - `activo` (boolean) - Si está activo
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS
    - Solo Administradores pueden configurar
    - Todos los usuarios autenticados pueden leer
*/

CREATE TABLE IF NOT EXISTS production_google_sheets_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sheet_url text NOT NULL,
  sheet_id text NOT NULL,
  configurado_por_user_id uuid REFERENCES usuarios(id),
  activo boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE production_google_sheets_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage Google Sheets config"
  ON production_google_sheets_config
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = configurado_por_user_id
      AND usuarios.rol = 'Administrador'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = configurado_por_user_id
      AND usuarios.rol = 'Administrador'
    )
  );

CREATE POLICY "All users can read active config"
  ON production_google_sheets_config
  FOR SELECT
  TO authenticated
  USING (activo = true);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_production_google_sheets_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER production_google_sheets_config_updated_at
  BEFORE UPDATE ON production_google_sheets_config
  FOR EACH ROW
  EXECUTE FUNCTION update_production_google_sheets_config_updated_at();
