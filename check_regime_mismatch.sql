-- ============================================================================
-- Diagnóstico: Usuarios con régimen fiscal incorrecto en PDFs
-- ============================================================================

-- 1. Ver todos los regímenes disponibles
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
  cfr.name as regimen_actual,
  u.rol
FROM usuarios u
LEFT JOIN commission_fiscal_regimes cfr ON cfr.id = u.regimen_fiscal_id
WHERE u.rol IN ('Administrador', 'Agente', 'Gerente')
  AND u.deleted_at IS NULL
ORDER BY u.nombre, u.apellidos;

-- 3. Ver lotes con DESAJUSTE entre régimen del usuario y régimen del batch
SELECT
  cb.id as batch_id,
  u.nombre || ' ' || u.apellidos as agente,
  cfr.name as regimen_usuario_actual,
  cb.regimen_fiscal as regimen_en_batch,
  cb.commission_total,
  cb.ret_isr,
  cb.iva,
  cb.ret_iva,
  cb.total_neto,
  cb.tax_version,
  cb.calculated_at,
  cb.created_at,
  CASE
    WHEN UPPER(cb.regimen_fiscal) = UPPER(cfr.name) THEN 'OK'
    ELSE 'DESAJUSTE - NECESITA RECALCULO'
  END as estado
FROM commission_batches cb
JOIN usuarios u ON u.id = cb.usuario_id
LEFT JOIN commission_fiscal_regimes cfr ON cfr.id = u.regimen_fiscal_id
WHERE cb.created_at > NOW() - INTERVAL '30 days'
  AND u.deleted_at IS NULL
ORDER BY cb.created_at DESC;

-- 4. Usuarios que NO tienen régimen fiscal asignado
SELECT
  u.id,
  u.nombre,
  u.apellidos,
  u.email_laboral,
  u.rol,
  u.regimen_fiscal_id,
  'SIN REGIMEN - SE USARA HONORARIOS POR DEFECTO' as observacion
FROM usuarios u
WHERE u.regimen_fiscal_id IS NULL
  AND u.rol IN ('Agente', 'Gerente', 'Administrador')
  AND u.deleted_at IS NULL
ORDER BY u.nombre;

-- 5. Ver cálculos fiscales comparando HONORARIOS vs RESICO para el mismo monto
-- Esto ayuda a identificar si los cálculos son los correctos
WITH ejemplo AS (
  SELECT 10000 as base_comision
)
SELECT
  'HONORARIOS' as regimen,
  base_comision,
  ROUND(base_comision * 0.16, 2) as iva,
  ROUND((base_comision + base_comision * 0.16) * 0.10, 2) as ret_isr,
  ROUND((base_comision * 0.16) * (2.0/3.0), 2) as ret_iva,
  ROUND((base_comision + base_comision * 0.16) - ((base_comision + base_comision * 0.16) * 0.10) - ((base_comision * 0.16) * (2.0/3.0)), 2) as total_neto
FROM ejemplo
UNION ALL
SELECT
  'RESICO' as regimen,
  base_comision,
  ROUND(base_comision * 0.16, 2) as iva,
  ROUND((base_comision + base_comision * 0.16) * 0.0125, 2) as ret_isr,
  ROUND((base_comision * 0.16) * (2.0/3.0), 2) as ret_iva,
  ROUND((base_comision + base_comision * 0.16) - ((base_comision + base_comision * 0.16) * 0.0125) - ((base_comision * 0.16) * (2.0/3.0)), 2) as total_neto
FROM ejemplo;

-- 6. ACCION: Asignar HONORARIOS a usuarios sin régimen fiscal
-- Descomenta para ejecutar:
-- UPDATE usuarios
-- SET regimen_fiscal_id = (SELECT id FROM commission_fiscal_regimes WHERE name = 'HONORARIOS')
-- WHERE regimen_fiscal_id IS NULL
--   AND rol IN ('Agente', 'Gerente', 'Administrador')
--   AND deleted_at IS NULL;

-- 7. ACCION: Recalcular todos los lotes con desajuste
-- Descomenta para ejecutar:
-- SELECT * FROM recalculate_all_commission_batches();
