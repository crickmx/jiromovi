/*
  # Add orden column to seguros_lessons

  1. Changes
    - Add `orden` column to `seguros_lessons` table (integer, default 0)
    - Create index on `categoria_id, orden` for efficient sorting
  
  2. Purpose
    - Allow manual ordering of lessons within each category
    - Support drag-and-drop reordering in the UI
*/

-- Add orden column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'seguros_lessons' AND column_name = 'orden'
  ) THEN
    ALTER TABLE seguros_lessons ADD COLUMN orden integer DEFAULT 0;
  END IF;
END $$;

-- Create index for efficient sorting by category and orden
CREATE INDEX IF NOT EXISTS idx_seguros_lessons_categoria_orden 
  ON seguros_lessons(categoria_id, orden);

-- Update existing lessons to have sequential orden values within each category
DO $$
DECLARE
  cat_record RECORD;
  lesson_record RECORD;
  counter integer;
BEGIN
  FOR cat_record IN 
    SELECT DISTINCT categoria_id 
    FROM seguros_lessons 
    WHERE categoria_id IS NOT NULL
    ORDER BY categoria_id
  LOOP
    counter := 1;
    FOR lesson_record IN 
      SELECT id 
      FROM seguros_lessons 
      WHERE categoria_id = cat_record.categoria_id
      ORDER BY fecha_creacion ASC
    LOOP
      UPDATE seguros_lessons 
      SET orden = counter 
      WHERE id = lesson_record.id;
      counter := counter + 1;
    END LOOP;
  END LOOP;
END $$;