/*
  # Fix commission_details: agent_id nullable y agregar endoso

  1. Propósito
    - Permitir que agent_id sea NULL para comisiones sin asignar
    - Agregar campo endoso para capturar número de endoso
    - Permitir inserción de items sin email (pending_assignment = true)

  2. Cambios
    - ALTER agent_id para que sea NULLABLE
    - Agregar columna endoso (text, opcional)
    - Crear índice para búsquedas por endoso

  3. Justificación
    - Los archivos Excel pueden tener filas sin email
    - Estas filas deben poder insertarse como "pending_assignment"
    - El endoso es información valiosa del formato real
*/

-- Hacer agent_id NULLABLE en commission_details
ALTER TABLE commission_details
  ALTER COLUMN agent_id DROP NOT NULL;

-- Agregar campo endoso si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'commission_details' AND column_name = 'endoso'
  ) THEN
    ALTER TABLE commission_details
    ADD COLUMN endoso text;

    CREATE INDEX IF NOT EXISTS idx_commission_details_endoso
    ON commission_details(endoso);
  END IF;
END $$;

-- Comentarios para documentar
COMMENT ON COLUMN commission_details.agent_id IS 'ID del agente asignado. Puede ser NULL si pending_assignment = true';
COMMENT ON COLUMN commission_details.endoso IS 'Número de endoso de la póliza (opcional)';
COMMENT ON COLUMN commission_details.pending_assignment IS 'TRUE si el item aún no tiene agente asignado';
