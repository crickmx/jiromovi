/*
  # Cambiar costo de dispersión de Asimilados de 10% a 9%

  ## Descripción
  Corrección del porcentaje de costo de dispersión para el régimen fiscal
  de Asimilados en pólizas Sin Vida (Daños).

  ## Cambio
  - **Antes**: Costo Dispersión = Comisión Sin Vida × 0.10 (10%)
  - **Ahora**: Costo Dispersión = Comisión Sin Vida × 0.09 (9%)

  ## Impacto
  Esta función se usa para calcular el desglose fiscal a nivel de lote
  en el módulo de comisiones para agentes con régimen Asimilados.

  ## Nota
  Honorarios mantiene su 9% sin cambios.
  Solo se modifica Asimilados de 10% a 9%.
*/

-- ============================================
-- Actualizar función de cálculo Asimilados
-- ============================================

CREATE OR REPLACE FUNCTION calculate_asimilados_fiscal_desglose(p_batch_id uuid)
RETURNS jsonb AS $$
DECLARE
  v_comision_total numeric := 0;
  v_comision_vida numeric := 0;
  v_comision_sin_vida numeric := 0;
  v_ret_contable numeric := 0;
  v_costo_dispersion numeric := 0;
  v_isr_vida numeric := 0;
  v_isr_danios numeric := 0;
  v_isr_total numeric := 0;
  v_total_final numeric := 0;
  v_result jsonb;
BEGIN
  -- 1. Calcular Comisión Vida (suma de commission_neta donde ramo = 'Vida')
  SELECT COALESCE(SUM(commission_neta), 0) INTO v_comision_vida
  FROM commission_details
  WHERE batch_id = p_batch_id
    AND LOWER(ramo) = 'vida';

  -- 2. Calcular Comisión Total (suma de todos los commission_neta)
  SELECT COALESCE(SUM(commission_neta), 0) INTO v_comision_total
  FROM commission_details
  WHERE batch_id = p_batch_id;

  -- 3. Comisión Sin Vida = Comisión Total - Comisión Vida
  v_comision_sin_vida := v_comision_total - v_comision_vida;

  -- 4. Retención Contable: SOLO en Vida (16%)
  v_ret_contable := ROUND((v_comision_vida * 0.16)::numeric, 2);

  -- 5. Costo de Dispersión: SOLO en Sin Vida (9% para ASIMILADOS)
  v_costo_dispersion := ROUND((v_comision_sin_vida * 0.09)::numeric, 2);

  -- 6. ISR Vida: (Comisión Vida - Retención Contable) × 10%
  v_isr_vida := ROUND(((v_comision_vida - v_ret_contable) * 0.10)::numeric, 2);

  -- 7. ISR Daños: (Comisión Sin Vida - Costo Dispersión) × 10%
  v_isr_danios := ROUND(((v_comision_sin_vida - v_costo_dispersion) * 0.10)::numeric, 2);

  -- 8. ISR Total
  v_isr_total := ROUND((v_isr_vida + v_isr_danios)::numeric, 2);

  -- 9. Total Final = Comisión Total - Retención - Dispersión - ISR Total
  v_total_final := ROUND(
    (v_comision_total - v_ret_contable - v_costo_dispersion - v_isr_total)::numeric,
    2
  );

  -- 10. Construir resultado JSON
  v_result := jsonb_build_object(
    'regimen_fiscal', 'ASIMILADOS',
    'base_calculo', 'Comisión Neta',
    'comision_total', v_comision_total,
    'comision_vida', v_comision_vida,
    'comision_sin_vida', v_comision_sin_vida,
    'retencion_contable', v_ret_contable,
    'costo_dispersion', v_costo_dispersion,
    'isr_vida', v_isr_vida,
    'isr_danios', v_isr_danios,
    'isr_total', v_isr_total,
    'total_final', v_total_final,
    'formula_isr_vida', '(Comisión Vida - Retención Contable) × 0.10',
    'formula_isr_danios', '(Comisión Sin Vida - Dispersión) × 0.10',
    'formula_total', 'Comisión Total - Retención - Dispersión - ISR Total',
    'calculated_at', NOW()
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================
-- Actualizar comentarios de documentación
-- ============================================

COMMENT ON FUNCTION calculate_asimilados_fiscal_desglose IS
'Calcula el desglose fiscal para ASIMILADOS usando Comisión Neta como base.
Fórmulas:
- Retención Contable = Comisión Vida × 0.16
- Costo Dispersión = Comisión Sin Vida × 0.09 (actualizado de 0.10)
- ISR Vida = (Comisión Vida - Retención) × 0.10
- ISR Daños = (Comisión Sin Vida - Dispersión) × 0.10
- Total Final = Comisión Total - Retención - Dispersión - ISR Total';

-- ============================================
-- Log de confirmación
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'COSTO DE DISPERSIÓN ACTUALIZADO';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Régimen: ASIMILADOS';
  RAISE NOTICE 'Cambio: 10%% → 9%%';
  RAISE NOTICE 'Aplica a: Comisiones Sin Vida (Daños)';
  RAISE NOTICE '========================================';
END $$;
