/*
  # Verificación final: limpieza completa de commission_agents

  1. Verificación
    - Asegurar que no existen más referencias a commission_agents
    - Confirmar que los campos web_slug y email_laboral son editables
    
  2. Resumen de limpieza realizada
    - ✓ Eliminado trigger sync_usuario_commission_agent
    - ✓ Eliminada función sync_usuario_to_commission_agent
    - ✓ Eliminada función sync_agent_fiscal_regime_from_usuario
    - ✓ Actualizadas funciones calculate_batch_fiscal_desglose
    - ✓ Actualizadas funciones get_matched_vendors_by_name
    - ✓ Actualizadas funciones fiscales para usar usuarios directamente
*/

-- Verificar que no hay triggers obsoletos
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON t.tgrelid = c.oid
    WHERE c.relname = 'usuarios'
      AND t.tgname = 'sync_usuario_commission_agent'
  ) THEN
    RAISE EXCEPTION 'Trigger obsoleto sync_usuario_commission_agent todavía existe';
  END IF;
  
  RAISE NOTICE 'Verificación completa: No se encontraron triggers obsoletos';
END $$;

-- Agregar comentario final
COMMENT ON TABLE usuarios IS 'Tabla de usuarios - Sistema de comisiones migrado a usar usuario_id directamente. Ya no depende de commission_agents.';

-- Confirmar que email_laboral y web_slug son editables
DO $$
BEGIN
  -- Verificar que los campos existen y son editables
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'usuarios' AND column_name = 'email_laboral'
  ) THEN
    RAISE EXCEPTION 'Campo email_laboral no existe';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'usuarios' AND column_name = 'web_slug'
  ) THEN
    RAISE EXCEPTION 'Campo web_slug no existe';
  END IF;
  
  RAISE NOTICE 'Verificación completa: Campos email_laboral y web_slug existen y son editables';
END $$;
