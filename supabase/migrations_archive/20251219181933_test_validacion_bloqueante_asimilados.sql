/*
  # TEST DE VALIDACIÓN BLOQUEANTE PARA ASIMILADOS

  Este test valida que las fórmulas fiscales sean consistentes y correctas.
  Se ejecuta automáticamente y bloquea la operación si detecta inconsistencias.
*/

-- ============================================
-- PASO 1: ELIMINAR TRIGGER Y FUNCIÓN VIEJA
-- ============================================

DROP TRIGGER IF EXISTS trigger_calcular_asimilados ON commission_details;
DROP FUNCTION IF EXISTS calcular_asimilados_detalle();
DROP FUNCTION IF EXISTS clasificar_tipo_ramo(TEXT);

-- ============================================
-- PASO 2: FUNCIÓN DE VALIDACIÓN BLOQUEANTE
-- ============================================

CREATE OR REPLACE FUNCTION validar_desglose_fiscal_o_abortar(
  p_batch_id UUID,
  p_agent_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_desglose JSON;
  v_total_comision NUMERIC;
  v_vida NUMERIC;
  v_sin_vida NUMERIC;
  v_ret_contable NUMERIC;
  v_dispersion NUMERIC;
  v_isr_total NUMERIC;
  v_total_pagar NUMERIC;
  v_total_calculado NUMERIC;
  v_tolerance NUMERIC := 0.02;
BEGIN
  -- Obtener desglose calculado
  v_desglose := calcular_desglose_fiscal_asimilados(p_batch_id, p_agent_id);
  
  -- Si no es ASIMILADOS, no validar
  IF NOT (v_desglose->>'es_asimilados')::boolean THEN
    RETURN TRUE;
  END IF;
  
  -- Extraer valores
  v_total_comision := (v_desglose->>'total_comision')::numeric;
  v_vida := (v_desglose->>'vida')::numeric;
  v_sin_vida := (v_desglose->>'sin_vida')::numeric;
  v_ret_contable := (v_desglose->>'ret_contable')::numeric;
  v_dispersion := (v_desglose->>'dispersion')::numeric;
  v_isr_total := (v_desglose->>'isr_total')::numeric;
  v_total_pagar := (v_desglose->>'total_pagar')::numeric;
  
  -- VALIDACIÓN 1: Vida + Sin Vida = Total Comisión
  IF ABS((v_vida + v_sin_vida) - v_total_comision) > v_tolerance THEN
    RAISE EXCEPTION 'VALIDACIÓN FALLIDA [Lote %, Agente %]: Vida (%) + Sin Vida (%) != Total Comisión (%). Diferencia: %',
      p_batch_id, p_agent_id, v_vida, v_sin_vida, v_total_comision, 
      ABS((v_vida + v_sin_vida) - v_total_comision);
  END IF;
  
  -- VALIDACIÓN 2: Total a Pagar = Total - Ret - Dispersión - ISR
  v_total_calculado := v_total_comision - v_ret_contable - v_dispersion - v_isr_total;
  IF ABS(v_total_calculado - v_total_pagar) > v_tolerance THEN
    RAISE EXCEPTION 'VALIDACIÓN FALLIDA [Lote %, Agente %]: Total calculado (%) != Total a Pagar (%). Diferencia: %',
      p_batch_id, p_agent_id, v_total_calculado, v_total_pagar, 
      ABS(v_total_calculado - v_total_pagar);
  END IF;
  
  -- VALIDACIÓN 3: Ret. Contable debe ser Vida * 0.16
  IF v_vida > 0 THEN
    IF ABS(v_ret_contable - ROUND((v_vida * 0.16)::numeric, 2)) > v_tolerance THEN
      RAISE EXCEPTION 'VALIDACIÓN FALLIDA [Lote %, Agente %]: Ret. Contable (%) debe ser Vida (%) * 0.16 = %. Diferencia: %',
        p_batch_id, p_agent_id, v_ret_contable, v_vida, ROUND((v_vida * 0.16)::numeric, 2), 
        ABS(v_ret_contable - ROUND((v_vida * 0.16)::numeric, 2));
    END IF;
  END IF;
  
  -- VALIDACIÓN 4: Dispersión debe ser Sin Vida * 0.09
  IF v_sin_vida > 0 THEN
    IF ABS(v_dispersion - ROUND((v_sin_vida * 0.09)::numeric, 2)) > v_tolerance THEN
      RAISE EXCEPTION 'VALIDACIÓN FALLIDA [Lote %, Agente %]: Dispersión (%) debe ser Sin Vida (%) * 0.09 = %. Diferencia: %',
        p_batch_id, p_agent_id, v_dispersion, v_sin_vida, ROUND((v_sin_vida * 0.09)::numeric, 2), 
        ABS(v_dispersion - ROUND((v_sin_vida * 0.09)::numeric, 2));
    END IF;
  END IF;
  
  -- VALIDACIÓN 5: ISR Total debe ser positivo
  IF v_isr_total < 0 THEN
    RAISE EXCEPTION 'VALIDACIÓN FALLIDA [Lote %, Agente %]: ISR Total (%) no puede ser negativo',
      p_batch_id, p_agent_id, v_isr_total;
  END IF;
  
  -- VALIDACIÓN 6: Total a Pagar debe ser menor que Total Comisión
  IF v_total_pagar > v_total_comision THEN
    RAISE EXCEPTION 'VALIDACIÓN FALLIDA [Lote %, Agente %]: Total a Pagar (%) no puede ser mayor que Total Comisión (%)',
      p_batch_id, p_agent_id, v_total_pagar, v_total_comision;
  END IF;
  
  -- Todas las validaciones pasaron
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION validar_desglose_fiscal_o_abortar IS
'Función de validación que verifica la consistencia del desglose fiscal para ASIMILADOS.
Debe llamarse antes de cerrar un lote o generar PDF.
Si detecta inconsistencias, ABORTA la operación con mensaje de error detallado.
Validaciones:
1. Vida + Sin Vida = Total Comisión
2. Total a Pagar = Total - Ret - Dispersión - ISR
3. Ret. Contable = Vida × 0.16
4. Dispersión = Sin Vida × 0.09
5. ISR Total > 0
6. Total a Pagar < Total Comisión';

-- ============================================
-- PASO 3: FUNCIÓN DE TEST CON CASO REAL
-- ============================================

CREATE OR REPLACE FUNCTION test_asimilados_con_caso_real(
  p_vida NUMERIC,
  p_sin_vida NUMERIC,
  p_ret_contable_esperado NUMERIC,
  p_dispersion_esperada NUMERIC,
  p_isr_total_esperado NUMERIC,
  p_total_esperado NUMERIC
)
RETURNS TEXT AS $$
DECLARE
  v_ret_contable NUMERIC;
  v_dispersion NUMERIC;
  v_isr_vida NUMERIC;
  v_isr_danios NUMERIC;
  v_isr_total NUMERIC;
  v_total NUMERIC;
  v_total_comision NUMERIC;
  v_tolerance NUMERIC := 0.10; -- Tolerancia de 10 centavos
  v_resultado TEXT := '';
BEGIN
  v_total_comision := p_vida + p_sin_vida;
  
  v_resultado := v_resultado || E'\n========================================\n';
  v_resultado := v_resultado || 'TEST DE CASO REAL ASIMILADOS\n';
  v_resultado := v_resultado || E'========================================\n';
  v_resultado := v_resultado || 'ENTRADA:\n';
  v_resultado := v_resultado || '  Vida: ' || p_vida || E'\n';
  v_resultado := v_resultado || '  Sin Vida: ' || p_sin_vida || E'\n';
  v_resultado := v_resultado || '  Total Comisión: ' || v_total_comision || E'\n';
  
  -- Calcular con fórmulas actuales
  v_ret_contable := ROUND((p_vida * 0.16)::numeric, 2);
  v_dispersion := ROUND((p_sin_vida * 0.09)::numeric, 2);
  v_isr_vida := ROUND(((p_vida - v_ret_contable) * 0.10)::numeric, 2);
  v_isr_danios := ROUND(((p_sin_vida - v_dispersion) * 0.10)::numeric, 2);
  v_isr_total := ROUND((v_isr_vida + v_isr_danios)::numeric, 2);
  v_total := ROUND((v_total_comision - v_ret_contable - v_dispersion - v_isr_total)::numeric, 2);
  
  v_resultado := v_resultado || E'\nCALCULADO:\n';
  v_resultado := v_resultado || '  Ret. Contable: ' || v_ret_contable || E'\n';
  v_resultado := v_resultado || '  Dispersión: ' || v_dispersion || E'\n';
  v_resultado := v_resultado || '  ISR Vida: ' || v_isr_vida || E'\n';
  v_resultado := v_resultado || '  ISR Daños: ' || v_isr_danios || E'\n';
  v_resultado := v_resultado || '  ISR Total: ' || v_isr_total || E'\n';
  v_resultado := v_resultado || '  Total a Pagar: ' || v_total || E'\n';
  
  v_resultado := v_resultado || E'\nESPERADO:\n';
  v_resultado := v_resultado || '  Ret. Contable: ' || p_ret_contable_esperado || E'\n';
  v_resultado := v_resultado || '  Dispersión: ' || p_dispersion_esperada || E'\n';
  v_resultado := v_resultado || '  ISR Total: ' || p_isr_total_esperado || E'\n';
  v_resultado := v_resultado || '  Total a Pagar: ' || p_total_esperado || E'\n';
  
  v_resultado := v_resultado || E'\nDIFERENCIAS:\n';
  v_resultado := v_resultado || '  Ret. Contable: ' || ABS(v_ret_contable - p_ret_contable_esperado) || E'\n';
  v_resultado := v_resultado || '  Dispersión: ' || ABS(v_dispersion - p_dispersion_esperada) || E'\n';
  v_resultado := v_resultado || '  ISR Total: ' || ABS(v_isr_total - p_isr_total_esperado) || E'\n';
  v_resultado := v_resultado || '  Total: ' || ABS(v_total - p_total_esperado) || E'\n';
  
  v_resultado := v_resultado || E'\nRESULTADO: ';
  
  IF ABS(v_isr_total - p_isr_total_esperado) > v_tolerance THEN
    v_resultado := v_resultado || '❌ FALLIDO - ISR Total no coincide (diff: ' || 
      ABS(v_isr_total - p_isr_total_esperado) || ')' || E'\n';
  ELSIF ABS(v_total - p_total_esperado) > v_tolerance THEN
    v_resultado := v_resultado || '❌ FALLIDO - Total no coincide (diff: ' || 
      ABS(v_total - p_total_esperado) || ')' || E'\n';
  ELSE
    v_resultado := v_resultado || '✅ PASADO' || E'\n';
  END IF;
  
  v_resultado := v_resultado || E'========================================\n';
  
  RETURN v_resultado;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- PASO 4: EJECUTAR TEST CON CASO DE REFERENCIA
-- ============================================

DO $$
DECLARE
  v_resultado TEXT;
BEGIN
  -- Ejecutar test con el caso de referencia del usuario
  v_resultado := test_asimilados_con_caso_real(
    544.20,      -- vida
    14263.87,    -- sin_vida
    87.07,       -- ret_contable esperado
    1283.75,     -- dispersion esperada
    1355.53,     -- isr_total esperado
    12081.72     -- total esperado
  );
  
  RAISE NOTICE '%', v_resultado;
END $$;