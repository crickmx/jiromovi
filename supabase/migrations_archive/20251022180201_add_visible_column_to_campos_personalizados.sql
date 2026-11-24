/*
  # Add visible column to campos_personalizados

  1. Changes
    - Add `visible` column to campos_personalizados table
    - Default value is true (all fields visible by default)

  2. Notes
    - This column is used by the application to filter which custom fields are shown
    - Existing fields will be visible by default
*/

-- Add visible column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'campos_personalizados' AND column_name = 'visible'
  ) THEN
    ALTER TABLE campos_personalizados ADD COLUMN visible boolean DEFAULT true;
  END IF;
END $$;
