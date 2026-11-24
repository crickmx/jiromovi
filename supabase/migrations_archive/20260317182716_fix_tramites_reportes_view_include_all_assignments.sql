/*
  # Fix Tramites Reportes View - Incluir todos los campos de asignación

  1. Correcciones
    - Actualizar vista para considerar assigned_to_user_id, agente_id y ticket_asignaciones
    - Priorizar assigned_to_user_id > agente_id > ticket_asignaciones
    - Asegurar que progress_percent se muestre correctamente como "avance"
    - Incluir oficina del usuario asignado

  2. Campos corregidos
    - asignado_id: ID del usuario asignado
    - asignado_nombre: Nombre completo del usuario asignado
    - oficina_nombre: Nombre de la oficina del usuario asignado
    - avance: Porcentaje de progreso (progress_percent)
*/

-- Eliminar vista actual
DROP VIEW IF EXISTS tramites_reportes_view CASCADE;

-- Crear vista mejorada
CREATE OR REPLACE VIEW tramites_reportes_view AS
SELECT 
  t.id,
  t.folio,
  t.tipo_tramite,
  t.prioridad,
  t.instrucciones,
  t.poliza,
  t.fecha_creacion AS fecha_solicitud,
  
  -- Avance (progress_percent)
  COALESCE(t.progress_percent, 0) AS avance,
  
  -- Estatus calculado basado en progress_percent
  CASE
    WHEN COALESCE(t.progress_percent, 0) = 0 THEN 'Pendiente'
    WHEN t.progress_percent = 100 THEN 'Finalizado'
    ELSE 'En Proceso'
  END AS estatus_calculado,
  
  t.cerrado_en AS fecha_finalizacion,
  
  -- Tiempo de resolución en días
  CASE 
    WHEN t.cerrado_en IS NOT NULL 
    THEN EXTRACT(EPOCH FROM (t.cerrado_en - t.fecha_creacion)) / 86400.0
    ELSE NULL
  END AS tiempo_resolucion_dias,
  
  -- Solicitante
  solicitante.id AS solicitante_id,
  solicitante.nombre_completo AS solicitante_nombre,
  solicitante.oficina_id AS solicitante_oficina_id,
  
  -- Asignado (con prioridad: assigned_to_user_id > agente_id > ticket_asignaciones)
  COALESCE(
    asignado_directo.id,
    asignado_agente.id,
    asignado_tabla.id
  ) AS asignado_id,
  
  COALESCE(
    asignado_directo.nombre_completo,
    asignado_agente.nombre_completo,
    asignado_tabla.nombre_completo
  ) AS asignado_nombre,
  
  COALESCE(
    asignado_directo.oficina_id,
    asignado_agente.oficina_id,
    asignado_tabla.oficina_id
  ) AS asignado_oficina_id,
  
  -- Oficina del asignado
  oficina_asignado.nombre AS oficina_nombre,
  
  -- Estatus
  estatus.nombre AS estatus_nombre
  
FROM tickets t

-- Join con solicitante
LEFT JOIN usuarios solicitante ON t.creado_por = solicitante.id

-- Join con estatus
LEFT JOIN ticket_estatus estatus ON t.estatus_id = estatus.id

-- Join con assigned_to_user_id (prioridad 1)
LEFT JOIN usuarios asignado_directo ON t.assigned_to_user_id = asignado_directo.id

-- Join con agente_id (prioridad 2)
LEFT JOIN usuarios asignado_agente ON t.agente_id = asignado_agente.id

-- Join con ticket_asignaciones (prioridad 3)
LEFT JOIN LATERAL (
  SELECT DISTINCT ON (ta.ticket_id)
    u.id,
    u.nombre_completo,
    u.oficina_id
  FROM ticket_asignaciones ta
  JOIN usuarios u ON ta.ejecutivo_id = u.id
  WHERE ta.ticket_id = t.id
  ORDER BY ta.ticket_id, ta.asignado_en DESC
) asignado_tabla ON true

-- Join con oficina del asignado
LEFT JOIN oficinas oficina_asignado ON 
  COALESCE(
    asignado_directo.oficina_id,
    asignado_agente.oficina_id,
    asignado_tabla.oficina_id
  ) = oficina_asignado.id;

COMMENT ON VIEW tramites_reportes_view IS 
'Vista consolidada de trámites con información de asignación (prioriza assigned_to_user_id, luego agente_id, luego ticket_asignaciones), oficina y avance';

-- Otorgar permisos
GRANT SELECT ON tramites_reportes_view TO authenticated;
