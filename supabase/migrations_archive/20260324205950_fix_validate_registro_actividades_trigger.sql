/*
  # Arreglar trigger validate_registro_actividades

  1. Problema
    - El trigger antiguo intenta asignar a NEW.estado que no existe
    - La tabla tickets usa estatus_id, no estado

  2. Solución
    - Eliminar asignaciones a NEW.estado
    - El estatus ya se maneja correctamente a través de estatus_id
*/

-- =====================================================
-- RECREAR FUNCIÓN SIN REFERENCIAS A CAMPO estado
-- =====================================================
CREATE OR REPLACE FUNCTION validate_registro_actividades()
RETURNS TRIGGER AS $$
BEGIN
  -- Solo aplica para tipo 'registro_actividad'
  IF NEW.tipo_tramite != 'registro_actividad' THEN
    RETURN NEW;
  END IF;

  -- Validar que el usuario no sea Agente
  IF EXISTS (
    SELECT 1 FROM usuarios
    WHERE id = auth.uid()
    AND rol = 'agente'
  ) THEN
    RAISE EXCEPTION 'Los agentes no pueden crear Registro de Actividades';
  END IF;

  -- Validar campos obligatorios
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

  -- Validar que insurers tenga al menos 1 aseguradora
  IF NEW.insurers IS NULL OR jsonb_array_length(NEW.insurers) = 0 THEN
    RAISE EXCEPTION 'Debe seleccionar al menos una aseguradora';
  END IF;

  -- Si avance = 100% y no hay fecha de finalización, autocompletar
  IF NEW.progress_percent = 100 AND NEW.completion_datetime IS NULL THEN
    NEW.completion_datetime := now();
  END IF;

  -- Validar que fecha de finalización no sea menor a fecha de solicitud
  IF NEW.completion_datetime IS NOT NULL AND NEW.completion_datetime < NEW.request_datetime THEN
    RAISE EXCEPTION 'La fecha de finalización no puede ser anterior a la fecha de solicitud';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comentario
COMMENT ON FUNCTION validate_registro_actividades IS 'Valida los campos obligatorios para Registro de Actividades sin modificar el estatus';
