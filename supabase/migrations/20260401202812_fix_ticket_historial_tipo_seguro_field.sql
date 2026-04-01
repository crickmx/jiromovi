/*
  # Fix: Corregir referencias a tipo_seguro en triggers
  
  1. Problema
    - La función log_ticket_cambio() usa NEW.tipo_seguro y OLD.tipo_seguro
    - Pero la columna correcta es tipo_seguro_id (UUID)
  
  2. Solución
    - Actualizar función para usar tipo_seguro_id
    - Obtener el nombre del tipo de seguro desde la tabla tramite_insurance_types
*/

-- Reemplazar función corregida
CREATE OR REPLACE FUNCTION log_ticket_cambio()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  accion_texto text;
  tipo_accion_valor text;
  detalle_json jsonb;
  estatus_anterior_nombre text;
  estatus_nuevo_nombre text;
  agente_nombre text;
  cerrado_por_nombre text;
  tipo_seguro_nombre text;
  tipo_seguro_anterior_nombre text;
  tipo_seguro_nuevo_nombre text;
  cambios_detectados boolean := false;
BEGIN
  IF TG_OP = 'INSERT' THEN
    accion_texto := 'Ticket creado';
    tipo_accion_valor := 'creacion';
    cambios_detectados := true;

    -- Obtener nombre del agente si existe
    IF NEW.agente_id IS NOT NULL THEN
      SELECT nombre_completo INTO agente_nombre
      FROM usuarios
      WHERE id = NEW.agente_id;
    END IF;

    -- Obtener nombre del estatus
    SELECT nombre INTO estatus_nuevo_nombre
    FROM ticket_estatus
    WHERE id = NEW.estatus_id;

    -- Obtener nombre del tipo de seguro si existe
    IF NEW.tipo_seguro_id IS NOT NULL THEN
      SELECT nombre INTO tipo_seguro_nombre
      FROM tramite_insurance_types
      WHERE id = NEW.tipo_seguro_id;
    END IF;

    detalle_json := jsonb_build_object(
      'folio', NEW.folio,
      'agente', COALESCE(agente_nombre, 'Sin asignar'),
      'estatus', estatus_nuevo_nombre,
      'prioridad', NEW.prioridad,
      'poliza', COALESCE(NEW.poliza, 'Sin póliza'),
      'tipo_seguro', COALESCE(tipo_seguro_nombre, 'No especificado'),
      'descripcion_preview', CASE
        WHEN NEW.instrucciones IS NOT NULL AND length(NEW.instrucciones) > 100 
        THEN substring(NEW.instrucciones from 1 for 100) || '...'
        ELSE COALESCE(NEW.instrucciones, '')
      END
    );

    INSERT INTO ticket_historial (ticket_id, usuario_id, accion, detalle, tipo_accion)
    VALUES (NEW.id, NEW.creado_por, accion_texto, detalle_json, tipo_accion_valor);

  ELSIF TG_OP = 'UPDATE' THEN
    detalle_json := '{}'::jsonb;

    -- Cambio de estatus (prioridad más alta)
    IF OLD.estatus_id != NEW.estatus_id THEN
      SELECT nombre INTO estatus_anterior_nombre
      FROM ticket_estatus
      WHERE id = OLD.estatus_id;

      SELECT nombre INTO estatus_nuevo_nombre
      FROM ticket_estatus
      WHERE id = NEW.estatus_id;

      accion_texto := 'Estatus actualizado';
      tipo_accion_valor := 'estatus';
      detalle_json := jsonb_build_object(
        'estatus_anterior', estatus_anterior_nombre,
        'estatus_nuevo', estatus_nuevo_nombre
      );
      cambios_detectados := true;

    -- Cambio de prioridad
    ELSIF OLD.prioridad != NEW.prioridad THEN
      accion_texto := 'Prioridad actualizada';
      tipo_accion_valor := 'modificacion';
      detalle_json := jsonb_build_object(
        'prioridad_anterior', OLD.prioridad,
        'prioridad_nueva', NEW.prioridad
      );
      cambios_detectados := true;

    -- Cambio de agente
    ELSIF OLD.agente_id IS DISTINCT FROM NEW.agente_id THEN
      accion_texto := 'Agente reasignado';
      tipo_accion_valor := 'asignacion';

      IF OLD.agente_id IS NOT NULL THEN
        SELECT nombre_completo INTO agente_nombre
        FROM usuarios
        WHERE id = OLD.agente_id;
      END IF;

      detalle_json := jsonb_build_object(
        'agente_anterior', COALESCE(agente_nombre, 'Sin asignar')
      );

      agente_nombre := NULL;
      IF NEW.agente_id IS NOT NULL THEN
        SELECT nombre_completo INTO agente_nombre
        FROM usuarios
        WHERE id = NEW.agente_id;
      END IF;

      detalle_json := detalle_json || jsonb_build_object(
        'agente_nuevo', COALESCE(agente_nombre, 'Sin asignar')
      );
      cambios_detectados := true;

    -- Ticket cerrado
    ELSIF OLD.cerrado_en IS NULL AND NEW.cerrado_en IS NOT NULL THEN
      IF NEW.cerrado_por IS NOT NULL THEN
        SELECT nombre_completo INTO cerrado_por_nombre
        FROM usuarios
        WHERE id = NEW.cerrado_por;
      END IF;

      accion_texto := 'Ticket cerrado';
      tipo_accion_valor := 'cierre';
      detalle_json := jsonb_build_object(
        'cerrado_por', COALESCE(cerrado_por_nombre, 'Desconocido'),
        'fecha_cierre', NEW.cerrado_en
      );
      cambios_detectados := true;

    -- Ticket reabierto
    ELSIF OLD.cerrado_en IS NOT NULL AND NEW.cerrado_en IS NULL THEN
      accion_texto := 'Ticket reabierto';
      tipo_accion_valor := 'reapertura';
      detalle_json := jsonb_build_object(
        'fecha_reapertura', now()
      );
      cambios_detectados := true;

    -- Cambio de póliza
    ELSIF OLD.poliza IS DISTINCT FROM NEW.poliza THEN
      accion_texto := 'Póliza actualizada';
      tipo_accion_valor := 'modificacion';
      detalle_json := jsonb_build_object(
        'poliza_anterior', COALESCE(OLD.poliza, 'Sin póliza'),
        'poliza_nueva', COALESCE(NEW.poliza, 'Sin póliza')
      );
      cambios_detectados := true;

    -- Cambio de instrucciones
    ELSIF OLD.instrucciones IS DISTINCT FROM NEW.instrucciones THEN
      accion_texto := 'Instrucciones actualizadas';
      tipo_accion_valor := 'modificacion';
      detalle_json := jsonb_build_object(
        'instrucciones_anterior_preview', CASE
          WHEN OLD.instrucciones IS NOT NULL AND length(OLD.instrucciones) > 100 
          THEN substring(OLD.instrucciones from 1 for 100) || '...'
          ELSE COALESCE(OLD.instrucciones, '')
        END,
        'instrucciones_nueva_preview', CASE
          WHEN NEW.instrucciones IS NOT NULL AND length(NEW.instrucciones) > 100 
          THEN substring(NEW.instrucciones from 1 for 100) || '...'
          ELSE COALESCE(NEW.instrucciones, '')
        END
      );
      cambios_detectados := true;

    -- Cambio de tipo de seguro
    ELSIF OLD.tipo_seguro_id IS DISTINCT FROM NEW.tipo_seguro_id THEN
      IF OLD.tipo_seguro_id IS NOT NULL THEN
        SELECT nombre INTO tipo_seguro_anterior_nombre
        FROM tramite_insurance_types
        WHERE id = OLD.tipo_seguro_id;
      END IF;

      IF NEW.tipo_seguro_id IS NOT NULL THEN
        SELECT nombre INTO tipo_seguro_nuevo_nombre
        FROM tramite_insurance_types
        WHERE id = NEW.tipo_seguro_id;
      END IF;

      accion_texto := 'Tipo de seguro actualizado';
      tipo_accion_valor := 'modificacion';
      detalle_json := jsonb_build_object(
        'tipo_seguro_anterior', COALESCE(tipo_seguro_anterior_nombre, 'No especificado'),
        'tipo_seguro_nuevo', COALESCE(tipo_seguro_nuevo_nombre, 'No especificado')
      );
      cambios_detectados := true;

    -- Cambio de resultado
    ELSIF OLD.resultado IS DISTINCT FROM NEW.resultado THEN
      accion_texto := 'Resultado actualizado';
      tipo_accion_valor := 'modificacion';
      detalle_json := jsonb_build_object(
        'resultado_anterior', COALESCE(OLD.resultado, 'Sin resultado'),
        'resultado_nuevo', COALESCE(NEW.resultado, 'Sin resultado')
      );
      cambios_detectados := true;

    -- Otros cambios genéricos
    ELSE
      accion_texto := 'Datos actualizados';
      tipo_accion_valor := 'modificacion';
      cambios_detectados := true;
    END IF;

    -- Solo insertar si hubo cambios detectados
    IF cambios_detectados THEN
      INSERT INTO ticket_historial (ticket_id, usuario_id, accion, detalle, tipo_accion)
      VALUES (NEW.id, NEW.modificado_por, accion_texto, detalle_json, tipo_accion_valor);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
