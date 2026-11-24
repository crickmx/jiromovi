/*
  # Función para recalcular todos los lotes de comisiones

  1. Propósito
     - Recalcular todos los lotes de comisiones con el régimen fiscal correcto
     - Útil después de corregir los nombres de los regímenes fiscales

  2. Funcionalidad
     - Obtiene todos los lotes que necesitan recalcularse
     - Ejecuta calculate_batch_fiscal_aggregates para cada uno
     - Retorna un resumen de los lotes procesados
*/

CREATE OR REPLACE FUNCTION recalculate_all_commission_batches()
RETURNS TABLE(
  batch_id uuid,
  usuario_id uuid,
  usuario_nombre text,
  regimen_fiscal_anterior text,
  regimen_fiscal_nuevo text,
  total_neto_anterior numeric,
  total_neto_nuevo numeric,
  success boolean,
  error_message text
) AS $$
DECLARE
  v_batch record;
  v_result jsonb;
  v_old_regime text;
  v_old_total numeric;
BEGIN
  FOR v_batch IN
    SELECT 
      cb.id,
      cb.usuario_id,
      u.nombre || ' ' || u.apellidos as nombre_completo,
      cb.regimen_fiscal as old_regime,
      cb.total_neto as old_total
    FROM commission_batches cb
    JOIN usuarios u ON u.id = cb.usuario_id
    WHERE cb.created_at > NOW() - INTERVAL '30 days'
    ORDER BY cb.created_at DESC
  LOOP
    v_old_regime := v_batch.old_regime;
    v_old_total := v_batch.old_total;
    
    BEGIN
      -- Ejecutar recálculo
      SELECT calculate_batch_fiscal_aggregates(v_batch.id) INTO v_result;
      
      -- Si fue exitoso, retornar el resultado
      IF (v_result->>'success')::boolean THEN
        batch_id := v_batch.id;
        usuario_id := v_batch.usuario_id;
        usuario_nombre := v_batch.nombre_completo;
        regimen_fiscal_anterior := v_old_regime;
        regimen_fiscal_nuevo := v_result->>'regimen_fiscal';
        total_neto_anterior := v_old_total;
        total_neto_nuevo := (v_result->>'total_neto')::numeric;
        success := true;
        error_message := NULL;
        RETURN NEXT;
      ELSE
        batch_id := v_batch.id;
        usuario_id := v_batch.usuario_id;
        usuario_nombre := v_batch.nombre_completo;
        regimen_fiscal_anterior := v_old_regime;
        regimen_fiscal_nuevo := NULL;
        total_neto_anterior := v_old_total;
        total_neto_nuevo := NULL;
        success := false;
        error_message := v_result->>'error';
        RETURN NEXT;
      END IF;
      
    EXCEPTION WHEN OTHERS THEN
      batch_id := v_batch.id;
      usuario_id := v_batch.usuario_id;
      usuario_nombre := v_batch.nombre_completo;
      regimen_fiscal_anterior := v_old_regime;
      regimen_fiscal_nuevo := NULL;
      total_neto_anterior := v_old_total;
      total_neto_nuevo := NULL;
      success := false;
      error_message := SQLERRM;
      RETURN NEXT;
    END;
  END LOOP;
  
  RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION recalculate_all_commission_batches IS
'Recalcula todos los lotes de comisiones de los últimos 30 días con el régimen fiscal correcto del usuario.
Útil después de corregir datos de regímenes fiscales o actualizar fórmulas de cálculo.';