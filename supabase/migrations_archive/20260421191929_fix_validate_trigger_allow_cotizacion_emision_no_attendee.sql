/*
  # Allow cotizacion_emision without attending_user_id

  1. Changes
    - The validation trigger now only fires for `registro_actividad` type
    - Since `cotizacion_emision` is a separate tipo_tramite, the trigger
      naturally skips it (line: IF NEW.tipo_tramite != 'registro_actividad')
    - However, we also need to ensure the trigger does NOT block agents
      from creating cotizacion_emision tickets
    - The trigger already returns early for non-registro_actividad types,
      so we just need to confirm it's correctly scoped

  2. Safety
    - `attending_user_id` remains required for `registro_actividad`
    - `cotizacion_emision` allows null `attending_user_id` (auto-assigned later)
*/

-- Recreate the function to be more explicit about scope
CREATE OR REPLACE FUNCTION validate_registro_actividades()
RETURNS TRIGGER AS $$
BEGIN
  -- Only applies to 'registro_actividad' type, NOT cotizacion_emision
  IF NEW.tipo_tramite != 'registro_actividad' THEN
    RETURN NEW;
  END IF;

  -- Validate that user is not Agente (only for registro_actividad)
  IF EXISTS (
    SELECT 1 FROM usuarios
    WHERE id = auth.uid()
    AND rol = 'Agente'
  ) THEN
    RAISE EXCEPTION 'Los agentes no pueden crear Registro de Actividades';
  END IF;

  -- Validate required fields
  IF NEW.activity_subtype_id IS NULL THEN
    RAISE EXCEPTION 'El tipo de trámite es obligatorio';
  END IF;

  IF NEW.agente_usuario_id IS NULL THEN
    RAISE EXCEPTION 'El agente es obligatorio';
  END IF;

  IF NEW.insurance_type_id IS NULL THEN
    RAISE EXCEPTION 'El tipo de seguro es obligatorio';
  END IF;

  IF NEW.attending_user_id IS NULL THEN
    RAISE EXCEPTION 'Quién atiende es obligatorio';
  END IF;

  IF NEW.request_datetime IS NULL THEN
    RAISE EXCEPTION 'La fecha y hora de solicitud es obligatoria';
  END IF;

  IF NEW.progress_percent IS NULL THEN
    RAISE EXCEPTION 'El avance es obligatorio';
  END IF;

  -- Validate at least 1 insurer
  IF NEW.insurers IS NULL OR jsonb_array_length(NEW.insurers) = 0 THEN
    RAISE EXCEPTION 'Debe seleccionar al menos una aseguradora';
  END IF;

  -- Auto-complete fecha de finalización if progress = 100%
  IF NEW.progress_percent = 100 AND NEW.completion_datetime IS NULL THEN
    NEW.completion_datetime := now();
  END IF;

  -- Validate completion date is not before request date
  IF NEW.completion_datetime IS NOT NULL AND NEW.completion_datetime < NEW.request_datetime THEN
    RAISE EXCEPTION 'La fecha de finalización no puede ser anterior a la fecha de solicitud';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
