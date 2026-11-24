-- Agrega la columna es_primario a maestro_agentes para marcar la oficina principal
-- cuando un vendedor aparece en múltiples despachos
ALTER TABLE maestro_agentes ADD COLUMN IF NOT EXISTS es_primario boolean NOT NULL DEFAULT true;
