-- Soft delete for tickets (tramites)
ALTER TABLE tickets
  ADD COLUMN IF NOT EXISTS eliminado_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS eliminado_por UUID REFERENCES usuarios(id);

-- Soft delete for ticket_archivos
ALTER TABLE ticket_archivos
  ADD COLUMN IF NOT EXISTS eliminado_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS eliminado_por UUID REFERENCES usuarios(id);

-- Indexes for fast papelera queries
CREATE INDEX IF NOT EXISTS idx_tickets_eliminado_at
  ON tickets(eliminado_at) WHERE eliminado_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ticket_archivos_eliminado_at
  ON ticket_archivos(eliminado_at) WHERE eliminado_at IS NOT NULL;
