/*
  # FIX CRÍTICO: Cálculo ASIMILADOS con División /1.09

  ## PROBLEMA IDENTIFICADO:
  El trigger anterior NO estaba aplicando la división /1.09 correctamente
  para calcular el ISR de ASIMILADOS, causando valores fiscales incorrectos.

  ## SOLUCIÓN:
  Reescribir completamente el trigger para seguir la lógica fiscal CORRECTA:

  ### FÓRMULAS CORRECTAS PARA ASIMILADOS:

  1. Comisión base por póliza = commission_neta (YA CALCULADA)

  2. Agrupación por ramo:
     - Comisión Vida = commission_neta (donde ramo = Vida)
     - Comisión Sin Vida = commission_neta (donde ramo ≠ Vida)

  3. Retención Contable (SOLO VIDA):
     Retención Contable = Comisión Vida × 0.16

  4. Costo de Dispersión (SOLO SIN VIDA):
     Costo Dispersión = Comisión Sin Vida × 0.09

  5. IVA:
     IVA = 0.00

  6. ISR VIDA:
     Base ISR Vida = (Comisión Vida - Retención Contable) / 1.09
     ISR Vida = Base ISR Vida × 0.10

  7. ISR DAÑOS (SIN VIDA):
     Base ISR Daños = (Comisión Sin Vida - Costo Dispersión) / 1.09
     ISR Daños = Base ISR Daños × 0.10

  8. ISR TOTAL:
     ISR Total = ISR Vida + ISR Daños

  9. TOTAL NETO A PAGAR:
     Total Neto = Comisión Total - Retención Contable - Costo Dispersión - ISR Total

  ## VALORES ESPERADOS PARA VALIDACIÓN:
  Para el caso de prueba:
  - Comisión Total: $14,808.07
  - Vida: $544.20
  - Sin Vida: $14,263.87

  Debe resultar en:
  - Ret. Contable: $87.07
  - Costo Dispersión: $1,283.75
  - ISR Total: $1,355.53
  - TOTAL: $12,081.72
*/

-- ============================================
-- NUEVA FUNCIÓN TRIGGER CON CÁLCULO CORRECTO
-- ============================================

CREATE OR REPLACE FUNCTION calcular_asimilados_detalle()
RETURNS TRIGGER AS $$
DECLARE
  agent_regime_name TEXT;
  comision_base NUMERIC;
  ret_contable NUMERIC := 0;
  costo_disp NUMERIC := 0;
  base_isr_vida NUMERIC := 0;
  isr_vida_calc NUMERIC := 0;
  base_isr_danios NUMERIC := 0;
  isr_danios_calc NUMERIC := 0;
  isr_total_calc NUMERIC := 0;
  comision_final_calc NUMERIC := 0;
BEGIN
  -- Obtener régimen fiscal del agente
  SELECT UPPER(COALESCE(cfr.name, cfr2.name, 'HONORARIOS'))
  INTO agent_regime_name
  FROM commission_agents ca
  LEFT JOIN usuarios u ON ca.usuario_id = u.id
  LEFT JOIN commission_fiscal_regimes cfr ON u.regimen_fiscal_id = cfr.id
  LEFT JOIN commission_fiscal_regimes cfr2 ON ca.fiscal_regime_id = cfr2.id
  WHERE ca.id = NEW.agent_id;

  -- Si no es ASIMILADOS, limpiar campos y salir
  IF agent_regime_name IS NULL OR agent_regime_name NOT LIKE '%ASIMILAD%' THEN
    NEW.tipo_ramo := NULL;
    NEW.costo_dispersion := 0;
    NEW.asimilados_retencion_contable := NULL;
    NEW.asimilados_base_vida := NULL;
    NEW.asimilados_comision_vida := NULL;
    NEW.asimilados_base_danios_pre := NULL;
    NEW.asimilados_base_danios_sin_iva := NULL;
    NEW.asimilados_comision_danios := NULL;
    NEW.asimilados_isr_vida := NULL;
    NEW.asimilados_isr_danios := NULL;
    NEW.asimilados_isr_total := NULL;
    NEW.asimilados_comision_final := NULL;
    RETURN NEW;
  END IF;

  -- Clasificar tipo de ramo
  NEW.tipo_ramo := clasificar_tipo_ramo(NEW.ramo);

  -- USAR COMMISSION_NETA como base (NO importe_base)
  comision_base := COALESCE(
    CASE
      WHEN NEW.is_manual_adjusted THEN NEW.adjusted_commission_neta
      ELSE NEW.commission_neta
    END,
    0
  );

  -- ============================================
  -- CÁLCULO PARA VIDA
  -- ============================================
  IF NEW.tipo_ramo = 'VIDA' THEN
    -- Retención Contable = Comisión Vida × 0.16
    ret_contable := ROUND((comision_base * 0.16)::numeric, 2);

    -- Base ISR Vida = (Comisión Vida - Retención Contable) / 1.09
    base_isr_vida := ROUND(((comision_base - ret_contable) / 1.09)::numeric, 2);

    -- ISR Vida = Base ISR Vida × 0.10
    isr_vida_calc := ROUND((base_isr_vida * 0.10)::numeric, 2);

    -- Costo Dispersión = 0 (solo aplica a Sin Vida)
    costo_disp := 0;

    -- Guardar valores intermedios
    NEW.asimilados_retencion_contable := ret_contable;
    NEW.asimilados_base_vida := base_isr_vida;
    NEW.asimilados_comision_vida := NULL;
    NEW.asimilados_isr_vida := isr_vida_calc;
    NEW.asimilados_base_danios_pre := NULL;
    NEW.asimilados_base_danios_sin_iva := NULL;
    NEW.asimilados_comision_danios := NULL;
    NEW.asimilados_isr_danios := 0;

  -- ============================================
  -- CÁLCULO PARA SIN VIDA (DAÑOS)
  -- ============================================
  ELSE
    -- Costo de Dispersión = Comisión Sin Vida × 0.09
    costo_disp := ROUND((comision_base * 0.09)::numeric, 2);

    -- Base ISR Daños = (Comisión Sin Vida - Costo Dispersión) / 1.09
    base_isr_danios := ROUND(((comision_base - costo_disp) / 1.09)::numeric, 2);

    -- ISR Daños = Base ISR Daños × 0.10
    isr_danios_calc := ROUND((base_isr_danios * 0.10)::numeric, 2);

    -- Retención Contable = 0 (solo aplica a Vida)
    ret_contable := 0;

    -- Guardar valores intermedios
    NEW.asimilados_retencion_contable := 0;
    NEW.asimilados_base_vida := NULL;
    NEW.asimilados_comision_vida := NULL;
    NEW.asimilados_isr_vida := 0;
    NEW.asimilados_base_danios_pre := comision_base - costo_disp;
    NEW.asimilados_base_danios_sin_iva := base_isr_danios;
    NEW.asimilados_comision_danios := NULL;
    NEW.asimilados_isr_danios := isr_danios_calc;
  END IF;

  -- ============================================
  -- TOTALES
  -- ============================================
  -- ISR Total = ISR Vida + ISR Daños
  isr_total_calc := ROUND((isr_vida_calc + isr_danios_calc)::numeric, 2);

  -- Total Neto = Comisión Base - Retención Contable - Costo Dispersión - ISR Total
  comision_final_calc := ROUND((comision_base - ret_contable - costo_disp - isr_total_calc)::numeric, 2);

  -- Asignar valores finales
  NEW.costo_dispersion := costo_disp;
  NEW.asimilados_isr_total := isr_total_calc;
  NEW.asimilados_comision_final := comision_final_calc;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- RECREAR TRIGGER
-- ============================================

DROP TRIGGER IF EXISTS trigger_calcular_asimilados ON commission_details;

CREATE TRIGGER trigger_calcular_asimilados
  BEFORE INSERT OR UPDATE ON commission_details
  FOR EACH ROW
  EXECUTE FUNCTION calcular_asimilados_detalle();

-- ============================================
-- RECALCULAR REGISTROS EXISTENTES
-- ============================================

-- Forzar recálculo actualizando el mismo valor para que el trigger se ejecute
UPDATE commission_details cd
SET commission_neta = cd.commission_neta
WHERE EXISTS (
  SELECT 1
  FROM commission_agents ca
  LEFT JOIN usuarios u ON ca.usuario_id = u.id
  LEFT JOIN commission_fiscal_regimes cfr ON u.regimen_fiscal_id = cfr.id
  WHERE ca.id = cd.agent_id
    AND UPPER(cfr.name) LIKE '%ASIMILAD%'
);
