/*
  # Recreate Seguros Lessons Table for On Demand

  1. Changes
    - Drop existing seguros_lessons table (Aula Virtual version)
    - Create new seguros_lessons table for On Demand with correct fields
    - Add categoria_id, miniatura_url, duracion, oficinas_asignadas
    - Make session_id optional for standalone lessons
    - Set up RLS policies for authenticated users
    
  2. Security
    - Enable RLS on seguros_lessons table
    - Authenticated users can view lessons
    - Only admins can create/update/delete lessons
*/

-- Drop existing table and its dependencies
DROP TABLE IF EXISTS seguros_lessons CASCADE;

-- Create seguros_lessons table for On Demand content
CREATE TABLE seguros_lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  descripcion text DEFAULT '',
  categoria_id uuid REFERENCES seguros_categories(id) ON DELETE SET NULL,
  miniatura_url text,
  video_url text NOT NULL,
  duracion integer DEFAULT 0,
  oficinas_asignadas jsonb DEFAULT '[]'::jsonb,
  es_grabacion boolean DEFAULT false,
  session_id uuid REFERENCES seguros_sessions(id) ON DELETE SET NULL,
  creado_por uuid REFERENCES usuarios(id) ON DELETE RESTRICT,
  fecha_creacion timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE seguros_lessons ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Authenticated users can view lessons"
  ON seguros_lessons FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert lessons"
  ON seguros_lessons FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

CREATE POLICY "Admins can update lessons"
  ON seguros_lessons FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

CREATE POLICY "Admins can delete lessons"
  ON seguros_lessons FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_seguros_lessons_categoria ON seguros_lessons(categoria_id);
CREATE INDEX IF NOT EXISTS idx_seguros_lessons_session ON seguros_lessons(session_id);
CREATE INDEX IF NOT EXISTS idx_seguros_lessons_creado_por ON seguros_lessons(creado_por);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_seguros_lessons_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_seguros_lessons_updated_at
  BEFORE UPDATE ON seguros_lessons
  FOR EACH ROW
  EXECUTE FUNCTION update_seguros_lessons_updated_at();
