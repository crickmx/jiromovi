/*
  # Fix Admin Digital Notification Trigger

  1. Changes
    - Remove the per-row trigger on clara_transactions (fires too early, inaccurate totals)
    - Add a trigger on clara_periods UPDATE instead (fires after all transactions are saved and period totals updated)
    - This ensures the notification contains accurate transaction_count and total_amount_mxn

  2. Notes
    - Notification only fires when transaction_count or total_amount_mxn actually changes
    - Still sends to ccjimenez@jiro.com.mx via email and WhatsApp
*/

-- Remove the old trigger on clara_transactions
DROP TRIGGER IF EXISTS trigger_notificar_admin_digital_batch ON clara_transactions;
DROP FUNCTION IF EXISTS notificar_admin_digital_batch_guardado();

-- Create improved trigger on clara_periods
CREATE OR REPLACE FUNCTION notificar_admin_digital_periodo_actualizado()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_destinatario_id uuid := '5c22eb53-5090-49f7-9e36-7748baee5f2c';
  v_variables jsonb;
BEGIN
  -- Only fire when transaction_count or total_amount_mxn changes (i.e., new data was imported)
  IF (OLD.transaction_count IS NOT DISTINCT FROM NEW.transaction_count)
     AND (OLD.total_amount_mxn IS NOT DISTINCT FROM NEW.total_amount_mxn) THEN
    RETURN NEW;
  END IF;

  v_variables := jsonb_build_object(
    'periodo', COALESCE(NEW.label, NEW.period_key, 'Sin periodo'),
    'total_transacciones', COALESCE(NEW.transaction_count, 0)::text,
    'monto_total', '$' || to_char(COALESCE(NEW.total_amount_mxn, 0), 'FM999,999,999.00') || ' MXN',
    'archivo', COALESCE(NEW.file_name, 'No especificado'),
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

-- Also fire on INSERT (new period created with upsert)
CREATE OR REPLACE FUNCTION notificar_admin_digital_periodo_creado()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_destinatario_id uuid := '5c22eb53-5090-49f7-9e36-7748baee5f2c';
  v_variables jsonb;
BEGIN
  -- Only fire if there are actual transactions
  IF COALESCE(NEW.transaction_count, 0) = 0 THEN
    RETURN NEW;
  END IF;

  v_variables := jsonb_build_object(
    'periodo', COALESCE(NEW.label, NEW.period_key, 'Sin periodo'),
    'total_transacciones', COALESCE(NEW.transaction_count, 0)::text,
    'monto_total', '$' || to_char(COALESCE(NEW.total_amount_mxn, 0), 'FM999,999,999.00') || ' MXN',
    'archivo', COALESCE(NEW.file_name, 'No especificado'),
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

-- Trigger on UPDATE (period totals updated after batch save)
DROP TRIGGER IF EXISTS trigger_notificar_admin_digital_periodo_update ON clara_periods;
CREATE TRIGGER trigger_notificar_admin_digital_periodo_update
  AFTER UPDATE ON clara_periods
  FOR EACH ROW
  EXECUTE FUNCTION notificar_admin_digital_periodo_actualizado();

-- Trigger on INSERT (new period created via upsert on first import)
DROP TRIGGER IF EXISTS trigger_notificar_admin_digital_periodo_insert ON clara_periods;
CREATE TRIGGER trigger_notificar_admin_digital_periodo_insert
  AFTER INSERT ON clara_periods
  FOR EACH ROW
  EXECUTE FUNCTION notificar_admin_digital_periodo_creado();
