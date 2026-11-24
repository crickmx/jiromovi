/*
  # Admin Digital - Notifications on State Changes

  1. New Notification Type
    - `admin_digital_batch_guardado` - Fired when a batch of transactions is saved in the Clara module

  2. Templates
    - Email template with subject and HTML body showing batch details
    - WhatsApp template with concise summary message
    - In-app notification with title and body

  3. Trigger
    - Function `notificar_admin_digital_batch_guardado()` detects new batch insertions
    - Sends notification to user ccjimenez@jiro.com.mx (ID: 5c22eb53-5090-49f7-9e36-7748baee5f2c)
    - Fires once per batch (uses batch_id to detect first insert of a new batch)

  4. Notes
    - Notification is sent via email and WhatsApp channels
    - Uses existing `enviar_notificacion_transaccional` function
    - Idempotency prevents duplicate notifications for same batch
*/

-- Step 1: Create the notification type
INSERT INTO correo_tipos_notificacion (
  id,
  codigo,
  nombre,
  descripcion,
  activo,
  enviar_correo,
  enviar_whatsapp,
  enviar_notificacion,
  modulo,
  trigger_event,
  destinatario_tipo
) VALUES (
  gen_random_uuid(),
  'admin_digital_batch_guardado',
  'Lote de Gastos Guardado (Admin Digital)',
  'Se dispara cuando se guarda un nuevo lote de transacciones en el modulo Admin Digital (Clara)',
  true,
  true,
  true,
  true,
  'admin_digital',
  'INSERT en clara_transactions',
  'fijo'
) ON CONFLICT (codigo) DO NOTHING;

-- Step 2: Create the email + WhatsApp template
INSERT INTO correo_plantillas (
  id,
  tipo_notificacion_id,
  asunto,
  html_cuerpo,
  variables_disponibles,
  es_plantilla_default,
  whatsapp_plantilla,
  whatsapp_variables_disponibles,
  notificacion_titulo,
  notificacion_cuerpo,
  notificacion_variables_disponibles,
  enviar_correo,
  enviar_whatsapp,
  enviar_notificacion,
  created_at
) VALUES (
  gen_random_uuid(),
  (SELECT id FROM correo_tipos_notificacion WHERE codigo = 'admin_digital_batch_guardado'),
  'Admin Digital: Nuevo lote de gastos procesado - {{periodo}}',
  '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <div style="background: linear-gradient(135deg, #1e293b, #334155); padding: 24px; border-radius: 12px 12px 0 0;">
      <h2 style="color: #ffffff; margin: 0; font-size: 18px;">Admin Digital - Clara</h2>
      <p style="color: #94a3b8; margin: 4px 0 0; font-size: 13px;">Conciliacion de Gastos</p>
    </div>
    <div style="background: #ffffff; padding: 24px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
      <p style="color: #334155; font-size: 14px; line-height: 1.6;">Se ha procesado un nuevo lote de transacciones en el modulo Admin Digital.</p>
      <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="padding: 8px 0; color: #64748b; font-size: 13px;">Periodo</td>
          <td style="padding: 8px 0; color: #1e293b; font-size: 13px; font-weight: 600; text-align: right;">{{periodo}}</td>
        </tr>
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="padding: 8px 0; color: #64748b; font-size: 13px;">Transacciones guardadas</td>
          <td style="padding: 8px 0; color: #1e293b; font-size: 13px; font-weight: 600; text-align: right;">{{total_transacciones}}</td>
        </tr>
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="padding: 8px 0; color: #64748b; font-size: 13px;">Monto total</td>
          <td style="padding: 8px 0; color: #1e293b; font-size: 13px; font-weight: 600; text-align: right;">{{monto_total}}</td>
        </tr>
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="padding: 8px 0; color: #64748b; font-size: 13px;">Archivo fuente</td>
          <td style="padding: 8px 0; color: #1e293b; font-size: 13px; font-weight: 600; text-align: right;">{{archivo}}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #64748b; font-size: 13px;">Fecha de procesamiento</td>
          <td style="padding: 8px 0; color: #1e293b; font-size: 13px; font-weight: 600; text-align: right;">{{fecha_procesamiento}}</td>
        </tr>
      </table>
      <div style="margin-top: 20px; text-align: center;">
        <a href="https://app.movi.digital/admin-digital" style="display: inline-block; background: #2563eb; color: #ffffff; padding: 10px 24px; border-radius: 8px; text-decoration: none; font-size: 13px; font-weight: 600;">Ver en Admin Digital</a>
      </div>
    </div>
  </div>',
  ARRAY['periodo', 'total_transacciones', 'monto_total', 'archivo', 'fecha_procesamiento'],
  true,
  'Admin Digital: Se proceso un lote de {{total_transacciones}} transacciones del periodo {{periodo}} por un monto de {{monto_total}}. Archivo: {{archivo}}. Revisa en: https://app.movi.digital/admin-digital',
  ARRAY['periodo', 'total_transacciones', 'monto_total', 'archivo'],
  'Nuevo lote de gastos procesado',
  'Se guardaron {{total_transacciones}} transacciones del periodo {{periodo}} por {{monto_total}}',
  ARRAY['periodo', 'total_transacciones', 'monto_total'],
  true,
  true,
  true,
  now()
) ON CONFLICT DO NOTHING;

-- Step 3: Create the trigger function
CREATE OR REPLACE FUNCTION notificar_admin_digital_batch_guardado()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_destinatario_id uuid := '5c22eb53-5090-49f7-9e36-7748baee5f2c';
  v_batch_id text;
  v_total_transacciones integer;
  v_monto_total numeric;
  v_periodo_label text;
  v_archivo text;
  v_variables jsonb;
BEGIN
  v_batch_id := NEW.batch_id;

  IF v_batch_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Only fire once per batch: check if this is the first row for this batch_id
  IF EXISTS (
    SELECT 1 FROM clara_transactions
    WHERE batch_id = v_batch_id AND id != NEW.id
    LIMIT 1
  ) THEN
    RETURN NEW;
  END IF;

  -- Use statement-level approach: schedule notification via pg_notify
  -- We'll gather batch stats after a short delay using the period info
  SELECT
    COALESCE(p.label, p.period_key, 'Sin periodo'),
    COALESCE(p.file_name, 'No especificado')
  INTO v_periodo_label, v_archivo
  FROM clara_periods p
  WHERE p.id = NEW.period_id;

  IF NOT FOUND THEN
    v_periodo_label := 'Sin periodo';
    v_archivo := 'No especificado';
  END IF;

  -- For the first row, we use the single transaction data
  -- The actual totals will be available in the period table
  SELECT
    COALESCE(transaction_count, 1),
    COALESCE(total_amount_mxn, NEW.amount_mxn)
  INTO v_total_transacciones, v_monto_total
  FROM clara_periods
  WHERE id = NEW.period_id;

  IF NOT FOUND THEN
    v_total_transacciones := 1;
    v_monto_total := COALESCE(NEW.amount_mxn, 0);
  END IF;

  v_variables := jsonb_build_object(
    'periodo', COALESCE(v_periodo_label, 'Sin periodo'),
    'total_transacciones', v_total_transacciones::text,
    'monto_total', '$' || to_char(COALESCE(v_monto_total, 0), 'FM999,999,999.00') || ' MXN',
    'archivo', COALESCE(v_archivo, 'No especificado'),
    'fecha_procesamiento', to_char(now(), 'DD/MM/YYYY HH24:MI'),
    'url', '/admin-digital'
  );

  PERFORM enviar_notificacion_transaccional(
    p_codigo_tipo := 'admin_digital_batch_guardado',
    p_destinatario_id := v_destinatario_id,
    p_variables := v_variables
  );

  RETURN NEW;
END;
$$;

-- Step 4: Create the trigger on clara_transactions
DROP TRIGGER IF EXISTS trigger_notificar_admin_digital_batch ON clara_transactions;
CREATE TRIGGER trigger_notificar_admin_digital_batch
  AFTER INSERT ON clara_transactions
  FOR EACH ROW
  EXECUTE FUNCTION notificar_admin_digital_batch_guardado();
