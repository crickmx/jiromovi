/*
  # Funciones de Ranking y Consultas para Gamificación

  1. Funciones de Ranking
    - `fn_ranking_global`: Top agentes por XP
    - `fn_ranking_oficina`: Top agentes de una oficina
    - `fn_ranking_jiro_coins`: Top agentes por Jiro Coins
    - `fn_historial_eventos`: Historial de eventos de un agente

  2. Funciones de Estadísticas
    - `fn_estadisticas_gamificacion`: Resumen del sistema
    - `fn_proximos_niveles`: Agentes próximos a subir de nivel
*/

-- =====================================================
-- FUNCIÓN: Ranking global de agentes por XP
-- =====================================================

CREATE OR REPLACE FUNCTION fn_ranking_global(
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE(
  posicion BIGINT,
  user_id UUID,
  nombre_completo TEXT,
  avatar_url TEXT,
  oficina_nombre TEXT,
  xp_total INTEGER,
  nivel_actual INTEGER,
  rango_actual TEXT,
  jiro_coins_balance INTEGER,
  total_polizas_emitidas INTEGER,
  anios_antiguedad NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ROW_NUMBER() OVER (ORDER BY agp.xp_total DESC) as posicion,
    agp.user_id,
    u.nombre_completo,
    u.avatar_url,
    o.nombre as oficina_nombre,
    agp.xp_total,
    agp.nivel_actual,
    agp.rango_actual,
    agp.jiro_coins_balance,
    agp.total_polizas_emitidas,
    agp.anios_antiguedad
  FROM agent_gamification_profile agp
  INNER JOIN usuarios u ON agp.user_id = u.id
  LEFT JOIN oficinas o ON u.oficina_id = o.id
  WHERE u.rol = 'Agente'
    AND u.estado = 'Activo'
  ORDER BY agp.xp_total DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- =====================================================
-- FUNCIÓN: Ranking de agentes por oficina
-- =====================================================

CREATE OR REPLACE FUNCTION fn_ranking_oficina(
  p_oficina_id UUID,
  p_limit INTEGER DEFAULT 20
)
RETURNS TABLE(
  posicion BIGINT,
  user_id UUID,
  nombre_completo TEXT,
  avatar_url TEXT,
  xp_total INTEGER,
  nivel_actual INTEGER,
  rango_actual TEXT,
  jiro_coins_balance INTEGER,
  total_polizas_emitidas INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ROW_NUMBER() OVER (ORDER BY agp.xp_total DESC) as posicion,
    agp.user_id,
    u.nombre_completo,
    u.avatar_url,
    agp.xp_total,
    agp.nivel_actual,
    agp.rango_actual,
    agp.jiro_coins_balance,
    agp.total_polizas_emitidas
  FROM agent_gamification_profile agp
  INNER JOIN usuarios u ON agp.user_id = u.id
  WHERE u.rol = 'Agente'
    AND u.estado = 'Activo'
    AND u.oficina_id = p_oficina_id
  ORDER BY agp.xp_total DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- =====================================================
-- FUNCIÓN: Ranking por Jiro Coins
-- =====================================================

CREATE OR REPLACE FUNCTION fn_ranking_jiro_coins(
  p_limit INTEGER DEFAULT 50
)
RETURNS TABLE(
  posicion BIGINT,
  user_id UUID,
  nombre_completo TEXT,
  avatar_url TEXT,
  oficina_nombre TEXT,
  jiro_coins_balance INTEGER,
  nivel_actual INTEGER,
  rango_actual TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ROW_NUMBER() OVER (ORDER BY agp.jiro_coins_balance DESC) as posicion,
    agp.user_id,
    u.nombre_completo,
    u.avatar_url,
    o.nombre as oficina_nombre,
    agp.jiro_coins_balance,
    agp.nivel_actual,
    agp.rango_actual
  FROM agent_gamification_profile agp
  INNER JOIN usuarios u ON agp.user_id = u.id
  LEFT JOIN oficinas o ON u.oficina_id = o.id
  WHERE u.rol = 'Agente'
    AND u.estado = 'Activo'
    AND agp.jiro_coins_balance > 0
  ORDER BY agp.jiro_coins_balance DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- =====================================================
-- FUNCIÓN: Historial de eventos de un agente
-- =====================================================

CREATE OR REPLACE FUNCTION fn_historial_eventos(
  p_user_id UUID,
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE(
  id UUID,
  tipo_evento gamification_event_type,
  xp_delta INTEGER,
  jc_delta INTEGER,
  xp_despues INTEGER,
  jc_despues INTEGER,
  fecha_evento TIMESTAMPTZ,
  referencia_tipo TEXT,
  referencia_id TEXT,
  metadata JSONB,
  reversed_by_event_id UUID,
  is_reversal BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    age.id,
    age.tipo_evento,
    age.xp_delta,
    age.jc_delta,
    age.xp_despues,
    age.jc_despues,
    age.fecha_evento,
    age.referencia_tipo,
    age.referencia_id,
    age.metadata,
    age.reversed_by_event_id,
    age.is_reversal
  FROM agent_gamification_events age
  WHERE age.user_id = p_user_id
  ORDER BY age.fecha_evento DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- =====================================================
-- FUNCIÓN: Estadísticas globales del sistema
-- =====================================================

CREATE OR REPLACE FUNCTION fn_estadisticas_gamificacion()
RETURNS TABLE(
  total_agentes INTEGER,
  total_xp_otorgado BIGINT,
  total_jc_circulacion BIGINT,
  promedio_xp_agente NUMERIC,
  promedio_jc_agente NUMERIC,
  agentes_por_rango JSONB,
  eventos_ultimos_30_dias INTEGER,
  misiones_completadas_mes INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(DISTINCT agp.user_id)::INTEGER as total_agentes,
    SUM(agp.xp_total)::BIGINT as total_xp_otorgado,
    SUM(agp.jiro_coins_balance)::BIGINT as total_jc_circulacion,
    ROUND(AVG(agp.xp_total), 2) as promedio_xp_agente,
    ROUND(AVG(agp.jiro_coins_balance), 2) as promedio_jc_agente,
    (
      SELECT jsonb_object_agg(rango_actual, cuenta)
      FROM (
        SELECT rango_actual, COUNT(*) as cuenta
        FROM agent_gamification_profile
        GROUP BY rango_actual
      ) rangos
    ) as agentes_por_rango,
    (
      SELECT COUNT(*)::INTEGER
      FROM agent_gamification_events
      WHERE fecha_evento >= now() - INTERVAL '30 days'
    ) as eventos_ultimos_30_dias,
    (
      SELECT COUNT(*)::INTEGER
      FROM agent_mission_progress
      WHERE completada = true
        AND fecha_completada >= DATE_TRUNC('month', CURRENT_DATE)
    ) as misiones_completadas_mes
  FROM agent_gamification_profile agp;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- =====================================================
-- FUNCIÓN: Agentes próximos a subir de nivel
-- =====================================================

CREATE OR REPLACE FUNCTION fn_proximos_niveles(
  p_limit INTEGER DEFAULT 20
)
RETURNS TABLE(
  user_id UUID,
  nombre_completo TEXT,
  nivel_actual INTEGER,
  xp_total INTEGER,
  xp_para_siguiente INTEGER,
  porcentaje_progreso NUMERIC,
  siguiente_nivel INTEGER,
  siguiente_rango TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    agp.user_id,
    u.nombre_completo,
    agp.nivel_actual,
    agp.xp_total,
    (al_siguiente.xp_min - agp.xp_total) as xp_para_siguiente,
    ROUND(
      ((agp.xp_total - al_actual.xp_min)::NUMERIC / 
       (al_siguiente.xp_min - al_actual.xp_min)::NUMERIC * 100),
      1
    ) as porcentaje_progreso,
    al_siguiente.nivel as siguiente_nivel,
    al_siguiente.rango as siguiente_rango
  FROM agent_gamification_profile agp
  INNER JOIN usuarios u ON agp.user_id = u.id
  INNER JOIN agent_levels al_actual ON agp.nivel_actual = al_actual.nivel
  LEFT JOIN agent_levels al_siguiente ON al_siguiente.nivel = agp.nivel_actual + 1
  WHERE u.rol = 'Agente'
    AND u.estado = 'Activo'
    AND al_siguiente.nivel IS NOT NULL
  ORDER BY porcentaje_progreso DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- =====================================================
-- FUNCIÓN: Obtener posición de un agente en el ranking
-- =====================================================

CREATE OR REPLACE FUNCTION fn_obtener_posicion_agente(p_user_id UUID)
RETURNS TABLE(
  posicion_global BIGINT,
  posicion_oficina BIGINT,
  total_agentes BIGINT,
  total_agentes_oficina BIGINT
) AS $$
DECLARE
  v_oficina_id UUID;
BEGIN
  -- Obtener oficina del agente
  SELECT oficina_id INTO v_oficina_id
  FROM usuarios
  WHERE id = p_user_id;

  RETURN QUERY
  WITH ranking_global AS (
    SELECT
      agp.user_id,
      ROW_NUMBER() OVER (ORDER BY agp.xp_total DESC) as pos
    FROM agent_gamification_profile agp
    INNER JOIN usuarios u ON agp.user_id = u.id
    WHERE u.rol = 'Agente' AND u.estado = 'Activo'
  ),
  ranking_oficina AS (
    SELECT
      agp.user_id,
      ROW_NUMBER() OVER (ORDER BY agp.xp_total DESC) as pos
    FROM agent_gamification_profile agp
    INNER JOIN usuarios u ON agp.user_id = u.id
    WHERE u.rol = 'Agente' 
      AND u.estado = 'Activo'
      AND u.oficina_id = v_oficina_id
  )
  SELECT
    rg.pos as posicion_global,
    ro.pos as posicion_oficina,
    (SELECT COUNT(*) FROM ranking_global) as total_agentes,
    (SELECT COUNT(*) FROM ranking_oficina) as total_agentes_oficina
  FROM ranking_global rg
  LEFT JOIN ranking_oficina ro ON ro.user_id = rg.user_id
  WHERE rg.user_id = p_user_id;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- =====================================================
-- FUNCIÓN: Obtener misiones del agente
-- =====================================================

CREATE OR REPLACE FUNCTION fn_misiones_agente(
  p_user_id UUID
)
RETURNS TABLE(
  mission_id UUID,
  nombre TEXT,
  descripcion TEXT,
  tipo_periodo mission_period_type,
  xp_reward INTEGER,
  jc_reward INTEGER,
  icono TEXT,
  color TEXT,
  progreso_actual INTEGER,
  meta_requerida INTEGER,
  completada BOOLEAN,
  porcentaje_completado NUMERIC
) AS $$
DECLARE
  v_periodo TEXT;
BEGIN
  RETURN QUERY
  SELECT
    am.id as mission_id,
    am.nombre,
    am.descripcion,
    am.tipo_periodo,
    am.xp_reward,
    am.jc_reward,
    am.icono,
    am.color,
    COALESCE(amp.progreso_actual, 0) as progreso_actual,
    COALESCE((am.regla_json->>'cantidad')::INTEGER, 1) as meta_requerida,
    COALESCE(amp.completada, false) as completada,
    ROUND(
      (COALESCE(amp.progreso_actual, 0)::NUMERIC / 
       COALESCE((am.regla_json->>'cantidad')::INTEGER, 1)::NUMERIC * 100),
      1
    ) as porcentaje_completado
  FROM agent_missions am
  LEFT JOIN agent_mission_progress amp ON (
    amp.mission_id = am.id 
    AND amp.user_id = p_user_id
    AND amp.periodo = CASE am.tipo_periodo
      WHEN 'semanal' THEN TO_CHAR(now(), 'IYYY-IW')
      WHEN 'mensual' THEN TO_CHAR(now(), 'YYYY-MM')
      WHEN 'unica' THEN 'unico'
      ELSE 'permanente'
    END
  )
  WHERE am.activa = true
  ORDER BY am.orden, am.created_at;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Otorgar permisos de ejecución
GRANT EXECUTE ON FUNCTION fn_ranking_global TO authenticated;
GRANT EXECUTE ON FUNCTION fn_ranking_oficina TO authenticated;
GRANT EXECUTE ON FUNCTION fn_ranking_jiro_coins TO authenticated;
GRANT EXECUTE ON FUNCTION fn_historial_eventos TO authenticated;
GRANT EXECUTE ON FUNCTION fn_estadisticas_gamificacion TO authenticated;
GRANT EXECUTE ON FUNCTION fn_proximos_niveles TO authenticated;
GRANT EXECUTE ON FUNCTION fn_obtener_posicion_agente TO authenticated;
GRANT EXECUTE ON FUNCTION fn_misiones_agente TO authenticated;
GRANT EXECUTE ON FUNCTION fn_registrar_evento_gamificacion TO authenticated;
GRANT EXECUTE ON FUNCTION fn_revertir_evento_gamificacion TO authenticated;