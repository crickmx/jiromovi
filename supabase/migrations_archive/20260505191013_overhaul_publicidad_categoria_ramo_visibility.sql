/*
  # Overhaul Publicidad Module - Add Categoria, Ramo, and Office Visibility

  1. Changes to `publicidad_plantillas`
    - Add `categoria` text column with check constraint for 9 predefined values
    - Add `ramo` text column with check constraint for 12 predefined values
    - Add `visible_para_todas_las_oficinas` boolean, defaults true
    - Make `titulo` nullable (no longer required in the new flow)
    - Backfill existing records with categoria='Otro', ramo='Multirramo', visible_para_todas_las_oficinas=true

  2. New Tables
    - `publicidad_plantilla_oficinas` junction table for office-specific visibility
      - `id` (uuid, pk)
      - `plantilla_id` (uuid, FK to publicidad_plantillas)
      - `oficina_id` (uuid, FK to oficinas)
      - `created_at` (timestamptz)

  3. Security
    - Enable RLS on `publicidad_plantilla_oficinas`
    - Policies for authenticated users to read rows for their office
    - Admin/Gerente can insert/update/delete

  4. Notes
    - Categoria values: 'Redes Sociales', 'Campanas', 'Promociones', 'Eventos', 'Presentaciones',
      'Email Marketing', 'Banners', 'Tarjetas de Presentacion', 'Otro'
    - Ramo values: 'GMM', 'Vida', 'Autos', 'Danos', 'Ahorro e Inversion', 'Empresarial',
      'Responsabilidad Civil', 'Transporte', 'Agropecuario', 'Fianzas', 'Multirramo', 'Otro'
*/

-- Add new columns to publicidad_plantillas
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'publicidad_plantillas' AND column_name = 'categoria'
  ) THEN
    ALTER TABLE publicidad_plantillas ADD COLUMN categoria text DEFAULT 'Otro';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'publicidad_plantillas' AND column_name = 'ramo'
  ) THEN
    ALTER TABLE publicidad_plantillas ADD COLUMN ramo text DEFAULT 'Multirramo';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'publicidad_plantillas' AND column_name = 'visible_para_todas_las_oficinas'
  ) THEN
    ALTER TABLE publicidad_plantillas ADD COLUMN visible_para_todas_las_oficinas boolean DEFAULT true;
  END IF;
END $$;

-- Make titulo nullable (no longer required)
ALTER TABLE publicidad_plantillas ALTER COLUMN titulo DROP NOT NULL;

-- Add check constraints
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'publicidad_plantillas' AND constraint_name = 'publicidad_plantillas_categoria_check'
  ) THEN
    ALTER TABLE publicidad_plantillas ADD CONSTRAINT publicidad_plantillas_categoria_check
      CHECK (categoria IN (
        'Redes Sociales', 'Campanas', 'Promociones', 'Eventos', 'Presentaciones',
        'Email Marketing', 'Banners', 'Tarjetas de Presentacion', 'Otro'
      ));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'publicidad_plantillas' AND constraint_name = 'publicidad_plantillas_ramo_check'
  ) THEN
    ALTER TABLE publicidad_plantillas ADD CONSTRAINT publicidad_plantillas_ramo_check
      CHECK (ramo IN (
        'GMM', 'Vida', 'Autos', 'Danos', 'Ahorro e Inversion', 'Empresarial',
        'Responsabilidad Civil', 'Transporte', 'Agropecuario', 'Fianzas', 'Multirramo', 'Otro'
      ));
  END IF;
END $$;

-- Backfill existing records
UPDATE publicidad_plantillas
SET categoria = 'Otro',
    ramo = 'Multirramo',
    visible_para_todas_las_oficinas = true
WHERE categoria IS NULL OR ramo IS NULL;

-- Create junction table for office-specific visibility
CREATE TABLE IF NOT EXISTS publicidad_plantilla_oficinas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plantilla_id uuid NOT NULL REFERENCES publicidad_plantillas(id) ON DELETE CASCADE,
  oficina_id uuid NOT NULL REFERENCES oficinas(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(plantilla_id, oficina_id)
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_publicidad_plantilla_oficinas_plantilla
  ON publicidad_plantilla_oficinas(plantilla_id);
CREATE INDEX IF NOT EXISTS idx_publicidad_plantilla_oficinas_oficina
  ON publicidad_plantilla_oficinas(oficina_id);
CREATE INDEX IF NOT EXISTS idx_publicidad_plantillas_categoria
  ON publicidad_plantillas(categoria);
CREATE INDEX IF NOT EXISTS idx_publicidad_plantillas_ramo
  ON publicidad_plantillas(ramo);

-- Enable RLS
ALTER TABLE publicidad_plantilla_oficinas ENABLE ROW LEVEL SECURITY;

-- RLS Policies for publicidad_plantilla_oficinas
CREATE POLICY "Authenticated users can view office plantilla visibility"
  ON publicidad_plantilla_oficinas
  FOR SELECT
  TO authenticated
  USING (
    oficina_id IN (
      SELECT oficina_id FROM usuarios WHERE id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage plantilla office visibility"
  ON publicidad_plantilla_oficinas
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid() AND rol IN ('Administrador', 'Gerente')
    )
  );

CREATE POLICY "Admins can update plantilla office visibility"
  ON publicidad_plantilla_oficinas
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid() AND rol IN ('Administrador', 'Gerente')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid() AND rol IN ('Administrador', 'Gerente')
    )
  );

CREATE POLICY "Admins can delete plantilla office visibility"
  ON publicidad_plantilla_oficinas
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid() AND rol IN ('Administrador', 'Gerente')
    )
  );
