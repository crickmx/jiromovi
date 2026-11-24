/*
  # Add channel tracking columns to correo_historial_envios

  Adds channel_id, channel_name, and channel_type columns to correo_historial_envios
  so that each log entry tracks which notification_channel was used for delivery.
  These columns are nullable for backwards compatibility with existing records.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'correo_historial_envios' AND column_name = 'channel_id'
  ) THEN
    ALTER TABLE correo_historial_envios ADD COLUMN channel_id uuid REFERENCES notification_channels(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'correo_historial_envios' AND column_name = 'channel_name'
  ) THEN
    ALTER TABLE correo_historial_envios ADD COLUMN channel_name text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'correo_historial_envios' AND column_name = 'channel_type'
  ) THEN
    ALTER TABLE correo_historial_envios ADD COLUMN channel_type text;
  END IF;
END $$;
