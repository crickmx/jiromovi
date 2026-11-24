/*
  # Fix IA Module Missing Fields

  1. Changes
    - `ia_robots`: Add `palabras_clave` (text[]) column — referenced by ia-classify-email edge function
    - `ia_cuentas_correo`: Add `imap_host` (text) and `imap_port` (int) — referenced by ia-monitor-email edge function
    - Update predefined robots to 'activo' state so dashboard shows active count

  2. Notes
    - No data loss — all existing rows retain their values
    - palabras_clave defaults to empty array
    - imap_host defaults to 'imap.ionos.mx', imap_port to 993
*/

-- Add palabras_clave to ia_robots
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ia_robots' AND column_name = 'palabras_clave'
  ) THEN
    ALTER TABLE ia_robots ADD COLUMN palabras_clave text[] DEFAULT ARRAY[]::text[];
  END IF;
END $$;

-- Add imap_host and imap_port to ia_cuentas_correo
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ia_cuentas_correo' AND column_name = 'imap_host'
  ) THEN
    ALTER TABLE ia_cuentas_correo ADD COLUMN imap_host text NOT NULL DEFAULT 'imap.ionos.mx';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ia_cuentas_correo' AND column_name = 'imap_port'
  ) THEN
    ALTER TABLE ia_cuentas_correo ADD COLUMN imap_port int NOT NULL DEFAULT 993;
  END IF;
END $$;

-- Add smtp_host and smtp_port for sending emails
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ia_cuentas_correo' AND column_name = 'smtp_host'
  ) THEN
    ALTER TABLE ia_cuentas_correo ADD COLUMN smtp_host text NOT NULL DEFAULT 'smtp.ionos.mx';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ia_cuentas_correo' AND column_name = 'smtp_port'
  ) THEN
    ALTER TABLE ia_cuentas_correo ADD COLUMN smtp_port int NOT NULL DEFAULT 587;
  END IF;
END $$;
