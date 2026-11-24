/*
  # Sincronizar régimen fiscal entre commission_agents y usuarios

  1. Trigger automático
    - Al crear/actualizar commission_agent, sincroniza fiscal_regime_id desde usuario
    - Garantiza que el régimen fiscal esté actualizado

  2. Backfill
    - Sincroniza todos los agentes existentes con el régimen de su usuario

  3. Índices
    - Mejora rendimiento de búsquedas por régimen fiscal
*/

-- Función para sincronizar régimen fiscal desde usuario a commission_agent
CREATE OR REPLACE FUNCTION sync_agent_fiscal_regime_from_usuario()
RETURNS TRIGGER AS $$
DECLARE
  v_usuario_regimen_id uuid;
BEGIN
  -- Si el agent tiene usuario_id, obtener su régimen fiscal
  IF NEW.usuario_id IS NOT NULL THEN
    SELECT regimen_fiscal_id INTO v_usuario_regimen_id
    FROM usuarios
    WHERE id = NEW.usuario_id;

    -- Si el usuario tiene régimen fiscal, sincronizarlo
    IF v_usuario_regimen_id IS NOT NULL THEN
      NEW.fiscal_regime_id := v_usuario_regimen_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear trigger BEFORE INSERT/UPDATE en commission_agents
DROP TRIGGER IF EXISTS trigger_sync_agent_fiscal_regime ON commission_agents;

CREATE TRIGGER trigger_sync_agent_fiscal_regime
  BEFORE INSERT OR UPDATE OF usuario_id ON commission_agents
  FOR EACH ROW
  EXECUTE FUNCTION sync_agent_fiscal_regime_from_usuario();

-- Backfill: Sincronizar todos los agentes existentes
UPDATE commission_agents ca
SET fiscal_regime_id = u.regimen_fiscal_id
FROM usuarios u
WHERE ca.usuario_id = u.id
  AND u.regimen_fiscal_id IS NOT NULL
  AND (ca.fiscal_regime_id IS NULL OR ca.fiscal_regime_id != u.regimen_fiscal_id);

-- Crear índice para búsquedas por régimen fiscal en commission_agents
CREATE INDEX IF NOT EXISTS idx_commission_agents_fiscal_regime_id 
  ON commission_agents(fiscal_regime_id);

-- Crear índice compuesto para búsquedas de agentes por usuario y régimen
CREATE INDEX IF NOT EXISTS idx_commission_agents_usuario_regime 
  ON commission_agents(usuario_id, fiscal_regime_id);
