/*
  # Create Lector Qualitas extraction history

  1. New Tables
    - `lector_qualitas_extractions`
      - `id` (uuid, primary key)
      - `usuario_id` (uuid, FK to usuarios)
      - `archivo_nombre` (text) - original file name
      - `numero_poliza` (text) - extracted policy number
      - `nombre_cliente` (text) - client name
      - `rfc_asegurado` (text) - RFC
      - `prima_total` (text) - total premium
      - `placas` (text) - license plates
      - `inicio_vigencia` (text) - start date
      - `fin_vigencia` (text) - end date
      - `tipo_poliza` (text) - policy type
      - `tipo_vehiculo` (text) - vehicle type
      - `datos_completos` (jsonb) - full extracted data
      - `exitoso` (boolean) - whether extraction was successful
      - `mensaje_error` (text) - error message if failed
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on `lector_qualitas_extractions` table
    - Users can view their own extractions
    - Users can insert their own extractions
    - Admins and gerentes can view all extractions
*/

CREATE TABLE IF NOT EXISTS lector_qualitas_extractions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  archivo_nombre text NOT NULL,
  numero_poliza text,
  nombre_cliente text,
  rfc_asegurado text,
  prima_total text,
  placas text,
  inicio_vigencia text,
  fin_vigencia text,
  tipo_poliza text,
  tipo_vehiculo text,
  datos_completos jsonb DEFAULT '{}'::jsonb,
  exitoso boolean DEFAULT true,
  mensaje_error text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE lector_qualitas_extractions ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_lector_qualitas_usuario_id ON lector_qualitas_extractions(usuario_id);
CREATE INDEX IF NOT EXISTS idx_lector_qualitas_created_at ON lector_qualitas_extractions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lector_qualitas_numero_poliza ON lector_qualitas_extractions(numero_poliza);

CREATE POLICY "Users can view own extractions"
  ON lector_qualitas_extractions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = usuario_id);

CREATE POLICY "Users can insert own extractions"
  ON lector_qualitas_extractions
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = usuario_id);

CREATE POLICY "Admins can view all extractions"
  ON lector_qualitas_extractions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol IN ('Administrador', 'Gerente')
    )
  );
