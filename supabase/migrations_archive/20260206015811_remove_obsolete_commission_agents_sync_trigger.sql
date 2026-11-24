/*
  # Eliminar trigger obsoleto de sync con commission_agents

  1. Problema
    - El trigger sync_usuario_commission_agent intenta sincronizar con commission_agents
    - La tabla commission_agents ya no existe
    - Esto causa errores al editar usuarios
    
  2. Solución
    - Eliminar el trigger sync_usuario_commission_agent
    - Eliminar la función sync_usuario_to_commission_agent
*/

-- Eliminar trigger
DROP TRIGGER IF EXISTS sync_usuario_commission_agent ON usuarios;

-- Eliminar función
DROP FUNCTION IF EXISTS sync_usuario_to_commission_agent() CASCADE;

COMMENT ON TABLE usuarios IS 'Tabla de usuarios - ya no sincroniza con commission_agents (eliminada)';
