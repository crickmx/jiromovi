/*
  # Dashboard KPIs para Cotización/Emisión

  1. Vistas
    - Vista de métricas globales de conversión
    - Vista de ranking por agente

  2. Funciones
    - Funciones para obtener KPIs con filtros dinámicos
*/

-- =====================================================
-- LIMPIAR FUNCIONES EXISTENTES
-- =====================================================
DROP FUNCTION IF EXISTS get_tramites_kpis(timestamptz, timestamptz, uuid, uuid);
DROP FUNCTION IF EXISTS get_tramites_ranking(timestamptz, timestamptz, uuid);

-- =====================================================
-- VISTA: MÉTRICAS GLOBALES DE CONVERSIÓN
-- =====================================================
CREATE OR REPLACE VIEW v_tramites_conversion_metrics AS
SELECT
  COUNT(*) as total_tramites,
  COUNT(*) FILTER (WHERE resultado = 'ganado') as total_emitidos,
  COUNT(*) FILTER (WHERE resultado = 'perdido') as total_no_emitidos,
  COUNT(*) FILTER (WHERE resultado = 'en_progreso') as total_en_proceso,
  ROUND(
    (COUNT(*) FILTER (WHERE resultado = 'ganado')::numeric / 
     NULLIF(COUNT(*) FILTER (WHERE resultado IN ('ganado', 'perdido'))::numeric, 0)) * 100,
    1
  ) as tasa_conversion,
  DATE_TRUNC('month', fecha_creacion) as periodo,
  creado_por as usuario_id,
  u.nombre_completo as usuario_nombre,
  u.oficina_id,
  o.nombre as oficina_nombre
FROM tickets t
LEFT JOIN usuarios u ON t.creado_por = u.id
LEFT JOIN oficinas o ON u.oficina_id = o.id
WHERE t.tipo_tramite = 'registro_actividad'
  AND t.activity_subtype_id IN (
    SELECT id FROM tramite_activity_types
    WHERE LOWER(nombre) LIKE '%cotizaci%' OR LOWER(nombre) LIKE '%emisi%'
  )
GROUP BY 
  DATE_TRUNC('month', fecha_creacion),
  creado_por,
  u.nombre_completo,
  u.oficina_id,
  o.nombre;

-- =====================================================
-- VISTA: RANKING DE AGENTES POR CONVERSIÓN
-- =====================================================
CREATE OR REPLACE VIEW v_tramites_ranking_agentes AS
SELECT
  t.creado_por as agente_id,
  u.nombre_completo as agente_nombre,
  u.oficina_id,
  o.nombre as oficina_nombre,
  COUNT(*) as total_tramites,
  COUNT(*) FILTER (WHERE t.resultado = 'ganado') as total_emitidos,
  COUNT(*) FILTER (WHERE t.resultado = 'perdido') as total_no_emitidos,
  COUNT(*) FILTER (WHERE t.resultado = 'en_progreso') as total_en_proceso,
  ROUND(
    (COUNT(*) FILTER (WHERE t.resultado = 'ganado')::numeric / 
     NULLIF(COUNT(*) FILTER (WHERE t.resultado IN ('ganado', 'perdido'))::numeric, 0)) * 100,
    1
  ) as tasa_conversion
FROM tickets t
LEFT JOIN usuarios u ON t.creado_por = u.id
LEFT JOIN oficinas o ON u.oficina_id = o.id
WHERE t.tipo_tramite = 'registro_actividad'
  AND t.activity_subtype_id IN (
    SELECT id FROM tramite_activity_types
    WHERE LOWER(nombre) LIKE '%cotizaci%' OR LOWER(nombre) LIKE '%emisi%'
  )
GROUP BY 
  t.creado_por,
  u.nombre_completo,
  u.oficina_id,
  o.nombre
HAVING COUNT(*) > 0
ORDER BY tasa_conversion DESC NULLS LAST, total_tramites DESC;

-- =====================================================
-- FUNCIÓN: OBTENER KPIs CON FILTROS
-- =====================================================
CREATE OR REPLACE FUNCTION get_conversion_kpis(
  p_fecha_inicio timestamptz DEFAULT NULL,
  p_fecha_fin timestamptz DEFAULT NULL,
  p_oficina_id uuid DEFAULT NULL,
  p_usuario_id uuid DEFAULT NULL
)
RETURNS TABLE(
  total_tramites bigint,
  total_emitidos bigint,
  total_no_emitidos bigint,
  total_en_proceso bigint,
  tasa_conversion numeric
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::bigint as total_tramites,
    COUNT(*) FILTER (WHERE t.resultado = 'ganado')::bigint as total_emitidos,
    COUNT(*) FILTER (WHERE t.resultado = 'perdido')::bigint as total_no_emitidos,
    COUNT(*) FILTER (WHERE t.resultado = 'en_progreso')::bigint as total_en_proceso,
    ROUND(
      (COUNT(*) FILTER (WHERE t.resultado = 'ganado')::numeric / 
       NULLIF(COUNT(*) FILTER (WHERE t.resultado IN ('ganado', 'perdido'))::numeric, 0)) * 100,
      1
    ) as tasa_conversion
  FROM tickets t
  LEFT JOIN usuarios u ON t.creado_por = u.id
  WHERE t.tipo_tramite = 'registro_actividad'
    AND t.activity_subtype_id IN (
      SELECT id FROM tramite_activity_types
      WHERE LOWER(nombre) LIKE '%cotizaci%' OR LOWER(nombre) LIKE '%emisi%'
    )
    AND (p_fecha_inicio IS NULL OR t.fecha_creacion >= p_fecha_inicio)
    AND (p_fecha_fin IS NULL OR t.fecha_creacion <= p_fecha_fin)
    AND (p_oficina_id IS NULL OR u.oficina_id = p_oficina_id)
    AND (p_usuario_id IS NULL OR t.creado_por = p_usuario_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- FUNCIÓN: OBTENER RANKING CON FILTROS
-- =====================================================
CREATE OR REPLACE FUNCTION get_conversion_ranking(
  p_fecha_inicio timestamptz DEFAULT NULL,
  p_fecha_fin timestamptz DEFAULT NULL,
  p_oficina_id uuid DEFAULT NULL
)
RETURNS TABLE(
  agente_id uuid,
  agente_nombre text,
  oficina_id uuid,
  oficina_nombre text,
  total_tramites bigint,
  total_emitidos bigint,
  total_no_emitidos bigint,
  total_en_proceso bigint,
  tasa_conversion numeric
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.creado_por as agente_id,
    u.nombre_completo as agente_nombre,
    u.oficina_id,
    o.nombre as oficina_nombre,
    COUNT(*)::bigint as total_tramites,
    COUNT(*) FILTER (WHERE t.resultado = 'ganado')::bigint as total_emitidos,
    COUNT(*) FILTER (WHERE t.resultado = 'perdido')::bigint as total_no_emitidos,
    COUNT(*) FILTER (WHERE t.resultado = 'en_progreso')::bigint as total_en_proceso,
    ROUND(
      (COUNT(*) FILTER (WHERE t.resultado = 'ganado')::numeric / 
       NULLIF(COUNT(*) FILTER (WHERE t.resultado IN ('ganado', 'perdido'))::numeric, 0)) * 100,
      1
    ) as tasa_conversion
  FROM tickets t
  LEFT JOIN usuarios u ON t.creado_por = u.id
  LEFT JOIN oficinas o ON u.oficina_id = o.id
  WHERE t.tipo_tramite = 'registro_actividad'
    AND t.activity_subtype_id IN (
      SELECT id FROM tramite_activity_types
      WHERE LOWER(nombre) LIKE '%cotizaci%' OR LOWER(nombre) LIKE '%emisi%'
    )
    AND (p_fecha_inicio IS NULL OR t.fecha_creacion >= p_fecha_inicio)
    AND (p_fecha_fin IS NULL OR t.fecha_creacion <= p_fecha_fin)
    AND (p_oficina_id IS NULL OR u.oficina_id = p_oficina_id)
  GROUP BY 
    t.creado_por,
    u.nombre_completo,
    u.oficina_id,
    o.nombre
  HAVING COUNT(*) > 0
  ORDER BY tasa_conversion DESC NULLS LAST, total_tramites DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Permisos
GRANT SELECT ON v_tramites_conversion_metrics TO authenticated;
GRANT SELECT ON v_tramites_ranking_agentes TO authenticated;
GRANT EXECUTE ON FUNCTION get_conversion_kpis TO authenticated;
GRANT EXECUTE ON FUNCTION get_conversion_ranking TO authenticated;

-- Comentarios
COMMENT ON VIEW v_tramites_conversion_metrics IS 'Métricas de conversión de Cotización/Emisión agregadas por periodo, usuario y oficina';
COMMENT ON VIEW v_tramites_ranking_agentes IS 'Ranking de agentes por tasa de conversión en trámites de Cotización/Emisión';
COMMENT ON FUNCTION get_conversion_kpis IS 'Obtiene KPIs de conversión con filtros opcionales de fecha, oficina y usuario';
COMMENT ON FUNCTION get_conversion_ranking IS 'Obtiene ranking de agentes con filtros opcionales de fecha y oficina';
