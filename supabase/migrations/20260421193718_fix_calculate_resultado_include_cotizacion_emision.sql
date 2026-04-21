/*
  # Fix calculate_ticket_resultado to handle cotizacion_emision tipo_tramite

  1. Problem
    - The trigger only processes tipo_tramite = 'registro_actividad'
    - cotizacion_emision tickets now use their own tipo_tramite value
    - The resultado calculation (ganado/perdido/en_progreso) must also work
      for cotizacion_emision tipo_tramite

  2. Changes
    - Accept both 'registro_actividad' and 'cotizacion_emision' tipo_tramite values
*/

CREATE OR REPLACE FUNCTION calculate_ticket_resultado()
RETURNS TRIGGER AS $$
DECLARE
  v_activity_type_name text;
  v_estatus_nombre text;
  v_is_cotizacion_emision boolean := false;
BEGIN
  -- Only applies to registro_actividad and cotizacion_emision
  IF NEW.tipo_tramite NOT IN ('registro_actividad', 'cotizacion_emision') THEN
    RETURN NEW;
  END IF;

  -- For cotizacion_emision tipo_tramite, it's always a cotizacion/emision
  IF NEW.tipo_tramite = 'cotizacion_emision' THEN
    v_is_cotizacion_emision := true;
  ELSIF NEW.activity_subtype_id IS NOT NULL THEN
    SELECT nombre INTO v_activity_type_name
    FROM tramite_activity_types
    WHERE id = NEW.activity_subtype_id;
    v_is_cotizacion_emision := (
      lower(v_activity_type_name) LIKE '%cotizaci%' OR
      lower(v_activity_type_name) LIKE '%emisi%'
    );
  END IF;

  IF NEW.estatus_id IS NOT NULL THEN
    SELECT nombre INTO v_estatus_nombre
    FROM ticket_estatus
    WHERE id = NEW.estatus_id;
  END IF;

  IF v_is_cotizacion_emision THEN
    IF v_estatus_nombre IN ('Emitido (Ganado)', 'Emitido') THEN
      NEW.resultado := 'ganado';
      NEW.cerrado := true;
      IF NEW.fecha_cierre IS NULL THEN
        NEW.fecha_cierre := now();
      END IF;
    ELSIF v_estatus_nombre IN ('No Emitido (Perdido)', 'No Emitido') THEN
      NEW.resultado := 'perdido';
      NEW.cerrado := true;
      IF NEW.fecha_cierre IS NULL THEN
        NEW.fecha_cierre := now();
      END IF;
    ELSE
      NEW.resultado := 'en_progreso';
    END IF;
  ELSE
    IF v_estatus_nombre IN ('Emitido (Ganado)', 'No Emitido (Perdido)', 'Cerrado') THEN
      NEW.cerrado := true;
      IF NEW.fecha_cierre IS NULL THEN
        NEW.fecha_cierre := now();
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
