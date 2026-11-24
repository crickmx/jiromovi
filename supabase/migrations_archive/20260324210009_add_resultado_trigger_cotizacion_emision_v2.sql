/*
  # Trigger para calcular resultado automáticamente

  1. Función y Trigger
    - Calcular resultado basado en el estatus y tipo de trámite
    - Actualizar automáticamente cuando cambia el estatus

  2. Lógica
    - Para Cotización/Emisión:
      * Iniciado → en_progreso
      * En Proceso → en_progreso
      * Emitido → ganado
      * No Emitido → perdido
*/

-- =====================================================
-- FUNCIÓN: CALCULAR RESULTADO AUTOMÁTICAMENTE
-- =====================================================
CREATE OR REPLACE FUNCTION calculate_ticket_resultado()
RETURNS TRIGGER AS $$
DECLARE
  activity_type_name TEXT;
  status_name TEXT;
BEGIN
  -- Solo aplica para tipo 'registro_actividad'
  IF NEW.tipo_tramite != 'registro_actividad' THEN
    RETURN NEW;
  END IF;

  -- Obtener nombre del tipo de actividad
  SELECT LOWER(nombre) INTO activity_type_name
  FROM tramite_activity_types
  WHERE id = NEW.activity_subtype_id;

  -- Obtener nombre del estatus
  SELECT nombre INTO status_name
  FROM ticket_estatus
  WHERE id = NEW.estatus_id;

  -- Si es Cotización/Emisión, calcular resultado basado en estatus
  IF activity_type_name LIKE '%cotizaci%' OR activity_type_name LIKE '%emisi%' THEN

    -- Estatus "Emitido" → ganado
    IF status_name = 'Emitido' THEN
      NEW.resultado := 'ganado';

    -- Estatus "No Emitido" → perdido
    ELSIF status_name = 'No Emitido' THEN
      NEW.resultado := 'perdido';

    -- Estatus "Iniciado", "En Proceso" o progress_percent < 100 → en_progreso
    ELSIF status_name IN ('Iniciado', 'En proceso', 'En Proceso') OR NEW.progress_percent < 100 THEN
      NEW.resultado := 'en_progreso';

    -- Default
    ELSE
      NEW.resultado := 'en_progreso';
    END IF;

  ELSE
    -- Para tipo "Otro", no clasificar resultado
    NEW.resultado := NULL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- TRIGGER PARA CALCULAR RESULTADO AUTOMÁTICAMENTE
-- =====================================================
DROP TRIGGER IF EXISTS trigger_calculate_resultado ON tickets;

CREATE TRIGGER trigger_calculate_resultado
  BEFORE INSERT OR UPDATE OF progress_percent, estatus_id, activity_subtype_id
  ON tickets
  FOR EACH ROW
  EXECUTE FUNCTION calculate_ticket_resultado();

-- =====================================================
-- ACTUALIZAR DATOS EXISTENTES
-- =====================================================
UPDATE tickets t
SET resultado = CASE
  WHEN te.nombre = 'Emitido' THEN 'ganado'
  WHEN te.nombre = 'No Emitido' THEN 'perdido'
  WHEN te.nombre IN ('Iniciado', 'En proceso', 'En Proceso') OR t.progress_percent < 100 THEN 'en_progreso'
  ELSE 'en_progreso'
END
FROM ticket_estatus te
WHERE t.estatus_id = te.id
  AND t.tipo_tramite = 'registro_actividad'
  AND t.activity_subtype_id IN (
    SELECT id FROM tramite_activity_types
    WHERE LOWER(nombre) LIKE '%cotizaci%' OR LOWER(nombre) LIKE '%emisi%'
  );

-- Comentario
COMMENT ON FUNCTION calculate_ticket_resultado IS 'Calcula automáticamente el resultado (ganado/perdido/en_progreso) para trámites de Cotización/Emisión basándose en el estatus';
