-- Agrega columna sla_dias a ticket_tipos para configurar tiempo de respuesta promesa por tipo de trámite
ALTER TABLE public.ticket_tipos
  ADD COLUMN IF NOT EXISTS sla_dias INTEGER DEFAULT NULL
  CONSTRAINT ticket_tipos_sla_dias_check CHECK (sla_dias IS NULL OR sla_dias > 0);
