/*
  # Corregir función notificar_actualizacion_tramite

  1. Cambios
    - Reemplazar referencia a responsable_id (que no existe) con attending_user_id
    - attending_user_id es el campo correcto que representa quien atiende el trámite

  2. Notas
    - La tabla tickets no tiene columna responsable_id
    - El campo correcto es attending_user_id
*/

CREATE OR REPLACE FUNCTION notificar_actualizacion_tramite()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_agente RECORD;
  v_modificador RECORD;
  v_estatus_nombre TEXT;
  v_campos_modificados TEXT[];
  v_url TEXT;
BEGIN
  v_campos_modificados := ARRAY[]::TEXT[];

  IF OLD.tipo_tramite IS DISTINCT FROM NEW.tipo_tramite THEN
    v_campos_modificados := array_append(v_campos_modificados, 'Tipo de trámite');
  END IF;

  IF OLD.prioridad IS DISTINCT FROM NEW.prioridad THEN
    v_campos_modificados := array_append(v_campos_modificados, 'Prioridad');
  END IF;

  IF OLD.poliza IS DISTINCT FROM NEW.poliza THEN
    v_campos_modificados := array_append(v_campos_modificados, 'Póliza');
  END IF;

  IF OLD.instrucciones IS DISTINCT FROM NEW.instrucciones THEN
    v_campos_modificados := array_append(v_campos_modificados, 'Instrucciones');
  END IF;

  -- CORREGIDO: usar attending_user_id en lugar de responsable_id
  IF OLD.attending_user_id IS DISTINCT FROM NEW.attending_user_id THEN
    v_campos_modificados := array_append(v_campos_modificados, 'Responsable');
  END IF;

  IF array_length(v_campos_modificados, 1) IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT id, nombre_completo, email_laboral, celular_laboral
  INTO v_agente
  FROM usuarios
  WHERE id = NEW.agente_id;

  IF NOT FOUND OR v_agente.id = NEW.modificado_por THEN
    RETURN NEW;
  END IF;

  SELECT nombre_completo, rol
  INTO v_modificador
  FROM usuarios
  WHERE id = NEW.modificado_por;

  SELECT nombre INTO v_estatus_nombre
  FROM ticket_estatus
  WHERE id = NEW.estatus_id;

  v_url := 'https://app.movi.digital/tramites/' || NEW.id;

  PERFORM send_transactional_notification(
    p_event_key := 'tramite_actualizado',
    p_user_id := v_agente.id,
    p_variables := jsonb_build_object(
      'folio', NEW.folio,
      'agente_nombre', v_agente.nombre_completo,
      'modificado_por', v_modificador.nombre_completo,
      'rol_modificador', v_modificador.rol,
      'campos_modificados', array_to_string(v_campos_modificados, ', '),
      'tipo_tramite', NEW.tipo_tramite,
      'estatus', COALESCE(v_estatus_nombre, 'Sin estatus'),
      'url', v_url
    ),
    p_link_url := v_url
  );

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION notificar_actualizacion_tramite IS 'Notifica al agente cuando se actualiza su trámite (corregido para usar attending_user_id)';
