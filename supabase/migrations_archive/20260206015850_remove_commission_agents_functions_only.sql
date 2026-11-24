/*
  # Eliminar funciones obsoletas de commission_agents

  1. Problema
    - Existen funciones que intentan acceder a commission_agents
    - La tabla commission_agents ya no existe
    
  2. Solución
    - Eliminar función de sync fiscal regime
*/

-- Eliminar función de sync fiscal regime
DROP FUNCTION IF EXISTS sync_agent_fiscal_regime_from_usuario() CASCADE;

COMMENT ON TABLE usuarios IS 'Tabla de usuarios - todas las funciones de comisiones ahora se manejan directamente con usuario_id';
