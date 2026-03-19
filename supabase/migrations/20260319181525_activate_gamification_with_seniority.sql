/*
  # Activar Sistema de Gamificación con Bonos de Antigüedad

  1. Crear perfiles para todos los agentes activos con XP por antigüedad
  2. Funciones para aplicar bonos anuales automáticamente
  3. Trigger para actualizar antigüedad cuando cambia fecha_ingreso
*/

-- =====================================================
-- FUNCIÓN: Calcular años de antigüedad
-- =====================================================

CREATE OR REPLACE FUNCTION fn_calcular_anios_antiguedad(fecha_ingreso DATE)
RETURNS NUMERIC AS $$
BEGIN
  RETURN ROUND((CURRENT_DATE - fecha_ingreso)::NUMERIC / 365.25, 2);
END;
$$ LANGUAGE plpgsql STABLE;

-- =====================================================
-- FUNCIÓN: Aplicar bono de antigüedad a un agente
-- =====================================================

CREATE OR REPLACE FUNCTION fn_aplicar_bono_antiguedad(p_user_id UUID)
RETURNS VOID AS $$
DECLARE
  v_perfil agent_gamification_profile;
  v_anios_nuevos NUMERIC;
  v_xp_bono INTEGER;
  v_jc_bono INTEGER;
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
    v_xp_bono := 100 * FLOOR(v_anios_nuevos - v_perfil.anios_antiguedad);
    v_jc_bono := 50 * FLOOR(v_anios_nuevos - v_perfil.anios_antiguedad);
    v_nuevo_multiplicador := fn_calcular_multiplicador_veterano(v_anios_nuevos);

    PERFORM fn_registrar_evento_gamificacion(
      p_user_id := p_user_id,
      p_tipo_evento := 'bono_antiguedad'::gamification_event_type,
      p_xp_delta := v_xp_bono,
      p_jc_delta := v_jc_bono,
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
-- FUNCIÓN: Aplicar bonos masivo (para cron)
-- =====================================================

CREATE OR REPLACE FUNCTION fn_aplicar_bonos_antiguedad_masivo()
RETURNS TABLE(user_id UUID, nombre_completo TEXT, anios_antiguedad NUMERIC, xp_otorgado INTEGER, jc_otorgado INTEGER) AS $$
DECLARE
  v_agente RECORD;
BEGIN
  FOR v_agente IN
    SELECT agp.user_id, u.nombre_completo, agp.anios_antiguedad AS anios_previos,
           fn_calcular_anios_antiguedad(agp.fecha_ingreso_empresa) AS anios_actuales
    FROM agent_gamification_profile agp
    JOIN public.usuarios u ON u.id = agp.user_id
    WHERE u.rol = 'Agente' AND u.deleted_at IS NULL
      AND fn_calcular_anios_antiguedad(agp.fecha_ingreso_empresa) >= (agp.anios_antiguedad + 1.0)
  LOOP
    PERFORM fn_aplicar_bono_antiguedad(v_agente.user_id);
    user_id := v_agente.user_id;
    nombre_completo := v_agente.nombre_completo;
    anios_antiguedad := v_agente.anios_actuales;
    xp_otorgado := (100 * FLOOR(v_agente.anios_actuales - v_agente.anios_previos))::INTEGER;
    jc_otorgado := (50 * FLOOR(v_agente.anios_actuales - v_agente.anios_previos))::INTEGER;
    RETURN NEXT;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- TRIGGER: Actualizar antigüedad
-- =====================================================

CREATE OR REPLACE FUNCTION trigger_actualizar_antiguedad()
RETURNS TRIGGER AS $$
BEGIN
  NEW.anios_antiguedad := fn_calcular_anios_antiguedad(NEW.fecha_ingreso_empresa);
  NEW.multiplicador_veterano := fn_calcular_multiplicador_veterano(NEW.anios_antiguedad);
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS before_update_gamification_profile_antiguedad ON agent_gamification_profile;
CREATE TRIGGER before_update_gamification_profile_antiguedad
  BEFORE UPDATE ON agent_gamification_profile
  FOR EACH ROW
  WHEN (OLD.fecha_ingreso_empresa IS DISTINCT FROM NEW.fecha_ingreso_empresa)
  EXECUTE FUNCTION trigger_actualizar_antiguedad();

-- =====================================================
-- CREAR PERFILES PARA TODOS LOS AGENTES
-- =====================================================

INSERT INTO agent_gamification_profile (user_id, fecha_ingreso_empresa, anios_antiguedad, multiplicador_veterano, xp_total, jiro_coins_balance)
SELECT
  u.id,
  COALESCE(u.fecha_ingreso, u.created_at::DATE, CURRENT_DATE) AS fecha_ingreso,
  fn_calcular_anios_antiguedad(COALESCE(u.fecha_ingreso, u.created_at::DATE, CURRENT_DATE)) AS anios,
  fn_calcular_multiplicador_veterano(fn_calcular_anios_antiguedad(COALESCE(u.fecha_ingreso, u.created_at::DATE, CURRENT_DATE))) AS multiplicador,
  (100 * FLOOR(fn_calcular_anios_antiguedad(COALESCE(u.fecha_ingreso, u.created_at::DATE, CURRENT_DATE))))::INTEGER AS xp_inicial,
  (50 * FLOOR(fn_calcular_anios_antiguedad(COALESCE(u.fecha_ingreso, u.created_at::DATE, CURRENT_DATE))))::INTEGER AS jc_inicial
FROM public.usuarios u
WHERE u.rol = 'Agente' AND u.deleted_at IS NULL
  AND NOT EXISTS (SELECT 1 FROM agent_gamification_profile agp WHERE agp.user_id = u.id)
ON CONFLICT (user_id) DO UPDATE SET
  fecha_ingreso_empresa = EXCLUDED.fecha_ingreso_empresa,
  anios_antiguedad = EXCLUDED.anios_antiguedad,
  multiplicador_veterano = EXCLUDED.multiplicador_veterano,
  xp_total = agent_gamification_profile.xp_total + EXCLUDED.xp_total,
  jiro_coins_balance = agent_gamification_profile.jiro_coins_balance + EXCLUDED.jiro_coins_balance,
  updated_at = now();

-- =====================================================
-- REGISTRAR EVENTOS USANDO LA FUNCIÓN OFICIAL
-- =====================================================

DO $$
DECLARE
  v_agente RECORD;
BEGIN
  FOR v_agente IN
    SELECT user_id, xp_total, jiro_coins_balance, anios_antiguedad, multiplicador_veterano
    FROM agent_gamification_profile
    WHERE xp_total > 0
      AND NOT EXISTS (
        SELECT 1 FROM agent_gamification_events age
        WHERE age.user_id = agent_gamification_profile.user_id
          AND age.tipo_evento = 'bono_antiguedad'
      )
  LOOP
    PERFORM fn_registrar_evento_gamificacion(
      p_user_id := v_agente.user_id,
      p_tipo_evento := 'bono_antiguedad'::gamification_event_type,
      p_xp_delta := v_agente.xp_total,
      p_jc_delta := v_agente.jiro_coins_balance,
      p_reversible := false,
      p_metadata := jsonb_build_object(
        'tipo', 'bono_inicial',
        'anios_antiguedad', v_agente.anios_antiguedad,
        'multiplicador_veterano', v_agente.multiplicador_veterano,
        'descripcion', 'Bono inicial por antigüedad al activar gamificación'
      )
    );
  END LOOP;
END $$;
