-- Marca un tipo de trámite como "interno" (sin solicitante/agente externo)
ALTER TABLE ticket_tipos ADD COLUMN IF NOT EXISTS es_interno boolean NOT NULL DEFAULT false;
