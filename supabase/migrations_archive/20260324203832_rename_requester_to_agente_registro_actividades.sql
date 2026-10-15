/*
  # Fusionar Solicitante y Agente en campo único "Agente"
  
  1. Cambios en tabla tickets
    - Renombrar `requester_user_id` a `agente_usuario_id`
    - Mantener la relación con usuarios
    
  2. Comportamiento
    - El campo "Agente" filtrará usuarios de la misma oficina que "Quien Atiende"
    - Solo aplica para tipo_tramite = 'registro_actividad'
    
  3. Actualizar funciones y triggers relacionados
*/

-- Renombrar columna requester_user_id a agente_usuario_id en tickets
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tickets' AND column_name = 'requester_user_id'
  ) THEN
    ALTER TABLE tickets RENAME COLUMN requester_user_id TO agente_usuario_id;
  END IF;
END $$;

-- Agregar comentario para documentar el cambio
COMMENT ON COLUMN tickets.agente_usuario_id IS 'Agente relacionado al trámite. Para registro_actividad: usuario de la misma oficina que quien_atiende';

-- Actualizar función de validación si existe
CREATE OR REPLACE FUNCTION validate_registro_actividades()
RETURNS TRIGGER AS $$
BEGIN
  -- Solo aplica para tipo 'registro_actividad'
  IF NEW.tipo_tramite != 'registro_actividad' THEN
    RETURN NEW;
  END IF;

  -- Validar campos obligatorios para registro de actividades
  IF NEW.activity_subtype_id IS NULL THEN
    RAISE EXCEPTION 'El tipo de trámite es obligatorio para Registro de Actividades';
  END IF;

  IF NEW.agente_usuario_id IS NULL THEN
    RAISE EXCEPTION 'El agente es obligatorio para Registro de Actividades';
  END IF;

  IF NEW.insurance_type_id IS NULL THEN
    RAISE EXCEPTION 'El tipo de seguro es obligatorio para Registro de Actividades';
  END IF;

  IF NEW.attending_user_id IS NULL THEN
    RAISE EXCEPTION 'Quién atiende es obligatorio para Registro de Actividades';
  END IF;

  IF NEW.request_datetime IS NULL THEN
    RAISE EXCEPTION 'La fecha de solicitud es obligatoria para Registro de Actividades';
  END IF;

  IF NEW.insurers IS NULL OR jsonb_array_length(NEW.insurers) = 0 THEN
    RAISE EXCEPTION 'Debe seleccionar al menos una aseguradora para Registro de Actividades';
  END IF;

  -- Calcular estado basado en progress_percent
  IF NEW.progress_percent = 0 THEN
    NEW.estado = 'Pendiente';
  ELSIF NEW.progress_percent = 100 THEN
    NEW.estado = 'Completado';
  ELSE
    NEW.estado = 'En Progreso';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recrear trigger si existe
DROP TRIGGER IF EXISTS validate_registro_actividades_trigger ON tickets;
CREATE TRIGGER validate_registro_actividades_trigger
  BEFORE INSERT OR UPDATE ON tickets
  FOR EACH ROW
  EXECUTE FUNCTION validate_registro_actividades();
