/*
  # Funciones de Ranking para Gamificación

  1. Functions
    - `get_agent_xp_rank()` - Obtiene ranking de XP del agente
    - `get_agent_jc_rank()` - Obtiene ranking de Jiro Coins
    - `get_agent_polizas_rank()` - Obtiene ranking de pólizas

  2. Security
    - Functions son SECURITY DEFINER para acceso optimizado
*/

-- =====================================================
-- FUNCIÓN: Obtener ranking de XP
-- =====================================================

CREATE OR REPLACE FUNCTION get_agent_xp_rank(p_user_id UUID)
RETURNS TABLE(rank BIGINT, total BIGINT) AS $$
BEGIN
  RETURN QUERY
  WITH ranked_agents AS (
    SELECT 
      user_id,
      xp_total,
      ROW_NUMBER() OVER (ORDER BY xp_total DESC, created_at ASC) as position
    FROM agent_gamification_profile
  ),
  total_count AS (
    SELECT COUNT(*) as cnt FROM agent_gamification_profile
  )
  SELECT 
    COALESCE(ra.position, 0)::BIGINT as rank,
    tc.cnt::BIGINT as total
  FROM total_count tc
  LEFT JOIN ranked_agents ra ON ra.user_id = p_user_id;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- =====================================================
-- FUNCIÓN: Obtener ranking de Jiro Coins
-- =====================================================

CREATE OR REPLACE FUNCTION get_agent_jc_rank(p_user_id UUID)
RETURNS TABLE(rank BIGINT, total BIGINT) AS $$
BEGIN
  RETURN QUERY
  WITH ranked_agents AS (
    SELECT 
      user_id,
      jiro_coins_balance,
      ROW_NUMBER() OVER (ORDER BY jiro_coins_balance DESC, created_at ASC) as position
    FROM agent_gamification_profile
  ),
  total_count AS (
    SELECT COUNT(*) as cnt FROM agent_gamification_profile
  )
  SELECT 
    COALESCE(ra.position, 0)::BIGINT as rank,
    tc.cnt::BIGINT as total
  FROM total_count tc
  LEFT JOIN ranked_agents ra ON ra.user_id = p_user_id;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- =====================================================
-- FUNCIÓN: Obtener ranking de pólizas
-- =====================================================

CREATE OR REPLACE FUNCTION get_agent_polizas_rank(p_user_id UUID)
RETURNS TABLE(rank BIGINT, total BIGINT) AS $$
BEGIN
  RETURN QUERY
  WITH ranked_agents AS (
    SELECT 
      user_id,
      total_polizas_emitidas,
      ROW_NUMBER() OVER (ORDER BY total_polizas_emitidas DESC, created_at ASC) as position
    FROM agent_gamification_profile
  ),
  total_count AS (
    SELECT COUNT(*) as cnt FROM agent_gamification_profile
  )
  SELECT 
    COALESCE(ra.position, 0)::BIGINT as rank,
    tc.cnt::BIGINT as total
  FROM total_count tc
  LEFT JOIN ranked_agents ra ON ra.user_id = p_user_id;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- =====================================================
-- FUNCIÓN: Obtener top agentes
-- =====================================================

CREATE OR REPLACE FUNCTION get_top_agents(
  p_order_by TEXT DEFAULT 'xp_total',
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE(
  user_id UUID,
  nombre_completo TEXT,
  oficina TEXT,
  xp_total INTEGER,
  jiro_coins_balance INTEGER,
  nivel_actual INTEGER,
  rango_actual TEXT,
  total_polizas_emitidas INTEGER,
  rank BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    agp.user_id,
    u.nombre_completo,
    o.nombre as oficina,
    agp.xp_total,
    agp.jiro_coins_balance,
    agp.nivel_actual,
    agp.rango_actual,
    agp.total_polizas_emitidas,
    ROW_NUMBER() OVER (
      ORDER BY 
        CASE WHEN p_order_by = 'xp_total' THEN agp.xp_total END DESC,
        CASE WHEN p_order_by = 'jiro_coins_balance' THEN agp.jiro_coins_balance END DESC,
        CASE WHEN p_order_by = 'total_polizas_emitidas' THEN agp.total_polizas_emitidas END DESC,
        agp.created_at ASC
    ) as rank
  FROM agent_gamification_profile agp
  INNER JOIN usuarios u ON u.id = agp.user_id
  LEFT JOIN oficinas o ON o.id = u.oficina_id
  WHERE u.rol = 'Agente'
  ORDER BY rank
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;
