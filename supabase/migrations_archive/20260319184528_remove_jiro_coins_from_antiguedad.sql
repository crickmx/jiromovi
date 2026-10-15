/*
  # Remover Jiro Coins del Sistema de Antigüedad

  1. Cambios
    - Actualizar bonos de antigüedad para solo otorgar XP (no JC)
    - Mantener el multiplicador veterano
    - Las JC quedan en 0 para el sistema de antigüedad
*/

-- =====================================================
-- Eliminar función existente
-- =====================================================

DROP FUNCTION IF EXISTS fn_aplicar_bonos_antiguedad_masivo();

-- =====================================================
-- Actualizar función de bono de antigüedad (solo XP)
-- =====================================================

CREATE OR REPLACE FUNCTION fn_aplicar_bono_antiguedad(p_user_id UUID)
RETURNS VOID AS $$
DECLARE
  v_perfil agent_gamification_profile;
  v_anios_nuevos NUMERIC;
  v_xp_bono INTEGER;
  v_nuevo_multiplicador NUMERIC;
BEGIN
  SELECT * INTO v_perfil
  FROM agent_gamification_profile
  WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  v_anios_nuevos := fn_calcular_anios_antiguedad(v_perfil.fecha_ingreso_empresa);

  IF v_anios_nuevos >= (v_perfil.anios_antiguedad + 1.0) THEN
    -- Solo XP: 100 puntos por año
    v_xp_bono := 100 * FLOOR(v_anios_nuevos - v_perfil.anios_antiguedad);
    v_nuevo_multiplicador := fn_calcular_multiplicador_veterano(v_anios_nuevos);

    PERFORM fn_registrar_evento_gamificacion(
      p_user_id := p_user_id,
      p_tipo_evento := 'bono_antiguedad'::gamification_event_type,
      p_xp_delta := v_xp_bono,
      p_jc_delta := 0,
      p_reversible := false,
      p_metadata := jsonb_build_object(
        'anios_cumplidos', FLOOR(v_anios_nuevos - v_perfil.anios_antiguedad),
        'anios_totales', v_anios_nuevos,
        'multiplicador_veterano', v_nuevo_multiplicador
      )
    );

    UPDATE agent_gamification_profile
    SET anios_antiguedad = v_anios_nuevos,
        multiplicador_veterano = v_nuevo_multiplicador,
        updated_at = now()
    WHERE user_id = p_user_id;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Crear función masiva (solo XP)
-- =====================================================

CREATE FUNCTION fn_aplicar_bonos_antiguedad_masivo()
RETURNS TABLE(user_id UUID, nombre_completo TEXT, anios_antiguedad NUMERIC, xp_otorgado INTEGER) AS $$
DECLARE
  v_agente RECORD;
BEGIN
  FOR v_agente IN
    SELECT agp.user_id, u.nombre_completo, agp.anios_antiguedad AS anios_previos,
           fn_calcular_anios_antiguedad(agp.fecha_ingreso_empresa) AS anios_actuales
    FROM agent_gamification_profile agp
    JOIN public.usuarios u ON u.id = agp.user_id
    WHERE u.rol = 'Agente' AND LOWER(u.estado) = 'activo' AND u.deleted_at IS NULL
      AND fn_calcular_anios_antiguedad(agp.fecha_ingreso_empresa) >= (agp.anios_antiguedad + 1.0)
  LOOP
    PERFORM fn_aplicar_bono_antiguedad(v_agente.user_id);
    user_id := v_agente.user_id;
    nombre_completo := v_agente.nombre_completo;
    anios_antiguedad := v_agente.anios_actuales;
    xp_otorgado := (100 * FLOOR(v_agente.anios_actuales - v_agente.anios_previos))::INTEGER;
    RETURN NEXT;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Reinicializar bonos de antigüedad (solo XP)
-- =====================================================

DELETE FROM agent_gamification_events WHERE tipo_evento = 'bono_antiguedad';

UPDATE agent_gamification_profile
SET jiro_coins_balance = 0, updated_at = now()
WHERE xp_total > 0;

DO $$
DECLARE
  v_agente RECORD;
BEGIN
  FOR v_agente IN
    SELECT user_id, xp_total, anios_antiguedad, multiplicador_veterano
    FROM agent_gamification_profile
    WHERE xp_total > 0
  LOOP
    PERFORM fn_registrar_evento_gamificacion(
      p_user_id := v_agente.user_id,
      p_tipo_evento := 'bono_antiguedad'::gamification_event_type,
      p_xp_delta := v_agente.xp_total,
      p_jc_delta := 0,
      p_reversible := false,
      p_metadata := jsonb_build_object(
        'tipo', 'bono_inicial',
        'anios_antiguedad', v_agente.anios_antiguedad,
        'multiplicador_veterano', v_agente.multiplicador_veterano,
        'descripcion', 'Bono inicial por antigüedad (solo XP)'
      )
    );
  END LOOP;
END $$;
