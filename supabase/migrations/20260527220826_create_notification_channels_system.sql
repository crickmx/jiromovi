/*
  # Sistema de Canales de Notificación

  ## Nuevas tablas
  - `notification_channels`: Canales de envío configurables (Resend + Wazzup24)

  ## Cambios en tablas existentes
  - `correo_plantillas`: Agrega resend_channel_id, wazzup24_channel_id, email_enabled, whatsapp_enabled

  ## Seguridad
  - RLS habilitado en notification_channels
  - Solo admins pueden gestionar canales
  - Todos los usuarios autenticados pueden leer canales activos (para selectores)

  ## Notas
  - Las columnas actuales de correo_configuracion y whatsapp_configuracion NO se eliminan
  - Los canales existentes se migran como "default" en una migración posterior
  - Toda API key se guarda en config jsonb para control de acceso vía RLS
*/

-- ─── notification_channels ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notification_channels (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name           text NOT NULL,
  description    text,
  type           text NOT NULL CHECK (type IN ('email_resend', 'whatsapp_wazzup24')),
  provider       text NOT NULL CHECK (provider IN ('resend', 'wazzup24')),
  config         jsonb NOT NULL DEFAULT '{}'::jsonb,
  branding       jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active      boolean NOT NULL DEFAULT true,
  is_default     boolean NOT NULL DEFAULT false,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  created_by     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by     uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_notification_channels_type ON notification_channels(type);
CREATE INDEX IF NOT EXISTS idx_notification_channels_is_default ON notification_channels(type, is_default) WHERE is_default = true;
CREATE INDEX IF NOT EXISTS idx_notification_channels_is_active ON notification_channels(is_active) WHERE is_active = true;

ALTER TABLE notification_channels ENABLE ROW LEVEL SECURITY;

-- Solo admins crean/editan canales
CREATE POLICY "Admins can manage notification channels"
  ON notification_channels
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid() AND rol = 'admin' AND deleted_at IS NULL
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid() AND rol = 'admin' AND deleted_at IS NULL
    )
  );

-- Todos los autenticados pueden leer canales (para selectores en plantillas)
CREATE POLICY "Authenticated users can read active channels"
  ON notification_channels
  FOR SELECT
  TO authenticated
  USING (true);

-- ─── Trigger: un solo default por tipo ───────────────────────────────────────
CREATE OR REPLACE FUNCTION enforce_single_default_channel()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.is_default = true THEN
    UPDATE notification_channels
    SET is_default = false, updated_at = now()
    WHERE type = NEW.type
      AND id <> NEW.id
      AND is_default = true;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_single_default_channel ON notification_channels;
CREATE TRIGGER trg_single_default_channel
  BEFORE INSERT OR UPDATE OF is_default ON notification_channels
  FOR EACH ROW EXECUTE FUNCTION enforce_single_default_channel();

-- ─── Trigger: updated_at automático ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_notification_channel_timestamp()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notification_channel_updated_at ON notification_channels;
CREATE TRIGGER trg_notification_channel_updated_at
  BEFORE UPDATE ON notification_channels
  FOR EACH ROW EXECUTE FUNCTION update_notification_channel_timestamp();

-- ─── Agregar columnas a correo_plantillas ────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'correo_plantillas' AND column_name = 'resend_channel_id'
  ) THEN
    ALTER TABLE correo_plantillas ADD COLUMN resend_channel_id uuid REFERENCES notification_channels(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'correo_plantillas' AND column_name = 'wazzup24_channel_id'
  ) THEN
    ALTER TABLE correo_plantillas ADD COLUMN wazzup24_channel_id uuid REFERENCES notification_channels(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'correo_plantillas' AND column_name = 'email_enabled'
  ) THEN
    ALTER TABLE correo_plantillas ADD COLUMN email_enabled boolean NOT NULL DEFAULT true;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'correo_plantillas' AND column_name = 'whatsapp_enabled'
  ) THEN
    ALTER TABLE correo_plantillas ADD COLUMN whatsapp_enabled boolean NOT NULL DEFAULT false;
  END IF;
END $$;

-- ─── Agregar channel_id y channel_name a historial de envíos ─────────────────
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

-- ─── Función helper: obtener canal activo por tipo ────────────────────────────
CREATE OR REPLACE FUNCTION get_notification_channel(
  p_type      text,
  p_channel_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_channel notification_channels;
BEGIN
  -- 1. Canal específico solicitado
  IF p_channel_id IS NOT NULL THEN
    SELECT * INTO v_channel
    FROM notification_channels
    WHERE id = p_channel_id AND type = p_type AND is_active = true;

    IF FOUND THEN
      RETURN row_to_json(v_channel)::jsonb;
    END IF;
  END IF;

  -- 2. Canal default activo
  SELECT * INTO v_channel
  FROM notification_channels
  WHERE type = p_type AND is_active = true AND is_default = true
  LIMIT 1;

  IF FOUND THEN
    RETURN row_to_json(v_channel)::jsonb;
  END IF;

  -- 3. Cualquier canal activo del tipo
  SELECT * INTO v_channel
  FROM notification_channels
  WHERE type = p_type AND is_active = true
  ORDER BY created_at ASC
  LIMIT 1;

  IF FOUND THEN
    RETURN row_to_json(v_channel)::jsonb;
  END IF;

  RETURN NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION get_notification_channel TO authenticated;
GRANT EXECUTE ON FUNCTION get_notification_channel TO service_role;
