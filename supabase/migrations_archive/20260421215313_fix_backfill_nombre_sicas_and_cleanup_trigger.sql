/*
  # Backfill nombre_sicas and cleanup duplicate sync trigger

  1. Data Fix
    - Backfill `usuarios.nombre_sicas` for users that have `id_sicas` set but `nombre_sicas` is NULL
    - Uses the name from `sicas_catalogos` (catalog_type_id=32) as the source
  
  2. Cleanup
    - Remove duplicate trigger `trigger_sync_sicas_mapping_to_vendor` (same function as
      `trigger_sync_sicas_mapping_to_vendor_mappings`, both fire on the same table)
*/

-- Backfill nombre_sicas from sicas_catalogos for users missing it
UPDATE usuarios u
SET nombre_sicas = sc.nombre
FROM sicas_catalogos sc
WHERE u.id_sicas IS NOT NULL
  AND u.nombre_sicas IS NULL
  AND sc.catalog_type_id = 32
  AND sc.id_sicas = u.id_sicas;

-- Remove duplicate trigger (keeps trigger_sync_sicas_mapping_to_vendor_mappings)
DROP TRIGGER IF EXISTS trigger_sync_sicas_mapping_to_vendor ON sicas_mapeo_vendedor_usuario;
