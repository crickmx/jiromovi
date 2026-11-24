/*
  # Arreglar Vistas SICAS - Agregar Columnas Faltantes

  1. Propósito
    - Agregar todas las columnas que el frontend espera
    - Mapear correctamente desde sicas_documents

  2. Cambios
    - Recrear vistas con todos los campos requeridos
*/

-- Eliminar vistas existentes
DROP VIEW IF EXISTS sicas_polizas_vigentes CASCADE;
DROP VIEW IF EXISTS sicas_cobranza_pendiente CASCADE;
DROP VIEW IF EXISTS sicas_renovaciones_proximas CASCADE;
DROP VIEW IF EXISTS sicas_emitidas_mes_actual CASCADE;

-- =====================================================
-- VISTA: Pólizas Vigentes
-- =====================================================
CREATE VIEW sicas_polizas_vigentes AS
SELECT
  id,
  id_docto as id_documento,
  poliza as no_poliza,
  compania as aseguradora,
  ramo,
  subramo,
  cliente as contratante,
  cliente as asegurado,
  vigencia_desde,
  vigencia_hasta,
  prima_neta,
  importe as prima_total,
  usuario_id,
  oficina_id,
  vend_id,
  vend_nombre,
  desp_nombre,
  oficina_id as desp_id,
  synced_at,
  created_at,
  updated_at
FROM sicas_documents
WHERE vigencia_hasta >= CURRENT_DATE;

-- =====================================================
-- VISTA: Cobranza Pendiente
-- =====================================================
CREATE VIEW sicas_cobranza_pendiente AS
SELECT
  id,
  cliente,
  poliza as no_poliza,
  id_docto as id_documento,
  importe_pendiente,
  fecha_limite,
  dias_vencido as dias_vencidos,
  estatus as status,
  usuario_id,
  oficina_id,
  vend_id,
  vend_nombre,
  created_at,
  updated_at
FROM sicas_receivables
WHERE estatus = 'pendiente';

-- =====================================================
-- VISTA: Renovaciones Próximas
-- =====================================================
CREATE VIEW sicas_renovaciones_proximas AS
SELECT
  id,
  id_docto as id_documento,
  poliza as no_poliza,
  compania as aseguradora,
  ramo,
  cliente as contratante,
  vigencia_hasta,
  importe as prima_total,
  EXTRACT(DAY FROM (vigencia_hasta - CURRENT_DATE))::integer as dias_para_vencer,
  CASE
    WHEN vigencia_hasta <= CURRENT_DATE THEN 'Vencida'
    WHEN vigencia_hasta <= CURRENT_DATE + INTERVAL '7 days' THEN 'Urgente'
    WHEN vigencia_hasta <= CURRENT_DATE + INTERVAL '30 days' THEN 'Alta'
    WHEN vigencia_hasta <= CURRENT_DATE + INTERVAL '60 days' THEN 'Media'
    ELSE 'Baja'
  END as prioridad_renovacion,
  usuario_id,
  oficina_id,
  vend_id,
  vend_nombre
FROM sicas_documents
WHERE vigencia_hasta >= CURRENT_DATE
  AND vigencia_hasta <= CURRENT_DATE + INTERVAL '90 days';

-- =====================================================
-- VISTA: Emisiones del Mes Actual
-- =====================================================
CREATE VIEW sicas_emitidas_mes_actual AS
SELECT
  id,
  id_docto as id_documento,
  poliza as no_poliza,
  compania as aseguradora,
  ramo,
  cliente as contratante,
  vigencia_desde,
  importe as prima_total,
  usuario_id,
  oficina_id,
  vend_id,
  vend_nombre,
  fecha_captura,
  synced_at,
  created_at,
  updated_at
FROM sicas_documents
WHERE EXTRACT(YEAR FROM fecha_captura) = EXTRACT(YEAR FROM CURRENT_DATE)
  AND EXTRACT(MONTH FROM fecha_captura) = EXTRACT(MONTH FROM CURRENT_DATE);

-- =====================================================
-- PERMISOS
-- =====================================================
GRANT SELECT ON sicas_polizas_vigentes TO authenticated;
GRANT SELECT ON sicas_cobranza_pendiente TO authenticated;
GRANT SELECT ON sicas_renovaciones_proximas TO authenticated;
GRANT SELECT ON sicas_emitidas_mes_actual TO authenticated;

GRANT ALL ON sicas_polizas_vigentes TO service_role;
GRANT ALL ON sicas_cobranza_pendiente TO service_role;
GRANT ALL ON sicas_renovaciones_proximas TO service_role;
GRANT ALL ON sicas_emitidas_mes_actual TO service_role;
