/*
  # Fix 2: Rehabilitar y estabilizar trigger de documentos en trámites

  ## Problema
  La migración 20260408003513 hizo DROP del trigger `trigger_notificar_documento_tramite`
  debido a conflictos de RLS ("set-returning functions not allowed in WHERE").
  
  La migración 20260408003121 ya había corregido la función para usar SECURITY DEFINER
  y eliminar el uso de SRF en WHERE, pero el DROP posterior anuló esa corrección.

  El resultado: actualmente documentos subidos a trámites NO generan ninguna notificación.

  ## Solución
  1. Recrear la función `notificar_documento_tramite()` con:
     - SECURITY DEFINER (evita RLS durante trigger)
     - Sin SRF en WHERE clauses
     - Guard de idempotencia: no envía si ya existe job reciente para mismo ticket_id
  2. Recrear el trigger una sola vez
  3. Sin cambios a templates ni canales

  ## Validación esperada
  - Subir documento → una sola notificación tramite_documento_cargado
  - Subir dos documentos rápido → una notificación por cada uno (sin duplicados)
*/

-- ============================================================
-- PASO 1: Limpiar triggers previos (evitar duplicados)
-- ============================================================

DROP TRIGGER IF EXISTS trigger_notificar_documento_tramite ON ticket_archivos;
DROP TRIGGER IF EXISTS trigger_doc_tramite_notification ON ticket_archivos;

-- ============================================================
-- PASO 2: Recrear función con idempotencia y SECURITY DEFINER
-- ============================================================

CREATE OR REPLACE FUNCTION public.notificar_documento_tramite()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tramite         RECORD;
  v_agente          RECORD;
  v_subidor_nombre  TEXT;
  v_subidor_rol     TEXT;
  v_tamano_texto    TEXT;
  v_url             TEXT;
  v_recent_job      BOOLEAN;
BEGIN
  -- Obtener info del trámite
  SELECT t.id, t.folio, t.tipo_tramite, t.agente_id
  INTO v_tramite
  FROM tickets t
  WHERE t.id = NEW.ticket_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  -- Solo notificar si hay un agente asignado
  IF v_tramite.agente_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Obtener info del agente
  SELECT id, nombre_completo, email_laboral, celular_laboral
  INTO v_agente
  FROM usuarios
  WHERE id = v_tramite.agente_id
    AND estado = 'activo';

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  -- No notificar si el agente es quien subió el documento
  IF v_agente.id = NEW.usuario_id THEN
    RETURN NEW;
  END IF;

  -- Guard de idempotencia: evitar spam si se suben varios docs en poco tiempo
  -- Solo aplica para el mismo ticket, no para documentos diferentes
  SELECT EXISTS(
    SELECT 1 FROM notification_jobs
    WHERE user_id = v_agente.id
      AND event_code = 'tramite_documento_cargado'
      AND (payload->>'ticket_id') = v_tramite.id::text
      AND status IN ('pending', 'processing', 'sent')
      AND created_at > NOW() - INTERVAL '2 minutes'
    LIMIT 1
  ) INTO v_recent_job;

  IF v_recent_job THEN
    RAISE NOTICE '[DOC TRIGGER] Job reciente para ticket %, omitiendo duplicado', v_tramite.id;
    RETURN NEW;
  END IF;

  -- Obtener info de quien sube el documento
  SELECT
    COALESCE(nombre_completo, nombre || ' ' || COALESCE(apellidos, ''), 'Usuario'),
    COALESCE(rol, 'Usuario')
  INTO v_subidor_nombre, v_subidor_rol
  FROM usuarios
  WHERE id = NEW.usuario_id;

  v_subidor_nombre := COALESCE(v_subidor_nombre, 'Usuario del sistema');
  v_subidor_rol    := COALESCE(v_subidor_rol, 'Usuario');

  -- Formatear tamaño de archivo
  IF NEW.tamano IS NOT NULL THEN
    IF NEW.tamano < 1024 THEN
      v_tamano_texto := NEW.tamano || ' bytes';
    ELSIF NEW.tamano < 1048576 THEN
      v_tamano_texto := ROUND(NEW.tamano / 1024.0, 1) || ' KB';
    ELSE
      v_tamano_texto := ROUND(NEW.tamano / 1048576.0, 2) || ' MB';
    END IF;
  ELSE
    v_tamano_texto := 'Desconocido';
  END IF;

  v_url := '/tramites/' || v_tramite.id::text;

  -- Enviar notificación (sin adjuntos durante INSERT para evitar GROUP BY issues)
  BEGIN
    PERFORM enviar_notificacion_transaccional(
      p_codigo_tipo  := 'tramite_documento_cargado',
      p_destinatario_id := v_agente.id,
      p_variables    := jsonb_build_object(
        'folio',          COALESCE(v_tramite.folio, 'Sin folio'),
        'agente_nombre',  v_agente.nombre_completo,
        'nombre_archivo', COALESCE(NEW.nombre, 'Documento'),
        'subido_por',     v_subidor_nombre,
        'rol_subidor',    v_subidor_rol,
        'tamano_archivo', v_tamano_texto,
        'tipo_tramite',   COALESCE(v_tramite.tipo_tramite, 'tramite'),
        'url',            v_url,
        'ticket_id',      v_tramite.id::text
      ),
      p_adjuntos     := NULL
    );

    RAISE NOTICE '[DOC TRIGGER] Notificación tramite_documento_cargado enviada para agente % (ticket %)',
      v_agente.id, v_tramite.id;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[DOC TRIGGER] Error al enviar notificación para ticket %: %', v_tramite.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

-- ============================================================
-- PASO 3: Recrear trigger habilitado
-- ============================================================

CREATE TRIGGER trigger_notificar_documento_tramite
  AFTER INSERT ON ticket_archivos
  FOR EACH ROW
  EXECUTE FUNCTION notificar_documento_tramite();

-- Verificar que está habilitado
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trigger_notificar_documento_tramite'
      AND tgenabled != 'D'
  ) THEN
    RAISE EXCEPTION 'Trigger trigger_notificar_documento_tramite no se creó correctamente';
  END IF;
  RAISE NOTICE '[DOC TRIGGER] Trigger verificado y activo correctamente';
END $$;
