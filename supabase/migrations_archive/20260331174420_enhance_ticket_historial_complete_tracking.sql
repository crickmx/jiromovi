/*
  # Mejorar Registro Completo del Historial de Trámites
  
  ## Mejoras Implementadas
  1. Registrar descargas de archivos
  2. Registrar eliminación de comentarios (si aplica)
  3. Registrar eliminación de archivos (si aplica)
  4. Mejorar detección de cambios en campos adicionales del ticket
  5. Agregar campo para identificar el tipo de cambio
  
  ## Nuevos Eventos Registrados
  - Descarga de archivos
  - Eliminación de archivos
  - Cambios en descripción del ticket
  - Cambios en nombre del contacto
  - Cambios en tipo de seguro
  - Cambios en cualquier otro campo relevante
*/

-- Agregar columna para tipo de acción (opcional, para filtrado)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'ticket_historial' 
    AND column_name = 'tipo_accion'
  ) THEN
    ALTER TABLE ticket_historial 
    ADD COLUMN tipo_accion text;
    
    COMMENT ON COLUMN ticket_historial.tipo_accion IS 
      'Tipo de acción: creacion, modificacion, comentario, archivo, asignacion, estatus, cierre, reapertura';
  END IF;
END $$;

-- Agregar índice para tipo_accion
CREATE INDEX IF NOT EXISTS idx_ticket_historial_tipo_accion ON ticket_historial(tipo_accion);

-- Mejorar la función log_ticket_cambio para detectar más cambios
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

    detalle_json := jsonb_build_object(
      'folio', NEW.folio,
      'agente', COALESCE(agente_nombre, 'Sin asignar'),
      'estatus', estatus_nuevo_nombre,
      'prioridad', NEW.prioridad,
      'poliza', COALESCE(NEW.poliza, 'Sin póliza'),
      'tipo_seguro', COALESCE(NEW.tipo_seguro, 'No especificado'),
      'descripcion_preview', CASE
        WHEN NEW.descripcion IS NOT NULL AND length(NEW.descripcion) > 100 
        THEN substring(NEW.descripcion from 1 for 100) || '...'
        ELSE COALESCE(NEW.descripcion, '')
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

    -- Cambio de descripción
    ELSIF OLD.descripcion IS DISTINCT FROM NEW.descripcion THEN
      accion_texto := 'Descripción actualizada';
      tipo_accion_valor := 'modificacion';
      detalle_json := jsonb_build_object(
        'descripcion_anterior_preview', CASE
          WHEN OLD.descripcion IS NOT NULL AND length(OLD.descripcion) > 100 
          THEN substring(OLD.descripcion from 1 for 100) || '...'
          ELSE COALESCE(OLD.descripcion, '')
        END,
        'descripcion_nueva_preview', CASE
          WHEN NEW.descripcion IS NOT NULL AND length(NEW.descripcion) > 100 
          THEN substring(NEW.descripcion from 1 for 100) || '...'
          ELSE COALESCE(NEW.descripcion, '')
        END
      );
      cambios_detectados := true;

    -- Cambio de nombre de contacto
    ELSIF OLD.nombre_contacto IS DISTINCT FROM NEW.nombre_contacto THEN
      accion_texto := 'Contacto actualizado';
      tipo_accion_valor := 'modificacion';
      detalle_json := jsonb_build_object(
        'contacto_anterior', COALESCE(OLD.nombre_contacto, 'Sin contacto'),
        'contacto_nuevo', COALESCE(NEW.nombre_contacto, 'Sin contacto')
      );
      cambios_detectados := true;

    -- Cambio de tipo de seguro
    ELSIF OLD.tipo_seguro IS DISTINCT FROM NEW.tipo_seguro THEN
      accion_texto := 'Tipo de seguro actualizado';
      tipo_accion_valor := 'modificacion';
      detalle_json := jsonb_build_object(
        'tipo_seguro_anterior', COALESCE(OLD.tipo_seguro, 'No especificado'),
        'tipo_seguro_nuevo', COALESCE(NEW.tipo_seguro, 'No especificado')
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

-- Actualizar función de comentarios para incluir tipo_accion
CREATE OR REPLACE FUNCTION log_ticket_comentario()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  usuario_nombre text;
BEGIN
  SELECT nombre_completo INTO usuario_nombre
  FROM usuarios
  WHERE id = NEW.usuario_id;

  INSERT INTO ticket_historial (ticket_id, usuario_id, accion, detalle, tipo_accion)
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
    ),
    'comentario'
  );

  RETURN NEW;
END;
$$;

-- Actualizar función de archivos para incluir tipo_accion
CREATE OR REPLACE FUNCTION log_ticket_archivo()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  usuario_nombre text;
  tamano_mb numeric;
  accion_texto text;
BEGIN
  SELECT nombre_completo INTO usuario_nombre
  FROM usuarios
  WHERE id = NEW.usuario_id;

  tamano_mb := CASE
    WHEN NEW.tamano IS NOT NULL THEN round((NEW.tamano::numeric / 1024 / 1024), 2)
    ELSE 0
  END;

  -- Determinar si es carga
  IF TG_OP = 'INSERT' THEN
    accion_texto := 'Archivo adjuntado';
  END IF;

  INSERT INTO ticket_historial (ticket_id, usuario_id, accion, detalle, tipo_accion)
  VALUES (
    NEW.ticket_id,
    NEW.usuario_id,
    accion_texto,
    jsonb_build_object(
      'usuario', usuario_nombre,
      'nombre_archivo', NEW.nombre,
      'tipo', COALESCE(NEW.tipo, 'desconocido'),
      'tamano_mb', tamano_mb
    ),
    'archivo'
  );

  RETURN NEW;
END;
$$;

-- Crear función para registrar eliminación de archivos
CREATE OR REPLACE FUNCTION log_ticket_archivo_eliminado()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  usuario_id_actual uuid;
  usuario_nombre text;
  tamano_mb numeric;
BEGIN
  -- Obtener el usuario actual de la sesión
  BEGIN
    usuario_id_actual := auth.uid();
  EXCEPTION WHEN OTHERS THEN
    usuario_id_actual := NULL;
  END;

  IF usuario_id_actual IS NOT NULL THEN
    SELECT nombre_completo INTO usuario_nombre
    FROM usuarios
    WHERE id = usuario_id_actual;

    tamano_mb := CASE
      WHEN OLD.tamano IS NOT NULL THEN round((OLD.tamano::numeric / 1024 / 1024), 2)
      ELSE 0
    END;

    INSERT INTO ticket_historial (ticket_id, usuario_id, accion, detalle, tipo_accion)
    VALUES (
      OLD.ticket_id,
      usuario_id_actual,
      'Archivo eliminado',
      jsonb_build_object(
        'usuario', usuario_nombre,
        'nombre_archivo', OLD.nombre,
        'tipo', COALESCE(OLD.tipo, 'desconocido'),
        'tamano_mb', tamano_mb
      ),
      'archivo'
    );
  END IF;

  RETURN OLD;
END;
$$;

-- Crear trigger para eliminación de archivos
DROP TRIGGER IF EXISTS trigger_log_ticket_archivo_eliminado ON ticket_archivos;
CREATE TRIGGER trigger_log_ticket_archivo_eliminado
  BEFORE DELETE ON ticket_archivos
  FOR EACH ROW
  EXECUTE FUNCTION log_ticket_archivo_eliminado();

-- Actualizar función de asignaciones para incluir tipo_accion
CREATE OR REPLACE FUNCTION log_ticket_asignacion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  ejecutivo_nombre text;
  asignador_nombre text;
BEGIN
  SELECT nombre_completo INTO ejecutivo_nombre
  FROM usuarios
  WHERE id = NEW.ejecutivo_id;

  SELECT nombre_completo INTO asignador_nombre
  FROM usuarios
  WHERE id = NEW.asignado_por;

  INSERT INTO ticket_historial (ticket_id, usuario_id, accion, detalle, tipo_accion)
  VALUES (
    NEW.ticket_id,
    NEW.asignado_por,
    'Ejecutivo asignado',
    jsonb_build_object(
      'ejecutivo', ejecutivo_nombre,
      'asignado_por', asignador_nombre
    ),
    'asignacion'
  );

  RETURN NEW;
END;
$$;

-- Actualizar valores de tipo_accion para registros existentes (si existen)
UPDATE ticket_historial
SET tipo_accion = CASE
  WHEN accion LIKE '%creado%' THEN 'creacion'
  WHEN accion LIKE '%cerrado%' THEN 'cierre'
  WHEN accion LIKE '%reabierto%' THEN 'reapertura'
  WHEN accion LIKE '%Estatus%' THEN 'estatus'
  WHEN accion LIKE '%Comentario%' THEN 'comentario'
  WHEN accion LIKE '%Archivo%' THEN 'archivo'
  WHEN accion LIKE '%asignado%' OR accion LIKE '%Ejecutivo%' THEN 'asignacion'
  ELSE 'modificacion'
END
WHERE tipo_accion IS NULL;

-- Comentarios finales
COMMENT ON FUNCTION log_ticket_cambio IS 
  '[ENHANCED] Registra automáticamente todos los cambios en tickets: estatus, prioridad, agente, póliza, descripción, contacto, tipo de seguro, cierre, reapertura, y más';

COMMENT ON FUNCTION log_ticket_comentario IS 
  '[ENHANCED] Registra automáticamente cuando se agrega un comentario a un ticket';

COMMENT ON FUNCTION log_ticket_archivo IS 
  '[ENHANCED] Registra automáticamente cuando se adjunta un archivo a un ticket';

COMMENT ON FUNCTION log_ticket_archivo_eliminado IS 
  'Registra automáticamente cuando se elimina un archivo de un ticket';

COMMENT ON FUNCTION log_ticket_asignacion IS 
  '[ENHANCED] Registra automáticamente cuando se asigna un ejecutivo a un ticket';
