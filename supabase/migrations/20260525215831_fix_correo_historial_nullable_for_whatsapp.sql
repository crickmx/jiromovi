/*
  # Fix correo_historial_envios for WhatsApp-only notification logging

  ## Problem
  The columns `destinatario_email` and `asunto` are NOT NULL in correo_historial_envios.
  WhatsApp-only notifications have no email or subject, so the dispatcher could not log them.

  ## Changes
  1. Make `destinatario_email` nullable (WhatsApp notifications have no email)
  2. Make `asunto` nullable (WhatsApp notifications have no subject)
  3. Add `proveedor` column if missing (for tracking wazzup24 vs resend)
  4. Add `provider_message_id` column if missing (for tracking provider message IDs)

  These columns become optional — email notifications still populate them,
  WhatsApp-only notifications will use `numero_destino` instead.
*/

ALTER TABLE correo_historial_envios
  ALTER COLUMN destinatario_email DROP NOT NULL;

ALTER TABLE correo_historial_envios
  ALTER COLUMN asunto DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'correo_historial_envios' AND column_name = 'proveedor'
  ) THEN
    ALTER TABLE correo_historial_envios ADD COLUMN proveedor text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'correo_historial_envios' AND column_name = 'provider_message_id'
  ) THEN
    ALTER TABLE correo_historial_envios ADD COLUMN provider_message_id text;
  END IF;
END $$;
