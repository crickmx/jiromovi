/*
  # Create Seguros Education Schema

  ## Overview
  Creates tables for an internal learning and training system with:
  - On Demand video lessons
  - Live virtual classroom sessions (Aula Virtual)
  - Progress tracking
  - Category management

  ## New Tables
    - `seguros_categories`
      - `id` (uuid, primary key)
      - `nombre` (text) - Category name
      - `descripcion` (text) - Category description
      - `creado_por` (uuid) - User who created the category
      - `fecha_creacion` (timestamptz) - Creation timestamp
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `seguros_lessons`
      - `id` (uuid, primary key)
      - `titulo` (text) - Lesson title
      - `descripcion` (text) - Lesson description
      - `categoria_id` (uuid) - Foreign key to categories
      - `miniatura_url` (text) - Thumbnail image URL
      - `video_url` (text) - Video file URL
      - `duracion` (integer) - Duration in seconds
      - `oficinas_asignadas` (jsonb) - Array of office IDs
      - `es_grabacion` (boolean) - Whether this is from a recording
      - `session_id` (uuid) - Reference to Aula Virtual session if recorded
      - `creado_por` (uuid) - User who created/uploaded
      - `fecha_creacion` (timestamptz)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `seguros_sessions`
      - `id` (uuid, primary key)
      - `titulo` (text) - Session title
      - `descripcion` (text) - Session description
      - `fecha` (date) - Session date
      - `hora` (time) - Session time
      - `oficinas_asignadas` (jsonb) - Array of office IDs
      - `enlace_aula` (text) - Classroom link
      - `enlace_invitado` (text) - Guest co-host link
      - `grabar` (boolean) - Auto-record session
      - `esta_activa` (boolean) - Currently live
      - `video_url` (text) - Recording URL after session ends
      - `duracion_grabacion` (integer) - Recording duration in seconds
      - `creado_por` (uuid) - User who created the session
      - `fecha_creacion` (timestamptz)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `seguros_progress`
      - `id` (uuid, primary key)
      - `user_id` (uuid) - User tracking progress
      - `lesson_id` (uuid) - Lesson being tracked
      - `progreso` (float) - Progress percentage (0-100)
      - `completado` (boolean) - Whether lesson is completed
      - `ultima_vista` (timestamptz) - Last viewed timestamp
      - `tiempo_reproduccion` (integer) - Current playback position in seconds
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  ## Security
    - Enable RLS on all tables
    - Users can view content assigned to their office
    - Only Administradores can create/edit/delete content
    - Users can track their own progress

  ## Notes
    - Oficinas_asignadas stored as JSONB array for flexibility
    - Empty array means available to all offices
    - Progress automatically updates as users watch videos
*/

-- Create seguros_categories table
CREATE TABLE IF NOT EXISTS seguros_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL UNIQUE,
  descripcion text,
  creado_por uuid NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  fecha_creacion timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create seguros_lessons table
CREATE TABLE IF NOT EXISTS seguros_lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  descripcion text,
  categoria_id uuid REFERENCES seguros_categories(id) ON DELETE SET NULL,
  miniatura_url text,
  video_url text NOT NULL,
  duracion integer DEFAULT 0,
  oficinas_asignadas jsonb DEFAULT '[]'::jsonb,
  es_grabacion boolean DEFAULT false,
  session_id uuid,
  creado_por uuid NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  fecha_creacion timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create seguros_sessions table
CREATE TABLE IF NOT EXISTS seguros_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  descripcion text,
  fecha date NOT NULL,
  hora time NOT NULL,
  oficinas_asignadas jsonb DEFAULT '[]'::jsonb,
  enlace_aula text,
  enlace_invitado text,
  grabar boolean DEFAULT false,
  esta_activa boolean DEFAULT false,
  video_url text,
  duracion_grabacion integer,
  creado_por uuid NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  fecha_creacion timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create seguros_progress table
CREATE TABLE IF NOT EXISTS seguros_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  lesson_id uuid NOT NULL REFERENCES seguros_lessons(id) ON DELETE CASCADE,
  progreso float DEFAULT 0 CHECK (progreso >= 0 AND progreso <= 100),
  completado boolean DEFAULT false,
  ultima_vista timestamptz DEFAULT now(),
  tiempo_reproduccion integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, lesson_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_seguros_lessons_categoria ON seguros_lessons(categoria_id);
CREATE INDEX IF NOT EXISTS idx_seguros_lessons_fecha ON seguros_lessons(fecha_creacion DESC);
CREATE INDEX IF NOT EXISTS idx_seguros_sessions_fecha ON seguros_sessions(fecha, hora);
CREATE INDEX IF NOT EXISTS idx_seguros_sessions_activa ON seguros_sessions(esta_activa) WHERE esta_activa = true;
CREATE INDEX IF NOT EXISTS idx_seguros_progress_user ON seguros_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_seguros_progress_lesson ON seguros_progress(lesson_id);
CREATE INDEX IF NOT EXISTS idx_seguros_progress_completado ON seguros_progress(user_id, completado);

-- Enable RLS
ALTER TABLE seguros_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE seguros_lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE seguros_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE seguros_progress ENABLE ROW LEVEL SECURITY;

-- RLS Policies for seguros_categories
CREATE POLICY "Everyone can view categories"
  ON seguros_categories FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage categories"
  ON seguros_categories FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
      AND usuarios.activo = true
    )
  );

-- RLS Policies for seguros_lessons
CREATE POLICY "Users can view lessons assigned to their office"
  ON seguros_lessons FOR SELECT
  TO authenticated
  USING (
    -- If no offices assigned (empty array), everyone can see it
    jsonb_array_length(oficinas_asignadas) = 0
    OR
    -- Or user's office is in the assigned list
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.activo = true
      AND (
        usuarios.oficina_id::text = ANY(
          SELECT jsonb_array_elements_text(oficinas_asignadas)
        )
      )
    )
    OR
    -- Or user is admin
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
      AND usuarios.activo = true
    )
  );

CREATE POLICY "Admins can manage lessons"
  ON seguros_lessons FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
      AND usuarios.activo = true
    )
  );

-- RLS Policies for seguros_sessions
CREATE POLICY "Users can view sessions assigned to their office"
  ON seguros_sessions FOR SELECT
  TO authenticated
  USING (
    -- If no offices assigned, everyone can see it
    jsonb_array_length(oficinas_asignadas) = 0
    OR
    -- Or user's office is in the assigned list
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.activo = true
      AND (
        usuarios.oficina_id::text = ANY(
          SELECT jsonb_array_elements_text(oficinas_asignadas)
        )
      )
    )
    OR
    -- Or user is admin
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
      AND usuarios.activo = true
    )
  );

CREATE POLICY "Admins can manage sessions"
  ON seguros_sessions FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
      AND usuarios.activo = true
    )
  );

-- RLS Policies for seguros_progress
CREATE POLICY "Users can view own progress"
  ON seguros_progress FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can update own progress"
  ON seguros_progress FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can modify own progress"
  ON seguros_progress FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can view all progress"
  ON seguros_progress FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
      AND usuarios.activo = true
    )
  );

-- Triggers for updated_at
CREATE OR REPLACE FUNCTION update_seguros_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_seguros_categories_updated_at
  BEFORE UPDATE ON seguros_categories
  FOR EACH ROW
  EXECUTE FUNCTION update_seguros_updated_at();

CREATE TRIGGER trigger_seguros_lessons_updated_at
  BEFORE UPDATE ON seguros_lessons
  FOR EACH ROW
  EXECUTE FUNCTION update_seguros_updated_at();

CREATE TRIGGER trigger_seguros_sessions_updated_at
  BEFORE UPDATE ON seguros_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_seguros_updated_at();

CREATE TRIGGER trigger_seguros_progress_updated_at
  BEFORE UPDATE ON seguros_progress
  FOR EACH ROW
  EXECUTE FUNCTION update_seguros_updated_at();

-- Function to automatically mark lesson as completed when progress reaches 95%+
CREATE OR REPLACE FUNCTION check_lesson_completion()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.progreso >= 95 AND OLD.completado = false THEN
    NEW.completado = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_check_lesson_completion
  BEFORE UPDATE ON seguros_progress
  FOR EACH ROW
  EXECUTE FUNCTION check_lesson_completion();
