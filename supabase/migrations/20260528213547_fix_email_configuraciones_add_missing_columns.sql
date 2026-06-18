/*
  # Fix email_configuraciones schema for IONOS webmail

  1. Modified Tables
    - `email_configuraciones`
      - Add `activa` (boolean, default true) - whether this config is active
      - Add `nombre_remitente` (text) - display name for outgoing email
      - Rename usage: the existing `password` column stores the password (plain or encrypted)
      - Add `servidor_entrada` (text) - IMAP host (defaults to imap.ionos.mx)
      - Add `puerto_entrada` (integer) - IMAP port (defaults to 993)
      - Add `servidor_salida` (text) - SMTP host (defaults to smtp.ionos.mx)
      - Add `puerto_salida` (integer) - SMTP port (defaults to 465)
      - Add `ultima_sincronizacion` (timestamptz) - last sync timestamp
      - Add `estado_conexion` (text) - connection state

  2. Notes
    - The password column remains as-is (stores the credential)
    - Since table is empty, no data migration needed
    - These columns align the schema with the ionos-webmail edge function
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'email_configuraciones' AND column_name = 'activa'
  ) THEN
    ALTER TABLE email_configuraciones ADD COLUMN activa boolean DEFAULT true;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'email_configuraciones' AND column_name = 'nombre_remitente'
  ) THEN
    ALTER TABLE email_configuraciones ADD COLUMN nombre_remitente text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'email_configuraciones' AND column_name = 'servidor_entrada'
  ) THEN
    ALTER TABLE email_configuraciones ADD COLUMN servidor_entrada text DEFAULT 'imap.ionos.mx';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'email_configuraciones' AND column_name = 'puerto_entrada'
  ) THEN
    ALTER TABLE email_configuraciones ADD COLUMN puerto_entrada integer DEFAULT 993;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'email_configuraciones' AND column_name = 'servidor_salida'
  ) THEN
    ALTER TABLE email_configuraciones ADD COLUMN servidor_salida text DEFAULT 'smtp.ionos.mx';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'email_configuraciones' AND column_name = 'puerto_salida'
  ) THEN
    ALTER TABLE email_configuraciones ADD COLUMN puerto_salida integer DEFAULT 465;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'email_configuraciones' AND column_name = 'ultima_sincronizacion'
  ) THEN
    ALTER TABLE email_configuraciones ADD COLUMN ultima_sincronizacion timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'email_configuraciones' AND column_name = 'estado_conexion'
  ) THEN
    ALTER TABLE email_configuraciones ADD COLUMN estado_conexion text DEFAULT 'desconectado';
  END IF;
END $$;
