/*
  # Agregar Triggers para Registrar Todo en Historial de Trámites

  1. Funciones y Triggers
    - Trigger para registrar comentarios en historial
    - Trigger para registrar carga de archivos en historial
    - Trigger para registrar asignaciones en historial

  2. Mejora al trigger existente
    - Mejorar el detalle del historial para incluir nombres legibles
*/

-- Función para registrar comentarios en el historial
CREATE OR REPLACE FUNCTION log_ticket_comentario()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  usuario_nombre text;
BEGIN
  -- Obtener el nombre del usuario
  SELECT nombre_completo INTO usuario_nombre
  FROM usuarios
  WHERE id = NEW.usuario_id;

  -- Registrar en el historial
  INSERT INTO ticket_historial (ticket_id, usuario_id, accion, detalle)
  VALUES (
    NEW.ticket_id,
    NEW.usuario_id,
    'Comentario agregado',
    jsonb_build_object(
      'usuario', usuario_nombre,
      'mensaje_preview', CASE
        WHEN length(NEW.mensaje) > 100 THEN substring(NEW.mensaje from 1 for 100) || '...'
        ELSE NEW.mensaje
      END
    )
  );

  RETURN NEW;
END;
$$;

-- Crear trigger para comentarios
DROP TRIGGER IF EXISTS trigger_log_ticket_comentario ON ticket_comentarios;
CREATE TRIGGER trigger_log_ticket_comentario
  AFTER INSERT ON ticket_comentarios
  FOR EACH ROW
  EXECUTE FUNCTION log_ticket_comentario();

-- Función para registrar archivos en el historial
CREATE OR REPLACE FUNCTION log_ticket_archivo()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  usuario_nombre text;
  tamano_mb numeric;
BEGIN
  -- Obtener el nombre del usuario
  SELECT nombre_completo INTO usuario_nombre
  FROM usuarios
  WHERE id = NEW.usuario_id;

  -- Calcular tamaño en MB
  tamano_mb := CASE
    WHEN NEW.tamano IS NOT NULL THEN round((NEW.tamano::numeric / 1024 / 1024), 2)
    ELSE 0
  END;

  -- Registrar en el historial
  INSERT INTO ticket_historial (ticket_id, usuario_id, accion, detalle)
  VALUES (
    NEW.ticket_id,
    NEW.usuario_id,
    'Archivo adjuntado',
    jsonb_build_object(
      'usuario', usuario_nombre,
      'nombre_archivo', NEW.nombre,
      'tipo', COALESCE(NEW.tipo, 'desconocido'),
      'tamano_mb', tamano_mb
    )
  );

  RETURN NEW;
END;
$$;

-- Crear trigger para archivos
DROP TRIGGER IF EXISTS trigger_log_ticket_archivo ON ticket_archivos;
CREATE TRIGGER trigger_log_ticket_archivo
  AFTER INSERT ON ticket_archivos
  FOR EACH ROW
  EXECUTE FUNCTION log_ticket_archivo();

-- Función para registrar asignaciones en el historial
CREATE OR REPLACE FUNCTION log_ticket_asignacion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  ejecutivo_nombre text;
  asignador_nombre text;
BEGIN
  -- Obtener el nombre del ejecutivo asignado
  SELECT nombre_completo INTO ejecutivo_nombre
  FROM usuarios
  WHERE id = NEW.ejecutivo_id;

  -- Obtener el nombre de quien asignó
  SELECT nombre_completo INTO asignador_nombre
  FROM usuarios
  WHERE id = NEW.asignado_por;

  -- Registrar en el historial
  INSERT INTO ticket_historial (ticket_id, usuario_id, accion, detalle)
  VALUES (
    NEW.ticket_id,
    NEW.asignado_por,
    'Ejecutivo asignado',
    jsonb_build_object(
      'ejecutivo', ejecutivo_nombre,
      'asignado_por', asignador_nombre
    )
  );

  RETURN NEW;
END;
$$;

-- Crear trigger para asignaciones
DROP TRIGGER IF EXISTS trigger_log_ticket_asignacion ON ticket_asignaciones;
CREATE TRIGGER trigger_log_ticket_asignacion
  AFTER INSERT ON ticket_asignaciones
  FOR EACH ROW
  EXECUTE FUNCTION log_ticket_asignacion();

-- Mejorar la función existente de log_ticket_cambio para incluir nombres legibles
CREATE OR REPLACE FUNCTION log_ticket_cambio()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  accion_texto text;
  detalle_json jsonb;
  estatus_anterior_nombre text;
  estatus_nuevo_nombre text;
  agente_nombre text;
  cerrado_por_nombre text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    accion_texto := 'Ticket creado';

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

    detalle_json := jsonb_build_object(
      'folio', NEW.folio,
      'agente', COALESCE(agente_nombre, 'Sin asignar'),
      'estatus', estatus_nuevo_nombre,
      'prioridad', NEW.prioridad,
      'poliza', COALESCE(NEW.poliza, 'Sin póliza')
    );

    INSERT INTO ticket_historial (ticket_id, usuario_id, accion, detalle)
    VALUES (NEW.id, NEW.creado_por, accion_texto, detalle_json);

  ELSIF TG_OP = 'UPDATE' THEN
    detalle_json := '{}'::jsonb;

    IF OLD.estatus_id != NEW.estatus_id THEN
      -- Obtener nombres de los estatus
      SELECT nombre INTO estatus_anterior_nombre
      FROM ticket_estatus
      WHERE id = OLD.estatus_id;

      SELECT nombre INTO estatus_nuevo_nombre
      FROM ticket_estatus
      WHERE id = NEW.estatus_id;

      accion_texto := 'Estatus actualizado';
      detalle_json := jsonb_build_object(
        'estatus_anterior', estatus_anterior_nombre,
        'estatus_nuevo', estatus_nuevo_nombre
      );

    ELSIF OLD.prioridad != NEW.prioridad THEN
      accion_texto := 'Prioridad actualizada';
      detalle_json := jsonb_build_object(
        'prioridad_anterior', OLD.prioridad,
        'prioridad_nueva', NEW.prioridad
      );

    ELSIF OLD.agente_id IS DISTINCT FROM NEW.agente_id THEN
      accion_texto := 'Agente reasignado';

      -- Obtener nombre del agente anterior si existía
      IF OLD.agente_id IS NOT NULL THEN
        SELECT nombre_completo INTO agente_nombre
        FROM usuarios
        WHERE id = OLD.agente_id;
      END IF;

      detalle_json := jsonb_build_object(
        'agente_anterior', COALESCE(agente_nombre, 'Sin asignar')
      );

      -- Obtener nombre del nuevo agente si existe
      agente_nombre := NULL;
      IF NEW.agente_id IS NOT NULL THEN
        SELECT nombre_completo INTO agente_nombre
        FROM usuarios
        WHERE id = NEW.agente_id;
      END IF;

      detalle_json := detalle_json || jsonb_build_object(
        'agente_nuevo', COALESCE(agente_nombre, 'Sin asignar')
      );

    ELSIF OLD.cerrado_en IS NULL AND NEW.cerrado_en IS NOT NULL THEN
      -- Obtener nombre de quien cerró
      IF NEW.cerrado_por IS NOT NULL THEN
        SELECT nombre_completo INTO cerrado_por_nombre
        FROM usuarios
        WHERE id = NEW.cerrado_por;
      END IF;

      accion_texto := 'Ticket cerrado';
      detalle_json := jsonb_build_object(
        'cerrado_por', COALESCE(cerrado_por_nombre, 'Desconocido'),
        'fecha_cierre', NEW.cerrado_en
      );

    ELSIF OLD.cerrado_en IS NOT NULL AND NEW.cerrado_en IS NULL THEN
      accion_texto := 'Ticket reabierto';
      detalle_json := jsonb_build_object(
        'fecha_reapertura', now()
      );

    ELSIF OLD.poliza IS DISTINCT FROM NEW.poliza THEN
      accion_texto := 'Póliza actualizada';
      detalle_json := jsonb_build_object(
        'poliza_anterior', COALESCE(OLD.poliza, 'Sin póliza'),
        'poliza_nueva', COALESCE(NEW.poliza, 'Sin póliza')
      );

    ELSE
      accion_texto := 'Ticket actualizado';
    END IF;

    INSERT INTO ticket_historial (ticket_id, usuario_id, accion, detalle)
    VALUES (NEW.id, NEW.modificado_por, accion_texto, detalle_json);
  END IF;

  RETURN NEW;
END;
$$;

-- Recrear el trigger con la función mejorada
DROP TRIGGER IF EXISTS trigger_log_ticket_cambio ON tickets;
CREATE TRIGGER trigger_log_ticket_cambio
  AFTER INSERT OR UPDATE ON tickets
  FOR EACH ROW
  EXECUTE FUNCTION log_ticket_cambio();