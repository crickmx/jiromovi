/*
  # Add auto-resolved SICAS fields to policy_deliveries

  1. New Columns on `policy_deliveries`
    - `sicas_resolved_fields` (jsonb) - Stores all auto-resolved field values and their sources
      Format: { IDTipoDocto: { value: "5", source: "catalog_match", label: "Poliza" }, ... }
    - `sicas_resolution_warnings` (text[]) - Warnings from auto-resolution process

  2. Notes
    - Uses a single JSONB column for all resolved fields rather than 10+ individual columns
    - This is more flexible and avoids excessive DDL changes
    - The edge function will read/write this field to track what was auto-resolved
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'policy_deliveries' AND column_name = 'sicas_resolved_fields'
  ) THEN
    ALTER TABLE policy_deliveries ADD COLUMN sicas_resolved_fields jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'policy_deliveries' AND column_name = 'sicas_resolution_warnings'
  ) THEN
    ALTER TABLE policy_deliveries ADD COLUMN sicas_resolution_warnings text[];
  END IF;
END $$;
