/*
  # Per-channel branding and Seguwallet channel setup

  1. Move global header/footer HTML into the "Resend Default" channel branding
     - Copies the existing email_global_settings header/footer into notification_channels branding JSONB

  2. Create "Resend Seguwallet" channel (email_resend) 
     - Same credentials as Resend Default for now (will be reconfigured later)
     - Empty branding to be customized for Seguwallet

  3. Create "WhatsApp Seguwallet" channel (whatsapp_wazzup24)
     - Same credentials as WhatsApp Default for now

  4. Assign Resend Default channel to all non-Seguwallet templates (resend_channel_id)
     - All correo_plantillas where modulo != 'SEGUWALLET' → Resend Default

  5. Assign Resend Seguwallet + WhatsApp Seguwallet to seguwallet_* templates
     - seguwallet_bienvenida, seguwallet_poliza_externa_cargada, seguwallet_siniestro_click
     → resend_channel_id = Resend Seguwallet
     → wazzup24_channel_id = WhatsApp Seguwallet
     → acceso_passwordless also gets Seguwallet channels (used for Seguwallet login)
*/

DO $$
DECLARE
  v_resend_default_id  uuid := 'ac0aa689-f382-4a9d-98f7-a2cd5b72749a';
  v_wa_default_id      uuid := '4af0b323-c476-4310-9fc1-aebe9cc5f8e6';
  v_resend_sw_id       uuid;
  v_wa_sw_id           uuid;
  v_header_html        text;
  v_footer_html        text;
BEGIN

  -- ----------------------------------------------------------------
  -- 1. Move global header/footer into Resend Default channel branding
  -- ----------------------------------------------------------------
  SELECT header_html, footer_html
    INTO v_header_html, v_footer_html
    FROM email_global_settings
   WHERE activo = true
   ORDER BY version DESC
   LIMIT 1;

  IF v_header_html IS NOT NULL THEN
    UPDATE notification_channels
       SET branding = jsonb_set(
             jsonb_set(branding, '{header_html}', to_jsonb(v_header_html)),
             '{footer_html}', to_jsonb(COALESCE(v_footer_html, ''))
           ),
           updated_at = now()
     WHERE id = v_resend_default_id;
  END IF;

  -- ----------------------------------------------------------------
  -- 2. Create "Resend Seguwallet" channel (email_resend)
  --    Same config as Resend Default; branding starts empty
  -- ----------------------------------------------------------------
  INSERT INTO notification_channels (
    name, description, type, provider,
    config, branding,
    is_active, is_default
  )
  SELECT
    'Resend Seguwallet',
    'Canal de correo para notificaciones de Seguwallet',
    'email_resend',
    'resend',
    config,                   -- copy credentials from Resend Default
    '{
      "logo_url": "",
      "primary_color": "#0b2d6b",
      "secondary_color": "#5b78ff",
      "header_html": "",
      "footer_html": "",
      "legal_text": ""
    }'::jsonb,
    true,
    false
  FROM notification_channels
  WHERE id = v_resend_default_id
  RETURNING id INTO v_resend_sw_id;

  -- ----------------------------------------------------------------
  -- 3. Create "WhatsApp Seguwallet" channel (whatsapp_wazzup24)
  --    Same config as WhatsApp Default
  -- ----------------------------------------------------------------
  INSERT INTO notification_channels (
    name, description, type, provider,
    config, branding,
    is_active, is_default
  )
  SELECT
    'WhatsApp Seguwallet',
    'Canal de WhatsApp para notificaciones de Seguwallet',
    'whatsapp_wazzup24',
    'wazzup24',
    config,                   -- copy credentials from WhatsApp Default
    '{}'::jsonb,
    true,
    false
  FROM notification_channels
  WHERE id = v_wa_default_id
  RETURNING id INTO v_wa_sw_id;

  -- ----------------------------------------------------------------
  -- 4. Assign Resend Default to all non-Seguwallet templates
  -- ----------------------------------------------------------------
  UPDATE correo_plantillas cp
     SET resend_channel_id = v_resend_default_id
    FROM correo_tipos_notificacion ct
   WHERE cp.tipo_notificacion_id = ct.id
     AND ct.modulo != 'SEGUWALLET'
     AND ct.codigo != 'acceso_passwordless'
     AND cp.resend_channel_id IS NULL;

  -- ----------------------------------------------------------------
  -- 5. Assign Seguwallet channels to Seguwallet templates
  --    and to acceso_passwordless (used by Seguwallet login)
  -- ----------------------------------------------------------------
  UPDATE correo_plantillas cp
     SET resend_channel_id  = v_resend_sw_id,
         wazzup24_channel_id = v_wa_sw_id
    FROM correo_tipos_notificacion ct
   WHERE cp.tipo_notificacion_id = ct.id
     AND (ct.modulo = 'SEGUWALLET' OR ct.codigo = 'acceso_passwordless');

END $$;
