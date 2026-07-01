-- SLA en horas hábiles por tipo de trámite.
-- Reemplaza sla_dias (nunca aplicado) para operar en horas hábiles.
ALTER TABLE public.ticket_tipos
  ADD COLUMN IF NOT EXISTS sla_horas INTEGER DEFAULT NULL
  CONSTRAINT ticket_tipos_sla_horas_check CHECK (sla_horas IS NULL OR sla_horas > 0);
