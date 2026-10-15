/*
  # Arreglar cierre de tickets y seguimiento de cambios

  ## Problema
  - Los tickets no se cierran correctamente
  - No se actualiza ultima_modificacion automáticamente
  - No se registra el historial del cierre

  ## Solución
  1. Crear trigger para actualizar ultima_modificacion automáticamente
  2. Crear trigger para registrar cambios en historial
  3. Asegurar que el cierre funciona correctamente
*/

-- Función para actualizar ultima_modificacion
CREATE OR REPLACE FUNCTION update_tickets_ultima_modificacion()
RETURNS TRIGGER AS $$
BEGIN
  NEW.ultima_modificacion = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Eliminar trigger si existe
DROP TRIGGER IF EXISTS trigger_update_tickets_ultima_modificacion ON tickets;

-- Crear trigger para actualizar ultima_modificacion
CREATE TRIGGER trigger_update_tickets_ultima_modificacion
  BEFORE UPDATE ON tickets
  FOR EACH ROW
  EXECUTE FUNCTION update_tickets_ultima_modificacion();

-- Función para registrar cambios en historial automáticamente
CREATE OR REPLACE FUNCTION registrar_cambio_ticket()
RETURNS TRIGGER AS $$
DECLARE
  descripcion_cambio TEXT := '';
  tiene_cambios BOOLEAN := FALSE;
BEGIN
  -- Detectar cambios en estatus
  IF OLD.estatus_id IS DISTINCT FROM NEW.estatus_id THEN
    SELECT INTO descripcion_cambio descripcion_cambio || 
      'Estatus cambiado a: ' || (SELECT nombre FROM ticket_estatus WHERE id = NEW.estatus_id) || '. ';
    tiene_cambios := TRUE;
  END IF;

  -- Detectar cambios en prioridad
  IF OLD.prioridad IS DISTINCT FROM NEW.prioridad THEN
    descripcion_cambio := descripcion_cambio || 'Prioridad cambiada a: ' || NEW.prioridad || '. ';
    tiene_cambios := TRUE;
  END IF;

  -- Detectar cierre de ticket
  IF OLD.cerrado_en IS NULL AND NEW.cerrado_en IS NOT NULL THEN
    descripcion_cambio := descripcion_cambio || 'Ticket cerrado. ';
    tiene_cambios := TRUE;
  END IF;

  -- Detectar reapertura de ticket
  IF OLD.cerrado_en IS NOT NULL AND NEW.cerrado_en IS NULL THEN
    descripcion_cambio := descripcion_cambio || 'Ticket reabierto. ';
    tiene_cambios := TRUE;
  END IF;

  -- Registrar en historial si hay cambios
  IF tiene_cambios AND NEW.modificado_por IS NOT NULL THEN
    INSERT INTO ticket_historial (ticket_id, usuario_id, accion, descripcion)
    VALUES (NEW.id, NEW.modificado_por, 'Actualización', descripcion_cambio);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Eliminar trigger si existe
DROP TRIGGER IF EXISTS trigger_registrar_cambio_ticket ON tickets;

-- Crear trigger para registrar cambios
CREATE TRIGGER trigger_registrar_cambio_ticket
  AFTER UPDATE ON tickets
  FOR EACH ROW
  EXECUTE FUNCTION registrar_cambio_ticket();

-- Asegurar que la política UPDATE permite cerrar tickets
-- Ya está cubierta por la política existente, pero vamos a verificar

COMMENT ON FUNCTION update_tickets_ultima_modificacion IS 
  'Actualiza automáticamente el campo ultima_modificacion al modificar un ticket';

COMMENT ON FUNCTION registrar_cambio_ticket IS 
  'Registra automáticamente los cambios de ticket en la tabla ticket_historial';

COMMENT ON TRIGGER trigger_update_tickets_ultima_modificacion ON tickets IS 
  'Actualiza ultima_modificacion antes de cada actualización';

COMMENT ON TRIGGER trigger_registrar_cambio_ticket ON tickets IS 
  'Registra cambios en historial después de cada actualización';
