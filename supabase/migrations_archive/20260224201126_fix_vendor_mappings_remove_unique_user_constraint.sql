/*
  # Fix Vendor Mappings - Remove Unique User Constraint

  1. Problem
    - El constraint `idx_vendor_mappings_unique_active_user` impide que un usuario tenga múltiples mapeos activos
    - Esto es incorrecto porque un usuario como honorarios@jiro.mx necesita mapear múltiples nombres de vendedores
    
  2. Changes
    - Eliminar el índice único `idx_vendor_mappings_unique_active_user`
    - Mantener el índice único `idx_vendor_mappings_unique_active_source` que es el correcto
      (un nombre de vendedor solo puede mapear a un usuario)
    
  3. Security
    - No hay cambios de seguridad, solo estructura de índices
*/

-- Eliminar el constraint incorrecto que impide múltiples mapeos por usuario
DROP INDEX IF EXISTS idx_vendor_mappings_unique_active_user;

COMMENT ON TABLE vendor_mappings IS 
'Mapeos de vendedores. Un source (email/nombre) solo puede mapear a un usuario (unique en source_type+source_value), pero un usuario puede tener múltiples sources mapeados.';
