/*
  # Fix Tramites Reportes - Productividad y Asignaciones

  1. Correcciones
    - Mejorar la vista tramites_reportes_view para mostrar correctamente asignado y oficina
    - Corregir las vistas de productividad por usuario y oficina
    - Asegurar que solo se cuenten trámites asignados al usuario correcto
    - Filtrar correctamente por oficina del ejecutivo asignado

  2. Security
    - Mantiene las políticas RLS existentes
*/

-- =====================================================
-- VISTA CORREGIDA: tramites_reportes_view
-- =====================================================

DROP VIEW IF EXISTS tramites_reportes_view CASCADE;

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

  -- Estatus calculado
  CASE
    WHEN COALESCE(t.progress_percent, 0) = 0 THEN 'Pendiente'
    WHEN t.progress_percent = 100 THEN 'Finalizado'
    ELSE 'En Proceso'
  END as estatus_calculado,

  t.cerrado_en as fecha_finalizacion,

  -- Tiempo de resolución
  CASE
    WHEN t.cerrado_en IS NOT NULL THEN
      EXTRACT(EPOCH FROM (t.cerrado_en - t.fecha_creacion)) / 86400.0
    ELSE NULL
  END as tiempo_resolucion_dias,

  -- Información del solicitante
  solicitante.id as solicitante_id,
  solicitante.nombre_completo as solicitante_nombre,
  solicitante.oficina_id as solicitante_oficina_id,

  -- Información del asignado (última asignación)
  asignado.id as asignado_id,
  asignado.nombre_completo as asignado_nombre,
  asignado.oficina_id as asignado_oficina_id,

  -- Nombre de la oficina del asignado
  oficina_asignado.nombre as oficina_nombre,

  -- Estatus del ticket
  estatus.nombre as estatus_nombre

FROM tickets t
LEFT JOIN usuarios solicitante ON t.creado_por = solicitante.id
LEFT JOIN ticket_estatus estatus ON t.estatus_id = estatus.id

-- Obtener la última asignación del ticket
LEFT JOIN LATERAL (
  SELECT DISTINCT ON (ta.ticket_id)
    u.id,
    u.nombre_completo,
    u.oficina_id
  FROM ticket_asignaciones ta
  JOIN usuarios u ON ta.ejecutivo_id = u.id
  WHERE ta.ticket_id = t.id
  ORDER BY ta.ticket_id, ta.asignado_en DESC
) asignado ON true

-- Oficina del usuario asignado
LEFT JOIN oficinas oficina_asignado ON asignado.oficina_id = oficina_asignado.id;

-- =====================================================
-- VISTA CORREGIDA: Productividad por usuario
-- =====================================================

DROP VIEW IF EXISTS tramites_productividad_usuario CASCADE;

CREATE OR REPLACE VIEW tramites_productividad_usuario AS
WITH ultima_asignacion AS (
  SELECT DISTINCT ON (ta.ticket_id)
    ta.ticket_id,
    ta.ejecutivo_id,
    ta.asignado_en
  FROM ticket_asignaciones ta
  ORDER BY ta.ticket_id, ta.asignado_en DESC
)
SELECT
  u.id as usuario_id,
  u.nombre_completo,
  u.oficina_id,
  o.nombre as oficina_nombre,

  -- Total de trámites asignados a este usuario (última asignación)
  COUNT(DISTINCT t.id) as total_tramites,

  -- Trámites pendientes (avance = 0)
  COUNT(DISTINCT CASE WHEN COALESCE(t.progress_percent, 0) = 0 THEN t.id END) as tramites_pendientes,

  -- Trámites en proceso (avance > 0 y < 100)
  COUNT(DISTINCT CASE
    WHEN t.progress_percent > 0 AND t.progress_percent < 100 THEN t.id
  END) as tramites_en_proceso,

  -- Trámites finalizados (avance = 100)
  COUNT(DISTINCT CASE WHEN t.progress_percent = 100 THEN t.id END) as tramites_finalizados,

  -- Avance promedio
  COALESCE(ROUND(AVG(COALESCE(t.progress_percent, 0)), 2), 0) as avance_promedio,

  -- Tiempo promedio de resolución (solo finalizados)
  COALESCE(ROUND(AVG(
    CASE
      WHEN t.cerrado_en IS NOT NULL THEN
        EXTRACT(EPOCH FROM (t.cerrado_en - t.fecha_creacion)) / 86400.0
      ELSE NULL
    END
  ), 2), 0) as tiempo_promedio_resolucion_dias,

  -- Porcentaje de finalización
  COALESCE(ROUND(
    (COUNT(DISTINCT CASE WHEN t.progress_percent = 100 THEN t.id END)::numeric /
    NULLIF(COUNT(DISTINCT t.id), 0) * 100), 2
  ), 0) as porcentaje_finalizacion

FROM usuarios u
LEFT JOIN oficinas o ON u.oficina_id = o.id
LEFT JOIN ultima_asignacion ua ON ua.ejecutivo_id = u.id
LEFT JOIN tickets t ON ua.ticket_id = t.id
WHERE u.estado = 'activo'
GROUP BY u.id, u.nombre_completo, u.oficina_id, o.nombre
HAVING COUNT(DISTINCT t.id) > 0;

-- =====================================================
-- VISTA CORREGIDA: Productividad por oficina
-- =====================================================

DROP VIEW IF EXISTS tramites_productividad_oficina CASCADE;

CREATE OR REPLACE VIEW tramites_productividad_oficina AS
WITH ultima_asignacion AS (
  SELECT DISTINCT ON (ta.ticket_id)
    ta.ticket_id,
    ta.ejecutivo_id,
    ta.asignado_en
  FROM ticket_asignaciones ta
  ORDER BY ta.ticket_id, ta.asignado_en DESC
)
SELECT
  o.id as oficina_id,
  o.nombre as oficina_nombre,

  -- Total de trámites asignados a usuarios de esta oficina
  COUNT(DISTINCT t.id) as total_tramites,

  -- Trámites pendientes
  COUNT(DISTINCT CASE WHEN COALESCE(t.progress_percent, 0) = 0 THEN t.id END) as tramites_pendientes,

  -- Trámites en proceso
  COUNT(DISTINCT CASE
    WHEN t.progress_percent > 0 AND t.progress_percent < 100 THEN t.id
  END) as tramites_en_proceso,

  -- Trámites finalizados
  COUNT(DISTINCT CASE WHEN t.progress_percent = 100 THEN t.id END) as tramites_finalizados,

  -- Avance promedio
  COALESCE(ROUND(AVG(COALESCE(t.progress_percent, 0)), 2), 0) as avance_promedio,

  -- Tiempo promedio de resolución
  COALESCE(ROUND(AVG(
    CASE
      WHEN t.cerrado_en IS NOT NULL THEN
        EXTRACT(EPOCH FROM (t.cerrado_en - t.fecha_creacion)) / 86400.0
      ELSE NULL
    END
  ), 2), 0) as tiempo_promedio_resolucion_dias,

  -- Porcentaje de finalización
  COALESCE(ROUND(
    (COUNT(DISTINCT CASE WHEN t.progress_percent = 100 THEN t.id END)::numeric /
    NULLIF(COUNT(DISTINCT t.id), 0) * 100), 2
  ), 0) as porcentaje_finalizacion,

  -- Usuarios activos que tienen trámites asignados
  COUNT(DISTINCT u.id) as usuarios_activos

FROM oficinas o
LEFT JOIN usuarios u ON u.oficina_id = o.id AND u.estado = 'activo'
LEFT JOIN ultima_asignacion ua ON ua.ejecutivo_id = u.id
LEFT JOIN tickets t ON ua.ticket_id = t.id
WHERE o.activa = true
GROUP BY o.id, o.nombre
HAVING COUNT(DISTINCT t.id) > 0;

-- =====================================================
-- COMENTARIOS
-- =====================================================

COMMENT ON VIEW tramites_reportes_view IS 'Vista detallada de todos los trámites con información de asignación y oficina correcta';
COMMENT ON VIEW tramites_productividad_usuario IS 'Productividad por usuario basada en la última asignación de cada ticket';
COMMENT ON VIEW tramites_productividad_oficina IS 'Productividad por oficina basada en usuarios activos y última asignación';
