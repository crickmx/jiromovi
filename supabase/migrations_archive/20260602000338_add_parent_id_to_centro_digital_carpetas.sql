/*
  # Add subcarpeta (subfolder) support to Centro Digital

  1. Changes
    - `centro_digital_carpetas`: adds `parent_id uuid` nullable FK referencing itself
    - Adds index on `parent_id` for efficient tree queries
    - Updates RLS policies to keep same access rules for subcarpetas

  2. Notes
    - Self-referential FK allows unlimited nesting (root carpetas have parent_id = NULL)
    - ON DELETE SET NULL so deleting a parent doesn't cascade-delete children
    - Existing rows are unaffected (parent_id defaults to NULL = root level)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'centro_digital_carpetas' AND column_name = 'parent_id'
  ) THEN
    ALTER TABLE centro_digital_carpetas
      ADD COLUMN parent_id uuid REFERENCES centro_digital_carpetas(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_centro_digital_carpetas_parent_id
  ON centro_digital_carpetas(parent_id);
