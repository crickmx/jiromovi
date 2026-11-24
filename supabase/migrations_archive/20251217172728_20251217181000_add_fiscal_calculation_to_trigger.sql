/*
  # Agregar cálculo fiscal automático al trigger de comisiones

  1. Función mejorada
    - Calcula commission_bruta = importe_base × (porcentaje_comision / 100)
    - Obtiene el régimen fiscal del agente
    - Calcula commission_neta aplicando retenciones según régimen:
      * RESICO: comision_neta = comision_bruta (sin retenciones en bruta, se aplican después)
      * Honorarios: comision_neta = comision_bruta (sin retenciones en bruta, se aplican después)
      * Asimilados: comision_neta = comision_bruta (sin retenciones en bruta, se aplican después)
    - Guarda impuestos_json con el desglose fiscal

  2. Lógica fiscal por régimen
    - Los cálculos fiscales completos (IVA, retenciones) se hacen a nivel de lote
    - commission_neta = commission_bruta (base para cálculos posteriores)
    - impuestos_json guarda metadata del régimen

  NOTA: Las retenciones ISR/IVA se calculan a nivel de LOTE completo,
  no por póliza individual, porque dependen de totales por ramo.
*/

-- Eliminar función anterior
DROP FUNCTION IF EXISTS calculate_commission_bruta_trigger() CASCADE;

-- Crear función mejorada con cálculo fiscal
CREATE OR REPLACE FUNCTION calculate_commission_with_fiscal_trigger()
RETURNS TRIGGER AS $$
DECLARE
  v_regime_name text;
  v_ramo_lower text;
BEGIN
  -- 1. Calcular commission_bruta solo si ambos valores existen
  IF NEW.importe_base IS NOT NULL AND NEW.porcentaje_comision IS NOT NULL THEN
    NEW.commission_bruta := ROUND((NEW.importe_base * NEW.porcentaje_comision / 100)::numeric, 2);
  ELSE
    NEW.commission_bruta := NULL;
  END IF;

  -- 2. Obtener régimen fiscal del agente
  IF NEW.agent_id IS NOT NULL THEN
    SELECT cfr.name INTO v_regime_name
    FROM commission_agents ca
    LEFT JOIN commission_fiscal_regimes cfr ON ca.fiscal_regime_id = cfr.id
    WHERE ca.id = NEW.agent_id;
  END IF;

  -- 3. Para cálculos a nivel de póliza individual:
  -- commission_neta = commission_bruta (los impuestos se aplican a nivel de lote)
  -- Esto es correcto porque las retenciones ISR/IVA se calculan sobre totales agregados
  IF NEW.commission_bruta IS NOT NULL THEN
    NEW.commission_neta := NEW.commission_bruta;
  ELSE
    NEW.commission_neta := NULL;
  END IF;

  -- 4. Guardar metadata del régimen en impuestos_json
  IF v_regime_name IS NOT NULL THEN
    -- Normalizar el ramo
    v_ramo_lower := LOWER(COALESCE(NEW.ramo, ''));
    
    -- Guardar información básica del régimen
    NEW.impuestos_json := jsonb_build_object(
      'regimen_fiscal', v_regime_name,
      'ramo', NEW.ramo,
      'es_vida', (v_ramo_lower = 'vida'),
      'nota', 'Retenciones fiscales se calculan a nivel de lote completo'
    );
  ELSE
    NEW.impuestos_json := jsonb_build_object(
      'regimen_fiscal', 'NO_DEFINIDO',
      'nota', 'Agente sin régimen fiscal asignado'
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear trigger BEFORE INSERT/UPDATE
DROP TRIGGER IF EXISTS trigger_calculate_commission_bruta ON commission_details;
DROP TRIGGER IF EXISTS trigger_calculate_commission_with_fiscal ON commission_details;

CREATE TRIGGER trigger_calculate_commission_with_fiscal
  BEFORE INSERT OR UPDATE ON commission_details
  FOR EACH ROW
  EXECUTE FUNCTION calculate_commission_with_fiscal_trigger();

-- Backfill: Recalcular todas las comisiones existentes
UPDATE commission_details cd
SET 
  commission_bruta = ROUND((cd.importe_base * cd.porcentaje_comision / 100)::numeric, 2),
  commission_neta = ROUND((cd.importe_base * cd.porcentaje_comision / 100)::numeric, 2),
  impuestos_json = jsonb_build_object(
    'regimen_fiscal', COALESCE(cfr.name, 'NO_DEFINIDO'),
    'ramo', cd.ramo,
    'es_vida', (LOWER(COALESCE(cd.ramo, '')) = 'vida'),
    'nota', 'Retenciones fiscales se calculan a nivel de lote completo'
  )
FROM commission_agents ca
LEFT JOIN commission_fiscal_regimes cfr ON ca.fiscal_regime_id = cfr.id
WHERE cd.agent_id = ca.id
  AND cd.importe_base IS NOT NULL
  AND cd.porcentaje_comision IS NOT NULL;

-- Crear función helper para obtener el régimen de un agente (útil para queries)
CREATE OR REPLACE FUNCTION get_agent_fiscal_regime_name(p_agent_id uuid)
RETURNS text AS $$
DECLARE
  v_regime_name text;
BEGIN
  SELECT cfr.name INTO v_regime_name
  FROM commission_agents ca
  LEFT JOIN commission_fiscal_regimes cfr ON ca.fiscal_regime_id = cfr.id
  WHERE ca.id = p_agent_id;
  
  RETURN COALESCE(v_regime_name, 'HONORARIOS');
END;
$$ LANGUAGE plpgsql STABLE;
