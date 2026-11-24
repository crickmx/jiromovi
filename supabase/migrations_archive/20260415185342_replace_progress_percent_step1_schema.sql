/*
  # Replace progress_percent with Business Status - Step 1: Schema + New Statuses

  Adds fecha_cierre, cerrado columns and inserts the new business estatus values.
*/

-- Add fecha_cierre and cerrado to tickets
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tickets' AND column_name = 'fecha_cierre'
  ) THEN
    ALTER TABLE tickets ADD COLUMN fecha_cierre timestamptz NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tickets' AND column_name = 'cerrado'
  ) THEN
    ALTER TABLE tickets ADD COLUMN cerrado boolean NOT NULL DEFAULT false;
  END IF;
END $$;

-- Insert new business statuses (only for registro_actividad)
INSERT INTO ticket_estatus (nombre, color, orden, tipo_aplicable, activo)
VALUES
  ('Cotizado',              '#3b82f6', 2,  ARRAY['registro_actividad'], true),
  ('Espera Aseguradora',    '#f97316', 3,  ARRAY['registro_actividad'], true),
  ('Espera Agente',         '#eab308', 4,  ARRAY['registro_actividad'], true),
  ('Emitido (Ganado)',      '#10b981', 5,  ARRAY['registro_actividad'], true),
  ('No Emitido (Perdido)',  '#ef4444', 6,  ARRAY['registro_actividad'], true)
ON CONFLICT DO NOTHING;

-- Restrict old generic "En Proceso", "Emitido", "No Emitido" to exclude registro_actividad
UPDATE ticket_estatus
SET tipo_aplicable = ARRAY['general', 'solicitud_comisiones', 'cambio_bancario']
WHERE nombre IN ('En Proceso', 'Emitido', 'No Emitido');

-- Update Iniciado to be available for registro_actividad specifically (keep general ones as is)
UPDATE ticket_estatus
SET orden = 1
WHERE nombre = 'Iniciado';
