/*
  # Recreate Seguros Progress with Foreign Key

  1. Changes
    - Drop and recreate seguros_progress with proper FK to seguros_lessons
    - Preserve existing structure
    
  2. Security
    - Enable RLS
    - Users can view/update their own progress
*/

-- Drop existing table
DROP TABLE IF EXISTS seguros_progress CASCADE;

-- Recreate seguros_progress table
CREATE TABLE seguros_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  lesson_id uuid NOT NULL REFERENCES seguros_lessons(id) ON DELETE CASCADE,
  progreso integer DEFAULT 0,
  completada boolean DEFAULT false,
  fecha_completada timestamptz,
  tiempo_dedicado_minutos integer DEFAULT 0,
  calificacion integer,
  intentos integer DEFAULT 0,
  notas text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(usuario_id, lesson_id)
);

-- Enable RLS
ALTER TABLE seguros_progress ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own progress"
  ON seguros_progress FOR SELECT
  TO authenticated
  USING (usuario_id = auth.uid());

CREATE POLICY "Users can insert own progress"
  ON seguros_progress FOR INSERT
  TO authenticated
  WITH CHECK (usuario_id = auth.uid());

CREATE POLICY "Users can update own progress"
  ON seguros_progress FOR UPDATE
  TO authenticated
  USING (usuario_id = auth.uid())
  WITH CHECK (usuario_id = auth.uid());

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_seguros_progress_usuario ON seguros_progress(usuario_id);
CREATE INDEX IF NOT EXISTS idx_seguros_progress_lesson ON seguros_progress(lesson_id);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_seguros_progress_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_seguros_progress_updated_at
  BEFORE UPDATE ON seguros_progress
  FOR EACH ROW
  EXECUTE FUNCTION update_seguros_progress_updated_at();
