/*
  # Habilitar trigger de notificaciones de documentos en trámites
  
  El trigger estaba deshabilitado. Lo activamos para que envíe notificaciones
  cuando se suban documentos a los trámites.
*/

-- Habilitar el trigger
ALTER TABLE ticket_archivos 
  ENABLE TRIGGER trigger_notificar_documento_tramite;

-- Verificar que está habilitado
DO $$
DECLARE
  v_enabled char;
BEGIN
  SELECT tgenabled INTO v_enabled
  FROM pg_trigger
  WHERE tgname = 'trigger_notificar_documento_tramite';
  
  IF v_enabled = 'O' THEN
    RAISE NOTICE '✅ Trigger trigger_notificar_documento_tramite está HABILITADO';
  ELSE
    RAISE WARNING '❌ Trigger trigger_notificar_documento_tramite está DESHABILITADO (status: %)', v_enabled;
  END IF;
END $$;
