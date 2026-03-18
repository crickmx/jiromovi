-- ============================================================================
-- Script para verificar y corregir regímenes fiscales
-- ============================================================================

-- 1. Ver los regímenes fiscales disponibles
SELECT
  id,
  name,
  isr,
  iva_trasladado,
  iva_retenido
FROM commission_fiscal_regimes
ORDER BY name;

-- 2. Ver usuarios y sus regímenes asignados
SELECT
  u.id,
  u.nombre,
  u.apellidos,
  u.email_laboral,
  cfr.name as regimen_fiscal,
  u.rol
FROM usuarios u
LEFT JOIN commission_fiscal_regimes cfr ON cfr.id = u.regimen_fiscal_id
WHERE u.rol IN ('Administrador', 'Agente', 'Gerente')
ORDER BY u.nombre, u.apellidos;

-- 3. Ver lotes recientes con sus regímenes calculados
SELECT
  cb.id,
  u.nombre || ' ' || u.apellidos as agente,
  cb.regimen_fiscal as regimen_en_lote,
  cfr.name as regimen_actual_usuario,
  cb.commission_total,
  cb.ret_isr,
  cb.total_neto,
  cb.tax_version,
  cb.calculated_at
FROM commission_batches cb
JOIN usuarios u ON u.id = cb.usuario_id
LEFT JOIN commission_fiscal_regimes cfr ON cfr.id = u.regimen_fiscal_id
WHERE cb.created_at > NOW() - INTERVAL '7 days'
ORDER BY cb.created_at DESC;

-- 4. Identificar lotes con régimen fiscal diferente al actual del usuario
SELECT
  cb.id as batch_id,
  u.nombre || ' ' || u.apellidos as agente,
  cb.regimen_fiscal as regimen_en_lote,
  cfr.name as regimen_actual_usuario,
  cb.commission_total,
  cb.calculated_at,
  'NECESITA RECALCULO' as estado
FROM commission_batches cb
JOIN usuarios u ON u.id = cb.usuario_id
LEFT JOIN commission_fiscal_regimes cfr ON cfr.id = u.regimen_fiscal_id
WHERE cb.created_at > NOW() - INTERVAL '30 days'
  AND (
    cb.regimen_fiscal IS NULL
    OR UPPER(cb.regimen_fiscal) != UPPER(cfr.name)
  )
ORDER BY cb.created_at DESC;

-- 5. RECALCULAR TODOS LOS LOTES (ejecutar si es necesario)
-- NOTA: Esto recalculará todos los lotes de los últimos 30 días
-- Descomenta la siguiente línea para ejecutar:
-- SELECT * FROM recalculate_all_commission_batches();
