/*
  # Deshabilitar temporalmente trigger de notificación de documentos
  
  El trigger causa errores de GROUP BY al intentar obtener los adjuntos.
  Lo deshabilitamos temporalmente mientras investigamos la causa raíz.
*/

-- Deshabilitar el trigger que causa el problema
ALTER TABLE ticket_archivos 
  DISABLE TRIGGER trigger_notificar_documento_tramite;

COMMENT ON TRIGGER trigger_notificar_documento_tramite ON ticket_archivos IS
  'DESHABILITADO TEMPORALMENTE - Causa error GROUP BY en INSERT';
