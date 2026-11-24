/*
  # Arreglar Vistas SICAS - Eliminar Tablas Antiguas

  1. Propósito
    - Eliminar tablas antiguas que bloquean la creación de vistas
    - Crear vistas correctas que mapean a tablas espejo

  2. Cambios
    - DROP TABLE para `sicas_polizas_vigentes` y `sicas_cobranza_pendiente`
    - CREATE VIEW para mapear correctamente a `sicas_documents` y `sicas_receivables`
*/

-- Eliminar tablas antiguas
DROP TABLE IF EXISTS sicas_polizas_vigentes CASCADE;
DROP TABLE IF EXISTS sicas_cobranza_pendiente CASCADE;

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
  vend_nombre,
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
  vend_nombre,
  created_at,
  updated_at
FROM sicas_receivables
WHERE estatus = 'pendiente';

-- =====================================================
-- Recrear Vistas Existentes (por si fueron eliminadas por CASCADE)
-- =====================================================
DROP VIEW IF EXISTS sicas_renovaciones_proximas CASCADE;
CREATE VIEW sicas_renovaciones_proximas AS
SELECT
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
  vend_nombre
FROM sicas_documents
WHERE vigencia_hasta >= CURRENT_DATE
  AND vigencia_hasta <= CURRENT_DATE + INTERVAL '90 days';

DROP VIEW IF EXISTS sicas_emitidas_mes_actual CASCADE;
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
  vend_nombre,
  fecha_captura,
  created_at,
  updated_at
FROM sicas_documents
WHERE EXTRACT(YEAR FROM fecha_captura) = EXTRACT(YEAR FROM CURRENT_DATE)
  AND EXTRACT(MONTH FROM fecha_captura) = EXTRACT(MONTH FROM CURRENT_DATE);

-- =====================================================
-- PERMISOS
-- =====================================================

-- Permitir acceso a las vistas para usuarios autenticados
GRANT SELECT ON sicas_polizas_vigentes TO authenticated;
GRANT SELECT ON sicas_cobranza_pendiente TO authenticated;
GRANT SELECT ON sicas_renovaciones_proximas TO authenticated;
GRANT SELECT ON sicas_emitidas_mes_actual TO authenticated;

-- Service role tiene acceso completo
GRANT ALL ON sicas_polizas_vigentes TO service_role;
GRANT ALL ON sicas_cobranza_pendiente TO service_role;
GRANT ALL ON sicas_renovaciones_proximas TO service_role;
GRANT ALL ON sicas_emitidas_mes_actual TO service_role;
