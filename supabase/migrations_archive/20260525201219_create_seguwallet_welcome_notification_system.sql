/*
  # Seguwallet Welcome Email System

  ## Summary
  Automatic branded welcome email when a Seguwallet customer is created.
  The template is administrable via MOVI's existing notification template UI
  (correo_plantillas / GestionPlantillas.tsx) so admins can edit subject,
  HTML body, and channel toggles without code changes.

  ## What this does
  1. Adds the `seguwallet_bienvenida` notification type to correo_tipos_notificacion
  2. Inserts a default agent-branded HTML welcome template into correo_plantillas
     (idempotent — only inserts if missing)
  3. Creates a trigger on seguwallet_customers AFTER INSERT that fires a
     pg_net call to the new edge function `seguwallet-send-welcome`
  4. The trigger is wrapped in BEGIN/EXCEPTION so a failure NEVER blocks
     customer creation; errors are logged via RAISE WARNING

  ## Variables available in the template
  - {{nombre_cliente}}, {{email_cliente}}, {{telefono_cliente}}
  - {{nombre_agente}}, {{nombre_comercial_agente}}, {{telefono_agente}},
    {{whatsapp_agente}}, {{email_agente}}
  - {{logo_agente}}, {{logo_oficina}}, {{logo_seguwallet}}
  - {{color_primario}}, {{color_secundario}}
  - {{url_seguwallet}}, {{url_agente}}, {{url_aviso_privacidad}}

  ## Channels
  Email is enabled by default. WhatsApp/in-app are disabled (architecture
  ready, but admin can enable them later from the UI).

  ## Security
  - Trigger function runs as SECURITY DEFINER
  - Edge function call uses service_role from vault
  - No customer data exposure beyond what the customer record already contains
*/

-- 1. Notification type
INSERT INTO correo_tipos_notificacion (codigo, nombre, descripcion, activo, modulo, trigger_event, destinatario_tipo, enviar_correo, enviar_whatsapp, enviar_notificacion)
VALUES (
  'seguwallet_bienvenida',
  'Bienvenida Seguwallet',
  'Correo automatico de bienvenida cuando un agente da de alta a un cliente en Seguwallet. Personalizado con la marca del agente.',
  true,
  'seguwallet',
  'on_customer_create',
  'cliente_seguwallet',
  true,
  false,
  false
)
ON CONFLICT (codigo) DO UPDATE SET
  nombre = EXCLUDED.nombre,
  descripcion = EXCLUDED.descripcion,
  activo = true,
  modulo = EXCLUDED.modulo;

-- 2. Default template (only if no template exists for this type)
DO $$
DECLARE
  v_tipo_id uuid;
  v_existing uuid;
  v_html text;
BEGIN
  SELECT id INTO v_tipo_id FROM correo_tipos_notificacion WHERE codigo = 'seguwallet_bienvenida';

  SELECT id INTO v_existing FROM correo_plantillas
  WHERE tipo_notificacion_id = v_tipo_id AND es_plantilla_default = true
  LIMIT 1;

  IF v_existing IS NOT NULL THEN
    RETURN;
  END IF;

  v_html := $HTML$<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Bienvenido a Seguwallet</title>
</head>
<body style="margin:0;padding:0;background:#f5f7fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f7fb;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 6px 24px rgba(15,23,42,0.06);">
        <tr>
          <td style="padding:28px 32px 16px 32px;background:#ffffff;border-bottom:1px solid #eef2f7;">
            <table role="presentation" width="100%"><tr>
              <td align="left" style="vertical-align:middle;">
                <img src="{{logo_agente}}" alt="{{nombre_comercial_agente}}" style="max-height:44px;max-width:200px;display:block;">
              </td>
              <td align="right" style="vertical-align:middle;font-size:12px;color:#64748b;">
                Powered by Seguwallet
              </td>
            </tr></table>
          </td>
        </tr>

        <tr>
          <td style="padding:0;">
            <div style="background:linear-gradient(135deg,{{color_primario}} 0%,{{color_secundario}} 100%);padding:48px 32px;color:#ffffff;text-align:center;">
              <h1 style="margin:0 0 12px 0;font-size:28px;line-height:1.25;font-weight:700;letter-spacing:-0.02em;">Hola {{nombre_cliente}}</h1>
              <p style="margin:0;font-size:16px;line-height:1.55;opacity:0.95;">Tu cuenta en Seguwallet ya esta lista. Desde aqui podras consultar tus polizas, pagos y documentos en un solo lugar.</p>
            </div>
          </td>
        </tr>

        <tr>
          <td style="padding:32px;">
            <p style="margin:0 0 20px 0;font-size:15px;line-height:1.6;color:#334155;">
              Soy <strong>{{nombre_agente}}</strong>, tu agente de seguros. Te doy la bienvenida a tu nuevo portal personal donde tendras acceso 24/7 a tu informacion.
            </p>

            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;">
              <tr>
                <td style="padding:14px;background:#f8fafc;border-radius:10px;border:1px solid #e2e8f0;">
                  <table role="presentation" width="100%"><tr>
                    <td width="40" style="vertical-align:top;">
                      <div style="width:32px;height:32px;background:{{color_primario}};border-radius:8px;color:#fff;text-align:center;line-height:32px;font-weight:700;">1</div>
                    </td>
                    <td style="vertical-align:top;padding-left:8px;">
                      <div style="font-size:14px;font-weight:600;color:#0f172a;margin-bottom:2px;">Consulta tus polizas</div>
                      <div style="font-size:13px;color:#64748b;line-height:1.5;">Revisa coberturas, vigencias y documentos en cualquier momento.</div>
                    </td>
                  </tr></table>
                </td>
              </tr>
              <tr><td style="height:10px;"></td></tr>
              <tr>
                <td style="padding:14px;background:#f8fafc;border-radius:10px;border:1px solid #e2e8f0;">
                  <table role="presentation" width="100%"><tr>
                    <td width="40" style="vertical-align:top;">
                      <div style="width:32px;height:32px;background:{{color_primario}};border-radius:8px;color:#fff;text-align:center;line-height:32px;font-weight:700;">2</div>
                    </td>
                    <td style="vertical-align:top;padding-left:8px;">
                      <div style="font-size:14px;font-weight:600;color:#0f172a;margin-bottom:2px;">Descarga documentos</div>
                      <div style="font-size:13px;color:#64748b;line-height:1.5;">Tus polizas, recibos y constancias siempre disponibles.</div>
                    </td>
                  </tr></table>
                </td>
              </tr>
              <tr><td style="height:10px;"></td></tr>
              <tr>
                <td style="padding:14px;background:#f8fafc;border-radius:10px;border:1px solid #e2e8f0;">
                  <table role="presentation" width="100%"><tr>
                    <td width="40" style="vertical-align:top;">
                      <div style="width:32px;height:32px;background:{{color_primario}};border-radius:8px;color:#fff;text-align:center;line-height:32px;font-weight:700;">3</div>
                    </td>
                    <td style="vertical-align:top;padding-left:8px;">
                      <div style="font-size:14px;font-weight:600;color:#0f172a;margin-bottom:2px;">Cotiza nuevos seguros</div>
                      <div style="font-size:13px;color:#64748b;line-height:1.5;">Solicita cotizaciones directamente desde tu portal.</div>
                    </td>
                  </tr></table>
                </td>
              </tr>
            </table>

            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:28px 0 8px 0;">
              <tr><td align="center">
                <a href="{{url_seguwallet}}" style="display:inline-block;background:{{color_primario}};color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:14px 32px;border-radius:10px;letter-spacing:0.01em;">Ingresar a Seguwallet</a>
              </td></tr>
            </table>

            <p style="margin:18px 0 0 0;font-size:13px;line-height:1.55;color:#64748b;text-align:center;">
              Inicia sesion con el correo <strong style="color:#0f172a;">{{email_cliente}}</strong> y la contrasena que tu agente compartio contigo.
            </p>
          </td>
        </tr>

        <tr>
          <td style="padding:0 32px 32px 32px;">
            <div style="border-top:1px solid #eef2f7;padding-top:20px;">
              <p style="margin:0 0 6px 0;font-size:13px;color:#64748b;">Tu agente</p>
              <p style="margin:0 0 4px 0;font-size:15px;font-weight:600;color:#0f172a;">{{nombre_agente}}</p>
              <p style="margin:0;font-size:13px;color:#475569;line-height:1.6;">
                <a href="mailto:{{email_agente}}" style="color:{{color_primario}};text-decoration:none;">{{email_agente}}</a><br>
                <a href="tel:{{telefono_agente}}" style="color:#475569;text-decoration:none;">{{telefono_agente}}</a>
              </p>
            </div>
          </td>
        </tr>

        <tr>
          <td style="padding:18px 32px;background:#f8fafc;border-top:1px solid #eef2f7;text-align:center;font-size:12px;color:#94a3b8;line-height:1.6;">
            Recibes este correo porque tu agente {{nombre_agente}} te dio de alta en Seguwallet.<br>
            <a href="{{url_aviso_privacidad}}" style="color:#64748b;text-decoration:underline;">Aviso de privacidad</a>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>$HTML$;

  INSERT INTO correo_plantillas (
    tipo_notificacion_id,
    asunto,
    html_cuerpo,
    variables_disponibles,
    es_plantilla_default,
    enviar_correo,
    enviar_whatsapp,
    enviar_notificacion,
    whatsapp_plantilla,
    notificacion_titulo,
    notificacion_cuerpo
  ) VALUES (
    v_tipo_id,
    'Bienvenido a Seguwallet, {{nombre_cliente}}',
    v_html,
    ARRAY[
      'nombre_cliente','email_cliente','telefono_cliente',
      'nombre_agente','nombre_comercial_agente','telefono_agente','whatsapp_agente','email_agente',
      'logo_agente','logo_oficina','logo_seguwallet',
      'color_primario','color_secundario',
      'url_seguwallet','url_agente','url_aviso_privacidad'
    ],
    true,
    true,
    false,
    false,
    'Hola {{nombre_cliente}}, tu cuenta de Seguwallet ya esta lista. Ingresa con {{email_cliente}} en {{url_seguwallet}}. Tu agente: {{nombre_agente}}.',
    'Bienvenido a Seguwallet',
    'Tu cuenta esta lista. Ingresa con {{email_cliente}}.'
  );
END $$;

-- 3. Trigger function: fires edge function asynchronously on customer creation
CREATE OR REPLACE FUNCTION trigger_seguwallet_welcome_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_supabase_url text;
  v_service_key  text;
BEGIN
  IF NEW.email IS NULL OR trim(NEW.email) = '' THEN
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM 'active' THEN
    RETURN NEW;
  END IF;

  v_supabase_url := current_setting('app.settings.supabase_url', true);
  v_service_key  := current_setting('app.settings.service_role_key', true);

  IF v_supabase_url IS NULL OR v_service_key IS NULL THEN
    v_supabase_url := 'https://qhwvuuyjhcennqccgvse.supabase.co';
    BEGIN
      v_service_key := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1);
    EXCEPTION WHEN OTHERS THEN
      v_service_key := NULL;
    END;
  END IF;

  IF v_service_key IS NULL THEN
    RAISE WARNING '[SEGUWALLET WELCOME] No service_role_key available; skipping welcome email for customer %', NEW.id;
    RETURN NEW;
  END IF;

  BEGIN
    PERFORM net.http_post(
      url     := v_supabase_url || '/functions/v1/seguwallet-send-welcome',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || v_service_key
      ),
      body    := jsonb_build_object('customer_id', NEW.id)
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[SEGUWALLET WELCOME] Failed to enqueue email for customer %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_seguwallet_welcome_email ON seguwallet_customers;

CREATE TRIGGER trigger_seguwallet_welcome_email
  AFTER INSERT ON seguwallet_customers
  FOR EACH ROW
  EXECUTE FUNCTION trigger_seguwallet_welcome_email();

COMMENT ON FUNCTION trigger_seguwallet_welcome_email() IS
  'Sends branded welcome email when a Seguwallet customer is created. Failure does not block creation.';
