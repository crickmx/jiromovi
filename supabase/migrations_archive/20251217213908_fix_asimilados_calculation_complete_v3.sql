/*
  # Corrección Completa del Cálculo Fiscal ASIMILADOS

  1. Nuevas Columnas en commission_details
    - tipo_ramo: Clasificación automática VIDA o DAÑOS
    - costo_dispersion: Costo de dispersión bancaria
    - asimilados_retencion_contable: Retención contable 16% sobre importe
    - asimilados_base_vida: Base para cálculo de vida (importe - retención)
    - asimilados_comision_vida: Comisión vida 10% sobre base vida
    - asimilados_base_danios_pre: Base preliminar daños (importe - dispersión)
    - asimilados_base_danios_sin_iva: Base sin IVA (preliminar / 1.09)
    - asimilados_comision_danios: Comisión daños 10% sobre base sin IVA
    - asimilados_isr_vida: ISR vida = comisión vida
    - asimilados_isr_danios: ISR daños = comisión daños
    - asimilados_isr_total: ISR total = ISR vida + ISR daños
    - asimilados_comision_final: Prima total - retención - dispersión - ISR total

  2. Función de Clasificación
    - clasificar_tipo_ramo(): Clasifica ramos como VIDA o DAÑOS

  3. Trigger de Cálculo Automático
    - calcular_asimilados_detalle(): Función trigger
    - trigger_calcular_asimilados: BEFORE INSERT/UPDATE

  4. Backfill
    - Reclasifica ramos existentes
    - Trigger recalculará automáticamente
*/

-- ============================================
-- AGREGAR COLUMNAS A COMMISSION_DETAILS
-- ============================================

DO $$
BEGIN
  -- tipo_ramo
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'commission_details' AND column_name = 'tipo_ramo'
  ) THEN
    ALTER TABLE commission_details ADD COLUMN tipo_ramo TEXT CHECK (tipo_ramo IN ('VIDA', 'DAÑOS'));
  END IF;

  -- costo_dispersion
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'commission_details' AND column_name = 'costo_dispersion'
  ) THEN
    ALTER TABLE commission_details ADD COLUMN costo_dispersion NUMERIC(12,2) DEFAULT 0;
  END IF;

  -- asimilados_retencion_contable
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'commission_details' AND column_name = 'asimilados_retencion_contable'
  ) THEN
    ALTER TABLE commission_details ADD COLUMN asimilados_retencion_contable NUMERIC(12,2);
  END IF;

  -- asimilados_base_vida
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'commission_details' AND column_name = 'asimilados_base_vida'
  ) THEN
    ALTER TABLE commission_details ADD COLUMN asimilados_base_vida NUMERIC(12,2);
  END IF;

  -- asimilados_comision_vida
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'commission_details' AND column_name = 'asimilados_comision_vida'
  ) THEN
    ALTER TABLE commission_details ADD COLUMN asimilados_comision_vida NUMERIC(12,2);
  END IF;

  -- asimilados_base_danios_pre
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'commission_details' AND column_name = 'asimilados_base_danios_pre'
  ) THEN
    ALTER TABLE commission_details ADD COLUMN asimilados_base_danios_pre NUMERIC(12,2);
  END IF;

  -- asimilados_base_danios_sin_iva
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'commission_details' AND column_name = 'asimilados_base_danios_sin_iva'
  ) THEN
    ALTER TABLE commission_details ADD COLUMN asimilados_base_danios_sin_iva NUMERIC(12,2);
  END IF;

  -- asimilados_comision_danios
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'commission_details' AND column_name = 'asimilados_comision_danios'
  ) THEN
    ALTER TABLE commission_details ADD COLUMN asimilados_comision_danios NUMERIC(12,2);
  END IF;

  -- asimilados_isr_vida
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'commission_details' AND column_name = 'asimilados_isr_vida'
  ) THEN
    ALTER TABLE commission_details ADD COLUMN asimilados_isr_vida NUMERIC(12,2);
  END IF;

  -- asimilados_isr_danios
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'commission_details' AND column_name = 'asimilados_isr_danios'
  ) THEN
    ALTER TABLE commission_details ADD COLUMN asimilados_isr_danios NUMERIC(12,2);
  END IF;

  -- asimilados_isr_total
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'commission_details' AND column_name = 'asimilados_isr_total'
  ) THEN
    ALTER TABLE commission_details ADD COLUMN asimilados_isr_total NUMERIC(12,2);
  END IF;

  -- asimilados_comision_final
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'commission_details' AND column_name = 'asimilados_comision_final'
  ) THEN
    ALTER TABLE commission_details ADD COLUMN asimilados_comision_final NUMERIC(12,2);
  END IF;
END $$;

-- ============================================
-- FUNCIÓN DE CLASIFICACIÓN DE RAMOS
-- ============================================

CREATE OR REPLACE FUNCTION clasificar_tipo_ramo(ramo_name TEXT)
RETURNS TEXT AS $$
BEGIN
  IF ramo_name IS NULL OR TRIM(ramo_name) = '' THEN
    RETURN 'DAÑOS';
  END IF;

  -- Si contiene "vida" (case insensitive), es VIDA
  IF LOWER(TRIM(ramo_name)) LIKE '%vida%' THEN
    RETURN 'VIDA';
  END IF;

  -- Por defecto, es DAÑOS
  RETURN 'DAÑOS';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================
-- FUNCIÓN TRIGGER PARA CÁLCULO ASIMILADOS
-- ============================================

CREATE OR REPLACE FUNCTION calcular_asimilados_detalle()
RETURNS TRIGGER AS $$
DECLARE
  agent_regime_name TEXT;
  prima_total NUMERIC;
  dispersion NUMERIC;
  retencion_contable NUMERIC;
  base_vida NUMERIC;
  comision_vida NUMERIC;
  base_danios_pre NUMERIC;
  base_danios_sin_iva NUMERIC;
  comision_danios NUMERIC;
  isr_vida NUMERIC;
  isr_danios NUMERIC;
  isr_total NUMERIC;
  comision_final NUMERIC;
BEGIN
  -- Obtener régimen fiscal del agente
  SELECT UPPER(cfr.name)
  INTO agent_regime_name
  FROM commission_agents ca
  LEFT JOIN usuarios u ON ca.usuario_id = u.id
  LEFT JOIN commission_fiscal_regimes cfr ON u.regimen_fiscal_id = cfr.id
  WHERE ca.id = NEW.agent_id;

  -- Si no es ASIMILADOS, no hacer nada
  IF agent_regime_name IS NULL OR agent_regime_name NOT LIKE '%ASIMILAD%' THEN
    RETURN NEW;
  END IF;

  -- Clasificar tipo de ramo
  NEW.tipo_ramo := clasificar_tipo_ramo(NEW.ramo);

  -- Obtener valores base
  prima_total := COALESCE(NEW.importe_base, 0);
  dispersion := COALESCE(NEW.costo_dispersion, 0);

  -- Inicializar variables
  retencion_contable := 0;
  base_vida := 0;
  comision_vida := 0;
  base_danios_pre := 0;
  base_danios_sin_iva := 0;
  comision_danios := 0;
  isr_vida := 0;
  isr_danios := 0;

  -- CÁLCULO PARA VIDA
  IF NEW.tipo_ramo = 'VIDA' THEN
    -- Retención Contable = Prima Total × 16%
    retencion_contable := ROUND((prima_total * 0.16)::numeric, 2);
    
    -- Base Vida = Prima Total - Retención Contable
    base_vida := ROUND((prima_total - retencion_contable)::numeric, 2);
    
    -- Comisión Vida = Base Vida × 10%
    comision_vida := ROUND((base_vida * 0.10)::numeric, 2);
    
    -- ISR Vida = Comisión Vida
    isr_vida := comision_vida;
  END IF;

  -- CÁLCULO PARA DAÑOS
  IF NEW.tipo_ramo = 'DAÑOS' THEN
    -- Base Preliminar Daños = Prima Total - Dispersión
    base_danios_pre := ROUND((prima_total - dispersion)::numeric, 2);
    
    -- Base Sin IVA = Base Preliminar / 1.09
    base_danios_sin_iva := ROUND((base_danios_pre / 1.09)::numeric, 2);
    
    -- Comisión Daños = Base Sin IVA × 10%
    comision_danios := ROUND((base_danios_sin_iva * 0.10)::numeric, 2);
    
    -- ISR Daños = Comisión Daños
    isr_danios := comision_danios;
  END IF;

  -- CÁLCULO TOTAL
  -- ISR Total = ISR Vida + ISR Daños
  isr_total := ROUND((isr_vida + isr_danios)::numeric, 2);
  
  -- Comisión Final = Prima Total - Retención Contable - Dispersión - ISR Total
  comision_final := ROUND((prima_total - retencion_contable - dispersion - isr_total)::numeric, 2);

  -- Asignar valores calculados a NEW
  NEW.asimilados_retencion_contable := retencion_contable;
  NEW.asimilados_base_vida := base_vida;
  NEW.asimilados_comision_vida := comision_vida;
  NEW.asimilados_base_danios_pre := base_danios_pre;
  NEW.asimilados_base_danios_sin_iva := base_danios_sin_iva;
  NEW.asimilados_comision_danios := comision_danios;
  NEW.asimilados_isr_vida := isr_vida;
  NEW.asimilados_isr_danios := isr_danios;
  NEW.asimilados_isr_total := isr_total;
  NEW.asimilados_comision_final := comision_final;

  -- Actualizar commission_neta con el valor final
  NEW.commission_neta := comision_final;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- CREAR TRIGGER
-- ============================================

DROP TRIGGER IF EXISTS trigger_calcular_asimilados ON commission_details;

CREATE TRIGGER trigger_calcular_asimilados
  BEFORE INSERT OR UPDATE ON commission_details
  FOR EACH ROW
  EXECUTE FUNCTION calcular_asimilados_detalle();

-- ============================================
-- BACKFILL: Reclasificar ramos existentes
-- ============================================

-- Solo clasificar el tipo de ramo, el trigger se encargará del resto
UPDATE commission_details cd
SET tipo_ramo = clasificar_tipo_ramo(cd.ramo)
WHERE EXISTS (
  SELECT 1 FROM commission_agents ca
  LEFT JOIN usuarios u ON ca.usuario_id = u.id
  LEFT JOIN commission_fiscal_regimes cfr ON u.regimen_fiscal_id = cfr.id
  WHERE ca.id = cd.agent_id AND UPPER(cfr.name) LIKE '%ASIMILAD%'
);

-- Forzar recálculo actualizando un campo dummy (el trigger recalculará todo)
UPDATE commission_details cd
SET costo_dispersion = COALESCE(cd.costo_dispersion, 0)
WHERE EXISTS (
  SELECT 1 FROM commission_agents ca
  LEFT JOIN usuarios u ON ca.usuario_id = u.id
  LEFT JOIN commission_fiscal_regimes cfr ON u.regimen_fiscal_id = cfr.id
  WHERE ca.id = cd.agent_id AND UPPER(cfr.name) LIKE '%ASIMILAD%'
);
