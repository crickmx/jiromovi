/*
  # Función de Validación de Lotes de Comisiones

  Esta función valida la consistencia de los datos fiscales de un lote:
  - Verifica que suma de detalles coincida con totales del batch
  - Valida que vida + sinvida = total
  - Verifica que valores fiscales existen para lotes cerrados
  - Valida que las fórmulas fiscales sean correctas según régimen
*/

CREATE OR REPLACE FUNCTION validate_commission_batch(p_batch_id uuid)
RETURNS jsonb AS $$
DECLARE
  v_batch record;
  v_details_sum numeric;
  v_vida_sum numeric;
  v_sinvida_sum numeric;
  v_errors jsonb := '[]'::jsonb;
  v_warnings jsonb := '[]'::jsonb;
  v_expected_iva numeric;
  v_expected_ret_isr numeric;
  v_expected_ret_iva numeric;
BEGIN
  -- Cargar batch
  SELECT * INTO v_batch
  FROM commission_batches
  WHERE id = p_batch_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'valid', false,
      'error', 'Batch no encontrado'
    );
  END IF;
  
  -- Sumar commission_neta de todos los detalles (considerando ajustes)
  SELECT
    COALESCE(SUM(CASE
      WHEN is_manual_adjusted AND adjusted_commission_neta IS NOT NULL
        THEN adjusted_commission_neta
      ELSE commission_neta
    END), 0),
    COALESCE(SUM(CASE
      WHEN LOWER(ramo) = 'vida' THEN
        CASE
          WHEN is_manual_adjusted AND adjusted_commission_neta IS NOT NULL
            THEN adjusted_commission_neta
          ELSE commission_neta
        END
      ELSE 0
    END), 0),
    COALESCE(SUM(CASE
      WHEN LOWER(ramo) != 'vida' THEN
        CASE
          WHEN is_manual_adjusted AND adjusted_commission_neta IS NOT NULL
            THEN adjusted_commission_neta
          ELSE commission_neta
        END
      ELSE 0
    END), 0)
  INTO v_details_sum, v_vida_sum, v_sinvida_sum
  FROM commission_details
  WHERE batch_id = p_batch_id;
  
  -- Validar que suma coincida con batch
  IF v_batch.commission_total IS NOT NULL AND
     ABS(v_batch.commission_total - v_details_sum) > 0.01 THEN
    v_errors := v_errors || jsonb_build_object(
      'code', 'TOTAL_MISMATCH',
      'message', format('commission_total del batch (%s) no coincide con suma de detalles (%s)',
                       v_batch.commission_total, v_details_sum),
      'expected', v_details_sum,
      'actual', v_batch.commission_total
    );
  END IF;
  
  -- Validar vida + sinvida = total
  IF v_batch.commission_vida IS NOT NULL AND v_batch.commission_sinvida IS NOT NULL AND
     ABS((v_batch.commission_vida + v_batch.commission_sinvida) - v_batch.commission_total) > 0.01 THEN
    v_errors := v_errors || jsonb_build_object(
      'code', 'VIDA_SINVIDA_TOTAL_MISMATCH',
      'message', format('vida (%s) + sinvida (%s) != total (%s)',
                       v_batch.commission_vida, v_batch.commission_sinvida, v_batch.commission_total)
    );
  END IF;
  
  -- Validar valores fiscales existen para lotes cerrados
  IF v_batch.status = 'closed' THEN
    IF v_batch.calculated_at IS NULL THEN
      v_errors := v_errors || jsonb_build_object(
        'code', 'MISSING_CALCULATED_AT',
        'message', 'Lote cerrado sin fecha de cálculo fiscal'
      );
    END IF;
    
    IF v_batch.iva IS NULL OR v_batch.ret_isr IS NULL OR
       v_batch.ret_iva IS NULL OR v_batch.total_neto IS NULL THEN
      v_errors := v_errors || jsonb_build_object(
        'code', 'MISSING_FISCAL_VALUES',
        'message', 'Lote cerrado sin valores fiscales calculados'
      );
    END IF;
  END IF;
  
  -- Validar fórmulas según régimen
  IF v_batch.regimen_fiscal IN ('HONORARIOS', 'RESICO') AND v_batch.calculated_at IS NOT NULL THEN
    -- IVA = sinVida × 0.16
    v_expected_iva := ROUND((v_batch.commission_sinvida * 0.16)::numeric, 2);
    IF v_batch.iva IS NOT NULL AND ABS(v_batch.iva - v_expected_iva) > 0.02 THEN
      v_warnings := v_warnings || jsonb_build_object(
        'code', 'IVA_FORMULA_MISMATCH',
        'message', format('IVA (%s) no coincide con fórmula sinVida × 0.16 = %s',
                         v_batch.iva, v_expected_iva),
        'expected', v_expected_iva,
        'actual', v_batch.iva
      );
    END IF;
    
    -- Ret ISR según régimen
    IF v_batch.regimen_fiscal = 'HONORARIOS' THEN
      v_expected_ret_isr := ROUND((v_batch.commission_total * 0.10)::numeric, 2);
      IF v_batch.ret_isr IS NOT NULL AND ABS(v_batch.ret_isr - v_expected_ret_isr) > 0.02 THEN
        v_warnings := v_warnings || jsonb_build_object(
          'code', 'RET_ISR_FORMULA_MISMATCH',
          'message', format('Ret ISR (%s) no coincide con fórmula total × 0.10 = %s',
                           v_batch.ret_isr, v_expected_ret_isr),
          'expected', v_expected_ret_isr,
          'actual', v_batch.ret_isr
        );
      END IF;
    ELSIF v_batch.regimen_fiscal = 'RESICO' THEN
      v_expected_ret_isr := ROUND((v_batch.commission_total * 0.0125)::numeric, 2);
      IF v_batch.ret_isr IS NOT NULL AND ABS(v_batch.ret_isr - v_expected_ret_isr) > 0.02 THEN
        v_warnings := v_warnings || jsonb_build_object(
          'code', 'RET_ISR_FORMULA_MISMATCH',
          'message', format('Ret ISR (%s) no coincide con fórmula total × 0.0125 = %s',
                           v_batch.ret_isr, v_expected_ret_isr),
          'expected', v_expected_ret_isr,
          'actual', v_batch.ret_isr
        );
      END IF;
    END IF;
    
    -- Ret IVA = sinVida × 0.10667
    v_expected_ret_iva := ROUND((v_batch.commission_sinvida * 0.10667)::numeric, 2);
    IF v_batch.ret_iva IS NOT NULL AND ABS(v_batch.ret_iva - v_expected_ret_iva) > 0.02 THEN
      v_warnings := v_warnings || jsonb_build_object(
        'code', 'RET_IVA_FORMULA_MISMATCH',
        'message', format('Ret IVA (%s) no coincide con fórmula sinVida × 0.10667 = %s',
                         v_batch.ret_iva, v_expected_ret_iva),
        'expected', v_expected_ret_iva,
        'actual', v_batch.ret_iva
      );
    END IF;
  END IF;
  
  RETURN jsonb_build_object(
    'valid', jsonb_array_length(v_errors) = 0,
    'errors', v_errors,
    'warnings', v_warnings,
    'summary', jsonb_build_object(
      'batch_id', p_batch_id,
      'regimen_fiscal', v_batch.regimen_fiscal,
      'status', v_batch.status,
      'details_sum', v_details_sum,
      'vida_sum', v_vida_sum,
      'sinvida_sum', v_sinvida_sum,
      'batch_total', v_batch.commission_total,
      'batch_vida', v_batch.commission_vida,
      'batch_sinvida', v_batch.commission_sinvida,
      'calculated_at', v_batch.calculated_at,
      'tax_version', v_batch.tax_version
    )
  );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION validate_commission_batch IS 'Valida la consistencia de los datos fiscales de un lote';
