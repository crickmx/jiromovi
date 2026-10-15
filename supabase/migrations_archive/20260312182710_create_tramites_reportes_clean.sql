/*
  # Sistema de Reportes para Trámites

  1. Vistas SQL optimizadas para dashboard
  2. Función para obtener KPIs con filtros
  3. Índices para optimización de consultas
*/

-- =====================================================
-- VISTA: Trámites para reportes
-- =====================================================

CREATE OR REPLACE VIEW tramites_reportes_view AS
SELECT 
  t.id,
  t.folio,
  t.tipo_tramite,
  t.prioridad,
  t.instrucciones,
  t.poliza,
  t.fecha_creacion as fecha_solicitud,
  COALESCE(t.progress_percent, 0) as avance,
  
  CASE 
    WHEN COALESCE(t.progress_percent, 0) = 0 THEN 'Pendiente'
    WHEN t.progress_percent = 100 THEN 'Finalizado'
    ELSE 'En Proceso'
  END as estatus_calculado,
  
  t.cerrado_en as fecha_finalizacion,
  
  CASE 
    WHEN t.cerrado_en IS NOT NULL THEN
      EXTRACT(EPOCH FROM (t.cerrado_en - t.fecha_creacion)) / 86400.0
    ELSE NULL
  END as tiempo_resolucion_dias,
  
  solicitante.id as solicitante_id,
  solicitante.nombre_completo as solicitante_nombre,
  solicitante.oficina_id as solicitante_oficina_id,
  
  asignado.id as asignado_id,
  asignado.nombre_completo as asignado_nombre,
  asignado.oficina_id as asignado_oficina_id,
  
  oficina.nombre as oficina_nombre,
  estatus.nombre as estatus_nombre

FROM tickets t
LEFT JOIN usuarios solicitante ON t.creado_por = solicitante.id
LEFT JOIN ticket_estatus estatus ON t.estatus_id = estatus.id
LEFT JOIN LATERAL (
  SELECT DISTINCT ON (ta.ticket_id) 
    u.id, u.nombre_completo, u.oficina_id
  FROM ticket_asignaciones ta
  JOIN usuarios u ON ta.ejecutivo_id = u.id
  WHERE ta.ticket_id = t.id
  ORDER BY ta.ticket_id, ta.asignado_en DESC
) asignado ON true
LEFT JOIN oficinas oficina ON asignado.oficina_id = oficina.id;

-- =====================================================
-- VISTA: Productividad por usuario
-- =====================================================

CREATE OR REPLACE VIEW tramites_productividad_usuario AS
SELECT 
  u.id as usuario_id,
  u.nombre_completo,
  u.oficina_id,
  o.nombre as oficina_nombre,
  
  COUNT(DISTINCT t.id) as total_tramites,
  COUNT(DISTINCT CASE WHEN COALESCE(t.progress_percent, 0) = 0 THEN t.id END) as tramites_pendientes,
  COUNT(DISTINCT CASE WHEN t.progress_percent > 0 AND t.progress_percent < 100 THEN t.id END) as tramites_en_proceso,
  COUNT(DISTINCT CASE WHEN t.progress_percent = 100 THEN t.id END) as tramites_finalizados,
  
  ROUND(AVG(COALESCE(t.progress_percent, 0)), 2) as avance_promedio,
  
  ROUND(AVG(
    CASE 
      WHEN t.cerrado_en IS NOT NULL THEN
        EXTRACT(EPOCH FROM (t.cerrado_en - t.fecha_creacion)) / 86400.0
      ELSE NULL
    END
  ), 2) as tiempo_promedio_resolucion_dias,
  
  ROUND(
    (COUNT(DISTINCT CASE WHEN t.progress_percent = 100 THEN t.id END)::numeric / 
    NULLIF(COUNT(DISTINCT t.id), 0) * 100), 2
  ) as porcentaje_finalizacion

FROM usuarios u
LEFT JOIN oficinas o ON u.oficina_id = o.id
LEFT JOIN ticket_asignaciones ta ON ta.ejecutivo_id = u.id
LEFT JOIN tickets t ON ta.ticket_id = t.id
GROUP BY u.id, u.nombre_completo, u.oficina_id, o.nombre;

-- =====================================================
-- VISTA: Productividad por oficina
-- =====================================================

CREATE OR REPLACE VIEW tramites_productividad_oficina AS
SELECT 
  o.id as oficina_id,
  o.nombre as oficina_nombre,
  
  COUNT(DISTINCT t.id) as total_tramites,
  COUNT(DISTINCT CASE WHEN COALESCE(t.progress_percent, 0) = 0 THEN t.id END) as tramites_pendientes,
  COUNT(DISTINCT CASE WHEN t.progress_percent > 0 AND t.progress_percent < 100 THEN t.id END) as tramites_en_proceso,
  COUNT(DISTINCT CASE WHEN t.progress_percent = 100 THEN t.id END) as tramites_finalizados,
  
  ROUND(AVG(COALESCE(t.progress_percent, 0)), 2) as avance_promedio,
  
  ROUND(AVG(
    CASE 
      WHEN t.cerrado_en IS NOT NULL THEN
        EXTRACT(EPOCH FROM (t.cerrado_en - t.fecha_creacion)) / 86400.0
      ELSE NULL
    END
  ), 2) as tiempo_promedio_resolucion_dias,
  
  ROUND(
    (COUNT(DISTINCT CASE WHEN t.progress_percent = 100 THEN t.id END)::numeric / 
    NULLIF(COUNT(DISTINCT t.id), 0) * 100), 2
  ) as porcentaje_finalizacion,
  
  COUNT(DISTINCT u.id) as usuarios_activos

FROM oficinas o
LEFT JOIN usuarios u ON u.oficina_id = o.id
LEFT JOIN ticket_asignaciones ta ON ta.ejecutivo_id = u.id
LEFT JOIN tickets t ON ta.ticket_id = t.id
WHERE o.activa = true
GROUP BY o.id, o.nombre;

-- =====================================================
-- FUNCIÓN: Obtener KPIs principales
-- =====================================================

CREATE OR REPLACE FUNCTION get_tramites_kpis(
  p_fecha_inicio timestamptz DEFAULT NULL,
  p_fecha_fin timestamptz DEFAULT NULL,
  p_oficina_id uuid DEFAULT NULL,
  p_usuario_id uuid DEFAULT NULL,
  p_tipo_tramite text DEFAULT NULL,
  p_avance int DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result jsonb;
  v_total int;
  v_pendientes int;
  v_en_proceso int;
  v_finalizados int;
  v_tiempo_promedio numeric;
  v_porcentaje_finalizacion numeric;
  v_avance_promedio numeric;
BEGIN
  WITH filtered_tickets AS (
    SELECT DISTINCT t.*
    FROM tickets t
    LEFT JOIN ticket_asignaciones ta ON t.id = ta.ticket_id
    LEFT JOIN usuarios u ON ta.ejecutivo_id = u.id
    WHERE (p_fecha_inicio IS NULL OR t.fecha_creacion >= p_fecha_inicio)
    AND (p_fecha_fin IS NULL OR t.fecha_creacion <= p_fecha_fin)
    AND (p_oficina_id IS NULL OR u.oficina_id = p_oficina_id)
    AND (p_usuario_id IS NULL OR ta.ejecutivo_id = p_usuario_id)
    AND (p_tipo_tramite IS NULL OR t.tipo_tramite = p_tipo_tramite)
    AND (p_avance IS NULL OR t.progress_percent = p_avance)
  )
  SELECT
    COUNT(*),
    COUNT(CASE WHEN COALESCE(progress_percent, 0) = 0 THEN 1 END),
    COUNT(CASE WHEN progress_percent > 0 AND progress_percent < 100 THEN 1 END),
    COUNT(CASE WHEN progress_percent = 100 THEN 1 END),
    ROUND(AVG(
      CASE 
        WHEN cerrado_en IS NOT NULL THEN
          EXTRACT(EPOCH FROM (cerrado_en - fecha_creacion)) / 86400.0
        ELSE NULL
      END
    ), 2),
    ROUND(AVG(COALESCE(progress_percent, 0)), 2)
  INTO v_total, v_pendientes, v_en_proceso, v_finalizados, v_tiempo_promedio, v_avance_promedio
  FROM filtered_tickets;

  IF v_total > 0 THEN
    v_porcentaje_finalizacion := ROUND((v_finalizados::numeric / v_total * 100), 2);
  ELSE
    v_porcentaje_finalizacion := 0;
  END IF;

  v_result := jsonb_build_object(
    'total_tramites', COALESCE(v_total, 0),
    'tramites_pendientes', COALESCE(v_pendientes, 0),
    'tramites_en_proceso', COALESCE(v_en_proceso, 0),
    'tramites_finalizados', COALESCE(v_finalizados, 0),
    'tiempo_promedio_resolucion_dias', COALESCE(v_tiempo_promedio, 0),
    'porcentaje_finalizacion', COALESCE(v_porcentaje_finalizacion, 0),
    'avance_promedio', COALESCE(v_avance_promedio, 0)
  );

  RETURN v_result;
END;
$$;

-- =====================================================
-- PERMISOS
-- =====================================================

GRANT SELECT ON tramites_reportes_view TO authenticated;
GRANT SELECT ON tramites_productividad_usuario TO authenticated;
GRANT SELECT ON tramites_productividad_oficina TO authenticated;
GRANT EXECUTE ON FUNCTION get_tramites_kpis TO authenticated;

-- =====================================================
-- ÍNDICES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_tickets_progress_percent ON tickets(progress_percent);
CREATE INDEX IF NOT EXISTS idx_tickets_fecha_creacion ON tickets(fecha_creacion);
CREATE INDEX IF NOT EXISTS idx_tickets_tipo_tramite ON tickets(tipo_tramite);
CREATE INDEX IF NOT EXISTS idx_ticket_asignaciones_ticket ON ticket_asignaciones(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_asignaciones_ejecutivo ON ticket_asignaciones(ejecutivo_id);
