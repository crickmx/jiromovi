/*
  # Disable problematic notification trigger temporarily
  
  1. Changes
    - Disable trigger_notificar_documento_tramite to avoid RLS policy conflicts
    - This trigger was causing "set-returning functions not allowed in WHERE" errors
*/

-- Disable the trigger temporarily
DROP TRIGGER IF EXISTS trigger_notificar_documento_tramite ON ticket_archivos;

-- Keep the function for future use
COMMENT ON FUNCTION notificar_documento_tramite() IS 
'Disabled temporarily due to RLS policy conflicts during INSERT operations. 
To re-enable: CREATE TRIGGER trigger_notificar_documento_tramite AFTER INSERT ON ticket_archivos FOR EACH ROW EXECUTE FUNCTION notificar_documento_tramite();';
