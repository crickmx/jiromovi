/*
  # Remover Campo Avatar de Funciones de Ranking

  1. Cambios
    - Eliminar funciones existentes
    - Recrear sin el campo avatar_url que no existe
*/

-- =====================================================
-- Eliminar funciones existentes
-- =====================================================

DROP FUNCTION IF EXISTS fn_ranking_global(INTEGER, INTEGER);
DROP FUNCTION IF EXISTS fn_ranking_oficina(UUID, INTEGER);
DROP FUNCTION IF EXISTS fn_ranking_jiro_coins(INTEGER);

-- =====================================================
-- Crear función de ranking global
-- =====================================================

CREATE FUNCTION fn_ranking_global(
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE(
  posicion BIGINT,
  user_id UUID,
  nombre_completo TEXT,
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
    AND LOWER(u.estado) = 'activo'
    AND u.deleted_at IS NULL
  ORDER BY agp.xp_total DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql STABLE;

-- =====================================================
-- Crear función de ranking por oficina
-- =====================================================

CREATE FUNCTION fn_ranking_oficina(
  p_oficina_id UUID,
  p_limit INTEGER DEFAULT 20
)
RETURNS TABLE(
  posicion BIGINT,
  user_id UUID,
  nombre_completo TEXT,
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
    agp.xp_total,
    agp.nivel_actual,
    agp.rango_actual,
    agp.jiro_coins_balance,
    agp.total_polizas_emitidas
  FROM agent_gamification_profile agp
  INNER JOIN usuarios u ON agp.user_id = u.id
  WHERE u.rol = 'Agente'
    AND LOWER(u.estado) = 'activo'
    AND u.deleted_at IS NULL
    AND u.oficina_id = p_oficina_id
  ORDER BY agp.xp_total DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;

-- =====================================================
-- Crear función de ranking por Jiro Coins
-- =====================================================

CREATE FUNCTION fn_ranking_jiro_coins(
  p_limit INTEGER DEFAULT 20
)
RETURNS TABLE(
  posicion BIGINT,
  user_id UUID,
  nombre_completo TEXT,
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
    o.nombre as oficina_nombre,
    agp.jiro_coins_balance,
    agp.nivel_actual,
    agp.rango_actual
  FROM agent_gamification_profile agp
  INNER JOIN usuarios u ON agp.user_id = u.id
  LEFT JOIN oficinas o ON u.oficina_id = o.id
  WHERE u.rol = 'Agente'
    AND LOWER(u.estado) = 'activo'
    AND u.deleted_at IS NULL
    AND agp.jiro_coins_balance > 0
  ORDER BY agp.jiro_coins_balance DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;
