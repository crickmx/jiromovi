/*
  # Fix: Soporte para Múltiples Regímenes Fiscales en un Mismo Lote

  1. Cambios
    - Añadir columnas fiscales a commission_details para cálculos por vendedor
    - Permitir que commission_batches.regimen_fiscal sea NULL (lotes mixtos)
    - Crear trigger para calcular valores fiscales por detail
    - Actualizar función de recálculo para manejar lotes mixtos

  2. Lógica
    - Si un lote tiene múltiples usuarios con diferentes regímenes → regimen_fiscal = NULL
    - Cada commission_detail tiene sus propios valores fiscales calculados
    - Los totales del batch son la SUMA de todos los details
*/

-- Añadir columnas fiscales a commission_details
ALTER TABLE commission_details
ADD COLUMN IF NOT EXISTS regimen_fiscal TEXT,
ADD COLUMN IF NOT EXISTS iva NUMERIC(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS ret_isr NUMERIC(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS ret_iva NUMERIC(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS retencion_contable NUMERIC(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS costo_dispersion NUMERIC(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_neto NUMERIC(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS calculated_at TIMESTAMPTZ;

-- Función para calcular valores fiscales de un detail individual
CREATE OR REPLACE FUNCTION calculate_detail_fiscal_values()
RETURNS TRIGGER AS $$
DECLARE
  v_regimen_fiscal TEXT;
  v_fiscal_regime RECORD;
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
  SELECT 
    UPPER(COALESCE(cfr.name, 'HONORARIOS')) as regime_name,
    cfr.iva_trasladado,
    cfr.iva_retenido,
    cfr.isr
  INTO v_fiscal_regime
  FROM usuarios u
  LEFT JOIN commission_fiscal_regimes cfr ON cfr.id = u.regimen_fiscal_id
  WHERE u.id = NEW.usuario_id;

  v_regimen_fiscal := v_fiscal_regime.regime_name;
  v_commission_neta := NEW.commission_neta;
  v_tipo_ramo := NEW.tipo_ramo;

  -- Calcular según régimen fiscal
  IF v_regimen_fiscal = 'ASIMILADOS' THEN
    -- Asimilados: tiene retención contable y costo de dispersión
    IF v_tipo_ramo = 'VIDA' THEN
      v_retencion_contable := v_commission_neta * 0.01;
      v_costo_dispersion := (v_commission_neta - v_retencion_contable) * 0.09;
      v_ret_isr := ((v_commission_neta - v_retencion_contable - v_costo_dispersion) * v_fiscal_regime.isr) / 1.09;
    ELSE
      v_ret_isr := (v_commission_neta * v_fiscal_regime.isr) / 1.09;
    END IF;
    v_total_neto := v_commission_neta - v_retencion_contable - v_costo_dispersion - v_ret_isr;
    
  ELSIF v_regimen_fiscal = 'RESICO' THEN
    -- RESICO
    v_iva := v_commission_neta * v_fiscal_regime.iva_trasladado;
    v_ret_isr := (v_commission_neta + v_iva) * v_fiscal_regime.isr;
    v_ret_iva := v_iva * v_fiscal_regime.iva_retenido;
    v_total_neto := v_commission_neta + v_iva - v_ret_isr - v_ret_iva;
    
  ELSE -- HONORARIOS
    v_iva := v_commission_neta * v_fiscal_regime.iva_trasladado;
    v_ret_isr := (v_commission_neta + v_iva) * v_fiscal_regime.isr;
    v_ret_iva := v_iva * v_fiscal_regime.iva_retenido;
    v_total_neto := v_commission_neta + v_iva - v_ret_isr - v_ret_iva;
  END IF;

  -- Asignar valores calculados
  NEW.regimen_fiscal := v_regimen_fiscal;
  NEW.iva := v_iva;
  NEW.ret_isr := v_ret_isr;
  NEW.ret_iva := v_ret_iva;
  NEW.retencion_contable := v_retencion_contable;
  NEW.costo_dispersion := v_costo_dispersion;
  NEW.total_neto := v_total_neto;
  NEW.calculated_at := NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para calcular valores fiscales automáticamente
DROP TRIGGER IF EXISTS calculate_detail_fiscal_values_trigger ON commission_details;
CREATE TRIGGER calculate_detail_fiscal_values_trigger
  BEFORE INSERT OR UPDATE OF commission_neta, usuario_id, tipo_ramo
  ON commission_details
  FOR EACH ROW
  EXECUTE FUNCTION calculate_detail_fiscal_values();

-- Función para actualizar totales del batch después de cambios en details
CREATE OR REPLACE FUNCTION update_batch_totals_from_details()
RETURNS TRIGGER AS $$
DECLARE
  v_batch_id UUID;
  v_regimen_count INTEGER;
BEGIN
  -- Determinar el batch_id
  IF TG_OP = 'DELETE' THEN
    v_batch_id := OLD.batch_id;
  ELSE
    v_batch_id := NEW.batch_id;
  END IF;

  -- Contar cuántos regímenes fiscales distintos hay en el lote
  SELECT COUNT(DISTINCT regimen_fiscal)
  INTO v_regimen_count
  FROM commission_details
  WHERE batch_id = v_batch_id
    AND regimen_fiscal IS NOT NULL;

  -- Actualizar totales del batch
  UPDATE commission_batches
  SET 
    -- Si hay múltiples regímenes, dejar NULL. Si hay uno solo, usar ese.
    regimen_fiscal = CASE 
      WHEN v_regimen_count = 1 THEN (
        SELECT DISTINCT regimen_fiscal 
        FROM commission_details 
        WHERE batch_id = v_batch_id 
        LIMIT 1
      )
      ELSE NULL
    END,
    commission_vida = COALESCE((
      SELECT SUM(commission_neta)
      FROM commission_details
      WHERE batch_id = v_batch_id AND tipo_ramo = 'VIDA'
    ), 0),
    commission_sinvida = COALESCE((
      SELECT SUM(commission_neta)
      FROM commission_details
      WHERE batch_id = v_batch_id AND tipo_ramo != 'VIDA'
    ), 0),
    commission_total = COALESCE((
      SELECT SUM(commission_neta)
      FROM commission_details
      WHERE batch_id = v_batch_id
    ), 0),
    retencion_contable = COALESCE((
      SELECT SUM(retencion_contable)
      FROM commission_details
      WHERE batch_id = v_batch_id
    ), 0),
    costo_dispersion = COALESCE((
      SELECT SUM(costo_dispersion)
      FROM commission_details
      WHERE batch_id = v_batch_id
    ), 0),
    iva = COALESCE((
      SELECT SUM(iva)
      FROM commission_details
      WHERE batch_id = v_batch_id
    ), 0),
    ret_isr = COALESCE((
      SELECT SUM(ret_isr)
      FROM commission_details
      WHERE batch_id = v_batch_id
    ), 0),
    ret_iva = COALESCE((
      SELECT SUM(ret_iva)
      FROM commission_details
      WHERE batch_id = v_batch_id
    ), 0),
    total_neto = COALESCE((
      SELECT SUM(total_neto)
      FROM commission_details
      WHERE batch_id = v_batch_id
    ), 0),
    calculated_at = NOW(),
    tax_version = '2026-v1',
    updated_at = NOW()
  WHERE id = v_batch_id;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para actualizar batch cuando cambian los details
DROP TRIGGER IF EXISTS update_batch_totals_trigger ON commission_details;
CREATE TRIGGER update_batch_totals_trigger
  AFTER INSERT OR UPDATE OR DELETE
  ON commission_details
  FOR EACH ROW
  EXECUTE FUNCTION update_batch_totals_from_details();

-- Recalcular todos los details existentes
UPDATE commission_details
SET commission_neta = commission_neta
WHERE calculated_at IS NULL;
