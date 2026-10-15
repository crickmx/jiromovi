-- Permite elegir, por trigger, si el trámite hijo usa un folio nuevo o hereda
-- el folio del padre + un inciso de letra (ej. TK09672 -> TK09672-A).
ALTER TABLE ticket_status_triggers
  ADD COLUMN IF NOT EXISTS folio_mode text NOT NULL DEFAULT 'nuevo'
  CHECK (folio_mode IN ('nuevo', 'heredar_incisos'));
