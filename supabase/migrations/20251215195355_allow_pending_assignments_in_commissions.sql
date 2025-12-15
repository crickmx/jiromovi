/*
  # Permitir documentos pendientes de asignación en lotes de comisiones
  
  1. Cambios en commission_details
    - Agregar pending_assignment (bool) para documentos sin usuario
    - Agregar campos de vendedor para poder agrupar y asignar después
    - Agregar assignment_status para tracking
  
  2. Estos campos permiten:
    - Convertir lotes aunque existan documentos sin usuario asignado
    - Agrupar documentos pendientes por vendedor dentro del lote
    - Asignar usuarios después de la conversión
    - Guardar mapeos persistentes desde el lote
*/

-- Agregar nuevas columnas a commission_details
ALTER TABLE commission_details
  ADD COLUMN IF NOT EXISTS pending_assignment boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS assignment_status text DEFAULT 'assigned' CHECK (assignment_status IN ('assigned', 'unassigned')),
  ADD COLUMN IF NOT EXISTS vendor_group_key text;

-- Actualizar constraint de agent_id para permitir NULL cuando está pendiente
ALTER TABLE commission_details
  ALTER COLUMN agent_id DROP NOT NULL;

-- Actualizar registros existentes
UPDATE commission_details
SET 
  pending_assignment = false,
  assignment_status = 'assigned'
WHERE agent_id IS NOT NULL;

-- Crear índice para búsquedas rápidas de pendientes
CREATE INDEX IF NOT EXISTS idx_commission_details_pending
  ON commission_details(pending_assignment) WHERE pending_assignment = true;

CREATE INDEX IF NOT EXISTS idx_commission_details_vendor_group
  ON commission_details(vendor_group_key) WHERE vendor_group_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_commission_details_assignment_status
  ON commission_details(assignment_status);

-- Agregar columna al batch para tracking de pendientes
ALTER TABLE commission_batches
  ADD COLUMN IF NOT EXISTS has_pending_assignments boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS pending_count int DEFAULT 0;

-- Función para actualizar conteos de pendientes en el batch
CREATE OR REPLACE FUNCTION update_batch_pending_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE commission_batches
  SET 
    pending_count = (
      SELECT COUNT(*) 
      FROM commission_details 
      WHERE batch_id = NEW.batch_id 
      AND pending_assignment = true
    ),
    has_pending_assignments = (
      SELECT COUNT(*) > 0
      FROM commission_details 
      WHERE batch_id = NEW.batch_id 
      AND pending_assignment = true
    )
  WHERE id = NEW.batch_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para actualizar conteos automáticamente
DROP TRIGGER IF EXISTS trigger_update_batch_pending_count ON commission_details;
CREATE TRIGGER trigger_update_batch_pending_count
  AFTER INSERT OR UPDATE OF pending_assignment, assignment_status
  ON commission_details
  FOR EACH ROW
  EXECUTE FUNCTION update_batch_pending_count();

-- Comentarios
COMMENT ON COLUMN commission_details.pending_assignment IS 'Indica si este documento está pendiente de asignación de usuario';
COMMENT ON COLUMN commission_details.assignment_status IS 'Estado de asignación: assigned (con usuario) o unassigned (sin usuario)';
COMMENT ON COLUMN commission_details.vendor_group_key IS 'Clave para agrupar documentos del mismo vendedor (por email o nombre normalizado)';
COMMENT ON COLUMN commission_batches.has_pending_assignments IS 'Indica si el lote tiene documentos pendientes de asignación';
COMMENT ON COLUMN commission_batches.pending_count IS 'Número de documentos pendientes de asignación en el lote';
