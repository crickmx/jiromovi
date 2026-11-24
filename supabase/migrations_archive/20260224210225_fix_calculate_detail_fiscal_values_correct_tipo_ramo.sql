/*
  # Fix: Calcular valores fiscales correctamente en commission_details

  1. Problemas detectados
    - tipo_ramo es NULL porque no se está calculando
    - Los valores fiscales salen NULL o 0
    - El constraint permite 'VIDA' o 'DAÑOS', NO 'SIN VIDA'

  2. Solución
    - Calcular tipo_ramo desde el campo 'ramo' usando 'DAÑOS' en lugar de 'SIN VIDA'
    - Usar porcentajes fijos conocidos para cada régimen
    - Asegurar que todos los cálculos funcionen correctamente
*/

-- Eliminar trigger anterior
DROP TRIGGER IF EXISTS calculate_detail_fiscal_values_trigger ON commission_details;

-- Recrear función con lógica correcta
CREATE OR REPLACE FUNCTION calculate_detail_fiscal_values()
RETURNS TRIGGER AS $$
DECLARE
  v_regimen_fiscal TEXT;
  v_commission_neta NUMERIC;
  v_tipo_ramo TEXT;
  v_iva NUMERIC := 0;
  v_ret_isr NUMERIC := 0;
  v_ret_iva NUMERIC := 0;
  v_retencion_contable NUMERIC := 0;
  v_costo_dispersion NUMERIC := 0;
  v_total_neto NUMERIC := 0;
BEGIN
  -- Obtener régimen fiscal del usuario
  SELECT UPPER(COALESCE(cfr.name, 'HONORARIOS'))
  INTO v_regimen_fiscal
  FROM usuarios u
  LEFT JOIN commission_fiscal_regimes cfr ON cfr.id = u.regimen_fiscal_id
  WHERE u.id = NEW.usuario_id;

  IF v_regimen_fiscal IS NULL THEN
    v_regimen_fiscal := 'HONORARIOS';
  END IF;

  -- Calcular tipo_ramo desde el campo ramo
  -- IMPORTANTE: El constraint permite solo 'VIDA' o 'DAÑOS'
  IF UPPER(NEW.ramo) = 'VIDA' THEN
    v_tipo_ramo := 'VIDA';
  ELSE
    v_tipo_ramo := 'DAÑOS';
  END IF;

  v_commission_neta := COALESCE(NEW.commission_neta, 0);

  -- Calcular según régimen fiscal con porcentajes FIJOS
  IF v_regimen_fiscal = 'ASIMILADOS' THEN
    -- ASIMILADOS: Sin IVA, con retención contable y costo dispersión
    IF v_tipo_ramo = 'VIDA' THEN
      v_retencion_contable := v_commission_neta * 0.16;
    ELSE
      v_costo_dispersion := v_commission_neta * 0.09;
    END IF;
    
    -- ISR: 10% sobre el neto después de retenciones
    IF v_tipo_ramo = 'VIDA' THEN
      v_ret_isr := (v_commission_neta / 1.16) * 0.10;
    ELSE
      v_ret_isr := (v_commission_neta / 1.09) * 0.10;
    END IF;
    
    v_iva := 0;
    v_ret_iva := 0;
    v_total_neto := v_commission_neta - v_retencion_contable - v_costo_dispersion - v_ret_isr;
    
  ELSIF v_regimen_fiscal = 'RESICO' THEN
    -- RESICO: 1.25% ISR, mismo IVA que HONORARIOS
    IF v_tipo_ramo != 'VIDA' THEN
      v_iva := v_commission_neta * 0.16;
      v_ret_iva := (v_commission_neta * 16) / 150; -- 10.667%
    END IF;
    v_ret_isr := v_commission_neta * 0.0125;
    v_total_neto := v_commission_neta + v_iva - v_ret_isr - v_ret_iva;
    
  ELSE -- HONORARIOS
    -- HONORARIOS: 10% ISR
    IF v_tipo_ramo != 'VIDA' THEN
      v_iva := v_commission_neta * 0.16;
      v_ret_iva := (v_commission_neta * 16) / 150; -- 10.667%
    END IF;
    v_ret_isr := v_commission_neta * 0.10;
    v_total_neto := v_commission_neta + v_iva - v_ret_isr - v_ret_iva;
  END IF;

  -- Redondear todos los valores a 2 decimales
  NEW.regimen_fiscal := v_regimen_fiscal;
  NEW.tipo_ramo := v_tipo_ramo;
  NEW.iva := ROUND(v_iva, 2);
  NEW.ret_isr := ROUND(v_ret_isr, 2);
  NEW.ret_iva := ROUND(v_ret_iva, 2);
  NEW.retencion_contable := ROUND(v_retencion_contable, 2);
  NEW.costo_dispersion := ROUND(v_costo_dispersion, 2);
  NEW.total_neto := ROUND(v_total_neto, 2);
  NEW.calculated_at := NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Crear trigger (solo cuando cambia commission_neta, usuario_id o ramo)
CREATE TRIGGER calculate_detail_fiscal_values_trigger
  BEFORE INSERT OR UPDATE OF commission_neta, usuario_id, ramo
  ON commission_details
  FOR EACH ROW
  EXECUTE FUNCTION calculate_detail_fiscal_values();

-- Recalcular todos los registros existentes
UPDATE commission_details
SET commission_neta = commission_neta
WHERE calculated_at IS NULL OR tipo_ramo IS NULL;

COMMENT ON FUNCTION calculate_detail_fiscal_values IS
'Calcula automáticamente los valores fiscales de cada commission_detail según el régimen del usuario.
HONORARIOS: 10% ISR, 16% IVA (daños), 10.667% Ret IVA
RESICO: 1.25% ISR, 16% IVA (daños), 10.667% Ret IVA
ASIMILADOS: 10% ISR, 16% Ret Contable (vida), 9% Costo Dispersión (daños)';
