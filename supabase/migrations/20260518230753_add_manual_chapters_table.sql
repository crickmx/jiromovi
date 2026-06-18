/*
  # Add manual chapters/sections for sidebar navigation

  1. New Tables
    - `manual_chapters`
      - `id` (uuid, primary key)
      - `manual_id` (uuid, FK to manuals) - Which manual this chapter belongs to
      - `title` (text) - Chapter display title
      - `page_number` (int) - Page number or section index
      - `anchor` (text) - Optional anchor/element ID for scrolling within the iframe
      - `sort_order` (int) - Display order
      - `parent_id` (uuid, nullable) - For nested sub-sections
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS
    - Authenticated users can read chapters of active manuals
    - Admins can manage chapters

  3. Seed data
    - Add chapters for Manual Ejecutivo based on its table of contents
*/

CREATE TABLE IF NOT EXISTS manual_chapters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manual_id uuid NOT NULL REFERENCES manuals(id) ON DELETE CASCADE,
  title text NOT NULL,
  page_number integer DEFAULT 1,
  anchor text,
  sort_order integer DEFAULT 0,
  parent_id uuid REFERENCES manual_chapters(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_manual_chapters_manual_id ON manual_chapters(manual_id);
CREATE INDEX IF NOT EXISTS idx_manual_chapters_sort_order ON manual_chapters(manual_id, sort_order);

ALTER TABLE manual_chapters ENABLE ROW LEVEL SECURITY;

-- Authenticated users can view chapters of active manuals
CREATE POLICY "Authenticated users can view manual chapters"
  ON manual_chapters
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM manuals
      WHERE manuals.id = manual_chapters.manual_id
      AND manuals.status = 'active'
    )
  );

-- Admins can insert chapters
CREATE POLICY "Admins can insert manual chapters"
  ON manual_chapters
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'admin'
    )
  );

-- Admins can update chapters
CREATE POLICY "Admins can update manual chapters"
  ON manual_chapters
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'admin'
    )
  );

-- Admins can delete chapters
CREATE POLICY "Admins can delete manual chapters"
  ON manual_chapters
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'admin'
    )
  );

-- Also add a total_pages column to manuals for the page count display
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'manuals' AND column_name = 'total_pages'
  ) THEN
    ALTER TABLE manuals ADD COLUMN total_pages integer DEFAULT 0;
  END IF;
END $$;