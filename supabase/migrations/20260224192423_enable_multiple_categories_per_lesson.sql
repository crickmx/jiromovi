/*
  # Enable Multiple Categories Per Lesson

  1. New Tables
    - `seguros_lesson_categories` (junction table)
      - `id` (uuid, primary key)
      - `lesson_id` (uuid, foreign key to seguros_lessons)
      - `category_id` (uuid, foreign key to seguros_categories)
      - `created_at` (timestamptz)

  2. Changes
    - Create junction table for many-to-many relationship
    - Migrate existing categoria_id data to junction table
    - Remove categoria_id column from seguros_lessons (CASCADE to drop dependent views)
    - Recreate analytics views adapted for multiple categories
    - Add unique constraint to prevent duplicate assignments

  3. Security
    - Enable RLS on seguros_lesson_categories
    - Authenticated users can view lesson-category relationships
    - Only admins can create/update/delete relationships

  4. Indexes
    - Index on lesson_id for performance
    - Index on category_id for performance
    - Unique constraint on (lesson_id, category_id)
*/

-- Create junction table for many-to-many relationship
CREATE TABLE IF NOT EXISTS seguros_lesson_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id uuid NOT NULL REFERENCES seguros_lessons(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES seguros_categories(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(lesson_id, category_id)
);

-- Enable RLS
ALTER TABLE seguros_lesson_categories ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Authenticated users can view lesson categories"
  ON seguros_lesson_categories FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert lesson categories"
  ON seguros_lesson_categories FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

CREATE POLICY "Admins can delete lesson categories"
  ON seguros_lesson_categories FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_seguros_lesson_categories_lesson ON seguros_lesson_categories(lesson_id);
CREATE INDEX IF NOT EXISTS idx_seguros_lesson_categories_category ON seguros_lesson_categories(category_id);

-- Migrate existing data from categoria_id to junction table
INSERT INTO seguros_lesson_categories (lesson_id, category_id)
SELECT id, categoria_id
FROM seguros_lessons
WHERE categoria_id IS NOT NULL
ON CONFLICT (lesson_id, category_id) DO NOTHING;

-- Drop the old categoria_id column and its index (CASCADE to drop dependent views)
DROP INDEX IF EXISTS idx_seguros_lessons_categoria;
ALTER TABLE seguros_lessons DROP COLUMN IF EXISTS categoria_id CASCADE;

-- Recreate analytics view adapted for multiple categories
CREATE OR REPLACE VIEW v_analytics_lecciones_stats AS
SELECT
  l.id as lesson_id,
  l.titulo,
  
  -- Categorías como array de objetos
  (
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', c.id,
        'nombre', c.nombre,
        'icono', c.icono
      )
    )
    FROM seguros_lesson_categories slc
    JOIN seguros_categories c ON c.id = slc.category_id
    WHERE slc.lesson_id = l.id
  ) as categorias,
  
  -- Reproducciones válidas (>=10s o >=5%)
  COUNT(DISTINCT CASE WHEN s.es_reproduccion_valida THEN s.user_id END) as reproducciones,
  
  -- Usuarios únicos
  COUNT(DISTINCT s.user_id) as usuarios_unicos,
  
  -- Completadas
  COUNT(DISTINCT CASE WHEN s.completo THEN s.user_id END) as completadas,
  
  -- Completion rate
  ROUND(
    100.0 * COUNT(DISTINCT CASE WHEN s.completo THEN s.user_id END)::numeric / 
    NULLIF(COUNT(DISTINCT CASE WHEN s.es_reproduccion_valida THEN s.user_id END), 0),
    2
  ) as completion_rate_percent,
  
  -- Tiempo promedio reproducido
  ROUND(AVG(s.duracion_total_segundos)) as tiempo_promedio_segundos,
  
  -- Tiempo total reproducido
  SUM(s.duracion_total_segundos) as tiempo_total_segundos,
  
  -- Última visualización
  MAX(s.inicio) as ultima_visualizacion,
  
  -- Por oficina (top 3)
  (
    SELECT jsonb_agg(
      jsonb_build_object(
        'oficina_id', sub.oficina_id,
        'oficina_nombre', o.nombre,
        'count', sub.count
      )
      ORDER BY sub.count DESC
    )
    FROM (
      SELECT oficina_id, COUNT(*) as count
      FROM seguros_education_sesiones
      WHERE lesson_id = l.id AND es_reproduccion_valida
      GROUP BY oficina_id
      ORDER BY count DESC
      LIMIT 3
    ) sub
    LEFT JOIN oficinas o ON o.id = sub.oficina_id
  ) as top_oficinas

FROM seguros_lessons l
LEFT JOIN seguros_education_sesiones s ON s.lesson_id = l.id
GROUP BY l.id, l.titulo;

-- Create helper function to get categories for a lesson
CREATE OR REPLACE FUNCTION get_lesson_categories(p_lesson_id uuid)
RETURNS TABLE (
  category_id uuid,
  category_name text,
  category_icon text
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    sc.id,
    sc.nombre,
    sc.icono
  FROM seguros_lesson_categories slc
  JOIN seguros_categories sc ON sc.id = slc.category_id
  WHERE slc.lesson_id = p_lesson_id
  ORDER BY sc.nombre;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create helper function to assign multiple categories to a lesson
CREATE OR REPLACE FUNCTION assign_lesson_categories(
  p_lesson_id uuid,
  p_category_ids uuid[]
)
RETURNS void AS $$
BEGIN
  -- Delete existing category assignments for this lesson
  DELETE FROM seguros_lesson_categories
  WHERE lesson_id = p_lesson_id;

  -- Insert new category assignments
  INSERT INTO seguros_lesson_categories (lesson_id, category_id)
  SELECT p_lesson_id, unnest(p_category_ids)
  ON CONFLICT (lesson_id, category_id) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_lesson_categories(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION assign_lesson_categories(uuid, uuid[]) TO authenticated;
