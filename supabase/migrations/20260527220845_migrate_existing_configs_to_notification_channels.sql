/*
  # Migrar configuración actual a canales de notificación

  ## Qué hace
  - Lee la configuración activa de correo_configuracion y la migra a notification_channels
    como canal Resend default (si tiene resend_api_key)
  - Lee la configuración activa de whatsapp_configuracion y la migra a notification_channels
    como canal Wazzup24 default
  - NO elimina ni modifica las tablas originales (siguen funcionando como fallback)

  ## Notas
  - Solo migra si no existe ya un canal default de ese tipo
  - Es idempotente: se puede ejecutar múltiples veces sin duplicar
*/

DO $$
DECLARE
  v_resend_config RECORD;
  v_wa_config     RECORD;
  v_exists        boolean;
BEGIN

  -- ── Migrar correo_configuracion → notification_channels (Resend) ──────────
  SELECT * INTO v_resend_config
  FROM correo_configuracion
  WHERE activo = true AND resend_api_key IS NOT NULL AND resend_api_key <> ''
  ORDER BY created_at DESC
  LIMIT 1;

  IF FOUND THEN
    SELECT EXISTS(
      SELECT 1 FROM notification_channels
      WHERE type = 'email_resend' AND is_default = true
    ) INTO v_exists;

    IF NOT v_exists THEN
      INSERT INTO notification_channels (
        name, description, type, provider, config, branding, is_active, is_default
      ) VALUES (
        'Resend Default',
        'Canal de correo Resend migrado desde la configuración anterior',
        'email_resend',
        'resend',
        jsonb_build_object(
          'api_key',      v_resend_config.resend_api_key,
          'from_email',   COALESCE(v_resend_config.remitente_email, ''),
          'from_name',    COALESCE(v_resend_config.remitente_nombre, 'MOVI Digital'),
          'reply_to',     '',
          'domain',       COALESCE(v_resend_config.dominio_verificado, '')
        ),
        jsonb_build_object(
          'logo_url',       '',
          'primary_color',  '#0b2d6b',
          'secondary_color','#5b78ff',
          'header_html',    '',
          'footer_html',    '',
          'legal_text',     ''
        ),
        true,
        true
      );
    END IF;
  END IF;

  -- ── Migrar whatsapp_configuracion → notification_channels (Wazzup24) ──────
  SELECT * INTO v_wa_config
  FROM whatsapp_configuracion
  WHERE activo = true AND api_key IS NOT NULL AND api_key <> ''
  ORDER BY created_at DESC
  LIMIT 1;

  IF FOUND THEN
    SELECT EXISTS(
      SELECT 1 FROM notification_channels
      WHERE type = 'whatsapp_wazzup24' AND is_default = true
    ) INTO v_exists;

    IF NOT v_exists THEN
      INSERT INTO notification_channels (
        name, description, type, provider, config, branding, is_active, is_default
      ) VALUES (
        'WhatsApp Default',
        'Canal de WhatsApp Wazzup24 migrado desde la configuración anterior',
        'whatsapp_wazzup24',
        'wazzup24',
        jsonb_build_object(
          'api_key',      v_wa_config.api_key,
          'channel_id',   COALESCE(v_wa_config.channel_id_uuid, ''),
          'phone_label',  COALESCE(v_wa_config.numero_remitente, '')
        ),
        '{}'::jsonb,
        true,
        true
      );
    END IF;
  END IF;

END $$;
