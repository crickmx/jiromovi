/*
  # Fix validation trigger: skip cotizacion_emision and allow agents

  1. Problem
    - When tipo_tramite is 'cotizacion_emision', the trigger should skip entirely
    - Agents must be able to create cotizacion_emision tickets
    - The previous trigger only skipped if tipo_tramite != 'registro_actividad'
      but some code paths may still insert with 'registro_actividad' tipo

  2. Changes
    - Explicitly return early for 'cotizacion_emision' tipo_tramite
    - Only block agents for 'registro_actividad' (not cotizacion_emision)
*/

CREATE OR REPLACE FUNCTION validate_registro_actividades()
RETURNS TRIGGER AS $$
BEGIN
  -- Skip entirely for cotizacion_emision
  IF NEW.tipo_tramite = 'cotizacion_emision' THEN
    RETURN NEW;
  END IF;

  -- Only applies to 'registro_actividad' type
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
