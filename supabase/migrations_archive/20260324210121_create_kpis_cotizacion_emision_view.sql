/*
  # Vista de KPIs de Conversión para Cotización/Emisión

  1. Vista
    - Métricas de conversión por periodo (mes)
    - Total emitidos, no emitidos, en proceso
    - Tasa de conversión (%)
    - Agrupado por usuario y oficina

  2. Permisos
    - Accesible para todos los usuarios autenticados
*/

-- =====================================================
-- VISTA PARA KPIs DE CONVERSIÓN
-- =====================================================
CREATE OR REPLACE VIEW v_kpis_cotizacion_emision AS
SELECT
  DATE_TRUNC('month', t.fecha_creacion) as periodo,
  COUNT(*) FILTER (WHERE t.resultado = 'ganado') as total_emitidos,
  COUNT(*) FILTER (WHERE t.resultado = 'perdido') as total_no_emitidos,
  COUNT(*) FILTER (WHERE t.resultado = 'en_progreso') as total_en_proceso,
  COUNT(*) as total_tramites,
  ROUND(
    (COUNT(*) FILTER (WHERE t.resultado = 'ganado')::numeric /
     NULLIF(COUNT(*) FILTER (WHERE t.resultado IN ('ganado', 'perdido'))::numeric, 0)) * 100,
    2
  ) as tasa_conversion_porcentaje,
  t.creado_por,
  u.nombre_completo as creado_por_nombre,
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
  DATE_TRUNC('month', t.fecha_creacion),
  t.creado_por,
  u.nombre_completo,
  o.nombre
ORDER BY periodo DESC;

-- Permisos en la vista
GRANT SELECT ON v_kpis_cotizacion_emision TO authenticated;

-- Comentario
COMMENT ON VIEW v_kpis_cotizacion_emision IS 'Vista de KPIs de conversión para trámites de Cotización/Emisión, mostrando tasa de éxito y métricas por usuario y periodo';
