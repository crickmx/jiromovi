-- Agregar fecha_promesa_entrega a tickets
-- La única fecha editable manualmente en el flujo de trámites.
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS fecha_promesa_entrega DATE;

COMMENT ON COLUMN tickets.fecha_promesa_entrega IS 'Fecha límite prometida de entrega/resolución del trámite. Editable manualmente por el responsable.';

CREATE INDEX IF NOT EXISTS idx_tickets_fecha_promesa
  ON tickets(fecha_promesa_entrega)
  WHERE fecha_promesa_entrega IS NOT NULL;
