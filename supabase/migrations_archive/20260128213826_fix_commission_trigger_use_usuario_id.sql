/*
  # Fix Commission Trigger to Use usuario_id

  1. Problema
    - El trigger calculate_commission_with_fiscal_trigger() usa agent_id (eliminada)
    - Las funciones helper usan commission_agents (tabla eliminada)
    - Causa error al recalcular lotes: "column agent_id does not exist"

  2. Solución
    - Actualizar trigger para usar usuario_id
    - Buscar régimen fiscal en usuarios.regimen_fiscal_id
    - Eliminar funciones obsoletas que usan commission_agents

  3. Cambios
    - Trigger usa usuario_id en lugar de agent_id
    - Consulta usuarios en lugar de commission_agents
    - Funciones helper actualizadas
*/

-- =============================================
-- PASO 1: Actualizar función del trigger
-- =============================================

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

  -- 2. Obtener régimen fiscal del usuario
  IF NEW.usuario_id IS NOT NULL THEN
    SELECT cfr.name INTO v_regime_name
    FROM usuarios u
    LEFT JOIN commission_fiscal_regimes cfr ON u.regimen_fiscal_id = cfr.id
    WHERE u.id = NEW.usuario_id;
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
      'nota', 'Usuario sin régimen fiscal asignado'
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- PASO 2: Eliminar funciones obsoletas
-- =============================================

DROP FUNCTION IF EXISTS get_agent_fiscal_regime_name(uuid);

-- =============================================
-- PASO 3: Crear función helper actualizada
-- =============================================

CREATE OR REPLACE FUNCTION get_usuario_fiscal_regime_name(p_usuario_id uuid)
RETURNS text AS $$
DECLARE
  v_regime_name text;
BEGIN
  SELECT cfr.name INTO v_regime_name
  FROM usuarios u
  LEFT JOIN commission_fiscal_regimes cfr ON u.regimen_fiscal_id = cfr.id
  WHERE u.id = p_usuario_id;

  RETURN COALESCE(v_regime_name, 'HONORARIOS');
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_usuario_fiscal_regime_name IS 'Obtiene el nombre del régimen fiscal de un usuario';

-- =============================================
-- PASO 4: Backfill - Recalcular comisiones existentes
-- =============================================

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
FROM usuarios u
LEFT JOIN commission_fiscal_regimes cfr ON u.regimen_fiscal_id = cfr.id
WHERE cd.usuario_id = u.id
  AND cd.importe_base IS NOT NULL
  AND cd.porcentaje_comision IS NOT NULL;

-- =============================================
-- PASO 5: Verificación
-- =============================================

DO $$
DECLARE
  comisiones_sin_usuario INTEGER;
  comisiones_sin_regime INTEGER;
BEGIN
  -- Contar comisiones sin usuario
  SELECT COUNT(*) INTO comisiones_sin_usuario
  FROM commission_details
  WHERE usuario_id IS NULL;

  IF comisiones_sin_usuario > 0 THEN
    RAISE WARNING 'Existen % comisiones sin usuario asignado', comisiones_sin_usuario;
  END IF;

  -- Contar usuarios sin régimen fiscal
  SELECT COUNT(DISTINCT cd.usuario_id) INTO comisiones_sin_regime
  FROM commission_details cd
  INNER JOIN usuarios u ON u.id = cd.usuario_id
  WHERE u.regimen_fiscal_id IS NULL;

  IF comisiones_sin_regime > 0 THEN
    RAISE WARNING 'Existen % usuarios con comisiones que no tienen régimen fiscal asignado', comisiones_sin_regime;
  END IF;

  RAISE NOTICE '✅ Trigger actualizado para usar usuario_id - Comisiones sin usuario: %, Usuarios sin régimen: %',
    comisiones_sin_usuario, comisiones_sin_regime;
END $$;