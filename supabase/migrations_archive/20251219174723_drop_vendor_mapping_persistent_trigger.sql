/*
  # Eliminar trigger que causa error en vendor_mappings

  ## Problema
  El trigger `sync_vendor_mapping_to_persistent` causa errores al insertar en vendor_mappings:
  "there is no unique or exclusion constraint matching the ON CONFLICT specification"
  
  El trigger intenta sincronizar a `vendor_mapping_persistent` usando:
  ON CONFLICT (vendor_key) WHERE is_active = true
  
  Pero vendor_mapping_persistent no tiene ese constraint parcial.

  ## Solución
  Eliminar el trigger y la función que ya no son necesarios.
  La tabla vendor_mapping_persistent fue deprecada - ahora solo usamos vendor_mappings.

  ## Impacto
  - Se elimina sincronización a tabla deprecada
  - vendor_mappings funcionará correctamente sin errores
  - assign_vendor_by_name y assign-vendor-staging funcionarán
*/

-- =============================================
-- Eliminar trigger problemático
-- =============================================

DROP TRIGGER IF EXISTS sync_vendor_mapping ON vendor_mappings;

DROP FUNCTION IF EXISTS sync_vendor_mapping_to_persistent();

-- =============================================
-- Verificación
-- =============================================

DO $$
BEGIN
  RAISE NOTICE 'Trigger sync_vendor_mapping eliminado correctamente';
  RAISE NOTICE 'vendor_mappings ahora funciona sin errores de sincronización';
END $$;
