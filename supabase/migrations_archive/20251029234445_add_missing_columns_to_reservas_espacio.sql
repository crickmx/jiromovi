/*
  # Agregar columnas faltantes a reservas_espacio

  ## Descripción
  Agrega columnas necesarias para que el módulo de Espacio Jiro funcione correctamente.
  Mantiene las columnas existentes para compatibilidad.

  ## Cambios
  - Agrega columna `oficina_id` (uuid, foreign key)
  - Agrega columna `fecha` (date)
  - Agrega columna `hora_inicio` (time)
  - Agrega columna `hora_fin` (time)
  - Agrega columna `notas` (text, alias de motivo)

  ## Seguridad
  - Se mantienen las políticas RLS existentes
*/

-- Agregar oficina_id
ALTER TABLE reservas_espacio 
ADD COLUMN IF NOT EXISTS oficina_id uuid REFERENCES oficinas(id) ON DELETE CASCADE;

-- Agregar campos de fecha y hora separados
ALTER TABLE reservas_espacio 
ADD COLUMN IF NOT EXISTS fecha date,
ADD COLUMN IF NOT EXISTS hora_inicio time,
ADD COLUMN IF NOT EXISTS hora_fin time;

-- Agregar notas (alias de motivo)
ALTER TABLE reservas_espacio 
ADD COLUMN IF NOT EXISTS notas text;

-- Crear trigger para sincronizar fecha/hora con fecha_inicio/fecha_fin
CREATE OR REPLACE FUNCTION sync_reserva_fechas()
RETURNS TRIGGER AS $$
BEGIN
  -- Si se insertan/actualizan fecha y hora separadas, construir fecha_inicio/fecha_fin
  IF NEW.fecha IS NOT NULL AND NEW.hora_inicio IS NOT NULL THEN
    NEW.fecha_inicio := (NEW.fecha || ' ' || NEW.hora_inicio)::timestamptz;
  END IF;
  
  IF NEW.fecha IS NOT NULL AND NEW.hora_fin IS NOT NULL THEN
    NEW.fecha_fin := (NEW.fecha || ' ' || NEW.hora_fin)::timestamptz;
  END IF;
  
  -- Sincronizar notas con motivo
  IF NEW.notas IS NOT NULL THEN
    NEW.motivo := NEW.notas;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_sync_reserva_fechas
  BEFORE INSERT OR UPDATE ON reservas_espacio
  FOR EACH ROW
  EXECUTE FUNCTION sync_reserva_fechas();

-- Crear índices
CREATE INDEX IF NOT EXISTS idx_reservas_espacio_oficina_id ON reservas_espacio(oficina_id);
CREATE INDEX IF NOT EXISTS idx_reservas_espacio_fecha ON reservas_espacio(fecha);

COMMENT ON COLUMN reservas_espacio.oficina_id IS 'Oficina donde se realiza la reserva';
COMMENT ON COLUMN reservas_espacio.fecha IS 'Fecha de la reserva';
COMMENT ON COLUMN reservas_espacio.hora_inicio IS 'Hora de inicio';
COMMENT ON COLUMN reservas_espacio.hora_fin IS 'Hora de fin';
COMMENT ON COLUMN reservas_espacio.notas IS 'Notas adicionales de la reserva';
