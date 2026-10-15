/*
  # Create Manuals Module

  1. New Tables
    - `manuals`
      - `id` (uuid, primary key)
      - `title` (text, not null) - Manual display title
      - `slug` (text, unique, not null) - URL-friendly identifier
      - `description` (text) - Brief description shown in catalog
      - `category` (text) - Grouping category (e.g. Operación, Ventas)
      - `html_path` (text) - Path to the standalone HTML file
      - `pdf_path` (text) - Optional path to PDF version
      - `cover_image` (text) - Optional cover image URL
      - `status` (text, default 'draft') - active/draft/archived
      - `visibility` (text, default 'all') - Visibility rule
      - `sort_order` (int, default 0) - Display ordering
      - `created_by` (uuid) - User who created the manual
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `manual_visibility_rules`
      - `id` (uuid, primary key)
      - `manual_id` (uuid, FK to manuals)
      - `role` (text) - Role-based visibility
      - `oficina_id` (uuid) - Office-based visibility
      - `usuario_id` (uuid) - User-specific visibility
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on both tables
    - Authenticated users can SELECT active manuals
    - Admin users can INSERT, UPDATE, DELETE manuals
    - Admin users manage visibility rules

  3. Indexes
    - Unique index on manuals.slug
    - Index on manuals.status
    - Index on manual_visibility_rules.manual_id
*/

-- Create manuals table
CREATE TABLE IF NOT EXISTS manuals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  slug text UNIQUE NOT NULL,
  description text DEFAULT '',
  category text DEFAULT 'General',
  html_path text,
  pdf_path text,
  cover_image text,
  status text NOT NULL DEFAULT 'draft',
  visibility text NOT NULL DEFAULT 'all',
  sort_order integer DEFAULT 0,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create visibility rules table
CREATE TABLE IF NOT EXISTS manual_visibility_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manual_id uuid NOT NULL REFERENCES manuals(id) ON DELETE CASCADE,
  role text,
  oficina_id uuid,
  usuario_id uuid,
  created_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_manuals_status ON manuals(status);
CREATE INDEX IF NOT EXISTS idx_manuals_sort_order ON manuals(sort_order);
CREATE INDEX IF NOT EXISTS idx_manual_visibility_rules_manual_id ON manual_visibility_rules(manual_id);

-- Enable RLS
ALTER TABLE manuals ENABLE ROW LEVEL SECURITY;
ALTER TABLE manual_visibility_rules ENABLE ROW LEVEL SECURITY;

-- RLS Policies for manuals

-- Authenticated users can view active manuals
CREATE POLICY "Authenticated users can view active manuals"
  ON manuals
  FOR SELECT
  TO authenticated
  USING (status = 'active');

-- Admins can insert manuals
CREATE POLICY "Admins can insert manuals"
  ON manuals
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'admin'
    )
  );

-- Admins can update manuals
CREATE POLICY "Admins can update manuals"
  ON manuals
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

-- Admins can delete manuals
CREATE POLICY "Admins can delete manuals"
  ON manuals
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'admin'
    )
  );

-- RLS Policies for manual_visibility_rules

-- Authenticated users can view visibility rules
CREATE POLICY "Authenticated users can view visibility rules"
  ON manual_visibility_rules
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM manuals
      WHERE manuals.id = manual_visibility_rules.manual_id
      AND manuals.status = 'active'
    )
  );

-- Admins can manage visibility rules
CREATE POLICY "Admins can insert visibility rules"
  ON manual_visibility_rules
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'admin'
    )
  );

CREATE POLICY "Admins can update visibility rules"
  ON manual_visibility_rules
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

CREATE POLICY "Admins can delete visibility rules"
  ON manual_visibility_rules
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'admin'
    )
  );

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_manuals_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_manuals_updated_at_trigger
  BEFORE UPDATE ON manuals
  FOR EACH ROW
  EXECUTE FUNCTION update_manuals_updated_at();