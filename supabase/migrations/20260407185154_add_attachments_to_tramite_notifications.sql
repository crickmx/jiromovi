/*
  # Agregar adjuntos a notificaciones de trámites
  
  1. Cambios
    - Crear función enviar_notificacion_transaccional con soporte para adjuntos
    - Modificar todas las funciones de notificación de trámites
    - Incluir TODOS los archivos del trámite en todas las notificaciones por email
  
  2. Características
    - Los archivos se adjuntan automáticamente a los correos
    - Se obtienen todos los archivos del trámite desde ticket_archivos
    - Compatible con el sistema de notification_jobs existente
*/

-- Función para enviar notificación transaccional con adjuntos
CREATE OR REPLACE FUNCTION enviar_notificacion_transaccional(
  p_codigo_tipo text,
  p_destinatario_id uuid,
  p_variables jsonb DEFAULT '{}'::jsonb,
  p_adjuntos jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_template record;
  v_destinatario record;
  v_channels text[];
BEGIN
  -- Obtener información del destinatario
  SELECT 
    id,
    nombre_completo,
    email_laboral,
    celular_laboral
  INTO v_destinatario
  FROM usuarios
  WHERE id = p_destinatario_id
    AND deleted_at IS NULL
    AND estado != 'eliminado';
  
  IF NOT FOUND THEN
    RAISE WARNING '[NOTIF TRANSACCIONAL] Destinatario no encontrado o inactivo: %', p_destinatario_id;
    RETURN;
  END IF;
  
  -- Obtener plantilla y canales configurados
  SELECT 
    t.codigo,
    t.nombre as tipo_nombre,
    p.asunto,
    p.html_cuerpo,
    p.whatsapp_template,
    p.canales_activos
  INTO v_template
  FROM correo_tipos_notificacion t
  LEFT JOIN correo_plantillas p ON p.tipo_notificacion_id = t.id AND p.es_plantilla_default = true
  WHERE t.codigo = p_codigo_tipo
    AND t.activo = true;
  
  IF NOT FOUND THEN
    RAISE WARNING '[NOTIF TRANSACCIONAL] Tipo de notificación no encontrado o inactivo: %', p_codigo_tipo;
    RETURN;
  END IF;
  
  -- Obtener canales activos (por defecto todos)
  v_channels := COALESCE(v_template.canales_activos, ARRAY['email', 'whatsapp', 'in_app']);
  
  -- Crear jobs de notificación para cada canal activo
  IF 'email' = ANY(v_channels) AND v_destinatario.email_laboral IS NOT NULL THEN
    INSERT INTO notification_jobs (
      event_code,
      user_id,
      channel,
      payload,
      attachments,
      status
    ) VALUES (
      p_codigo_tipo,
      p_destinatario_id,
      'email',
      p_variables || jsonb_build_object(
        'email', v_destinatario.email_laboral,
        'nombre_completo', v_destinatario.nombre_completo
      ),
      p_adjuntos,
      'pending'
    );
    
    RAISE NOTICE '[NOTIF TRANSACCIONAL] ✅ Email job creado para % (adjuntos: %)', 
      v_destinatario.email_laboral, 
      CASE WHEN p_adjuntos IS NOT NULL THEN jsonb_array_length(p_adjuntos) ELSE 0 END;
  END IF;
  
  IF 'whatsapp' = ANY(v_channels) AND v_destinatario.celular_laboral IS NOT NULL THEN
    INSERT INTO notification_jobs (
      event_code,
      user_id,
      channel,
      payload,
      status
    ) VALUES (
      p_codigo_tipo,
      p_destinatario_id,
      'whatsapp',
      p_variables || jsonb_build_object(
        'phone', v_destinatario.celular_laboral,
        'nombre_completo', v_destinatario.nombre_completo
      ),
      'pending'
    );
    
    RAISE NOTICE '[NOTIF TRANSACCIONAL] ✅ WhatsApp job creado para %', v_destinatario.celular_laboral;
  END IF;
  
  IF 'in_app' = ANY(v_channels) THEN
    INSERT INTO notification_jobs (
      event_code,
      user_id,
      channel,
      payload,
      status
    ) VALUES (
      p_codigo_tipo,
      p_destinatario_id,
      'in_app',
      p_variables || jsonb_build_object(
        'nombre_completo', v_destinatario.nombre_completo
      ),
      'pending'
    );
    
    RAISE NOTICE '[NOTIF TRANSACCIONAL] ✅ In-app job creado';
  END IF;
  
END;
$$;

-- Función auxiliar para obtener todos los archivos de un trámite
CREATE OR REPLACE FUNCTION get_tramite_attachments(p_ticket_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_attachments jsonb;
BEGIN
  SELECT jsonb_agg(
    jsonb_build_object(
      'filename', nombre,
      'path', url,
      'content_type', COALESCE(tipo, 'application/octet-stream'),
      'size', tamano
    )
  )
  INTO v_attachments
  FROM ticket_archivos
  WHERE ticket_id = p_ticket_id
    AND deleted_at IS NULL
  ORDER BY created_at ASC;
  
  RETURN COALESCE(v_attachments, '[]'::jsonb);
END;
$$;

-- Actualizar función para notificar nuevo comentario (CON ADJUNTOS)
CREATE OR REPLACE FUNCTION notificar_comentario_tramite()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_tramite RECORD;
  v_agente RECORD;
  v_autor RECORD;
  v_url TEXT;
  v_adjuntos jsonb;
BEGIN
  SELECT t.*, te.nombre as estatus_nombre
  INTO v_tramite
  FROM tickets t
  LEFT JOIN ticket_estatus te ON t.estatus_id = te.id
  WHERE t.id = NEW.ticket_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  SELECT id, nombre_completo, email_laboral, celular_laboral
  INTO v_agente
  FROM usuarios
  WHERE id = v_tramite.agente_id;

  IF NOT FOUND OR v_agente.id = NEW.usuario_id THEN
    RETURN NEW;
  END IF;

  SELECT nombre_completo, rol
  INTO v_autor
  FROM usuarios
  WHERE id = NEW.usuario_id;

  v_url := '/tramites/' || v_tramite.id;
  
  -- Obtener TODOS los archivos del trámite
  v_adjuntos := get_tramite_attachments(v_tramite.id);

  PERFORM enviar_notificacion_transaccional(
    p_codigo_tipo := 'tramite_comentario_nuevo',
    p_destinatario_id := v_agente.id,
    p_variables := jsonb_build_object(
      'folio', v_tramite.folio,
      'agente_nombre', v_agente.nombre_completo,
      'comentario', NEW.mensaje,
      'autor_nombre', v_autor.nombre_completo,
      'autor_rol', v_autor.rol,
      'tipo_tramite', v_tramite.tipo_tramite,
      'estatus', COALESCE(v_tramite.estatus_nombre, 'Sin estatus'),
      'url', v_url
    ),
    p_adjuntos := v_adjuntos
  );

  RETURN NEW;
END;
$$;

-- Actualizar función para notificar cambio de estatus (CON ADJUNTOS)
CREATE OR REPLACE FUNCTION notificar_cambio_estatus_tramite()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_agente RECORD;
  v_modificador RECORD;
  v_estatus_anterior TEXT;
  v_estatus_nuevo TEXT;
  v_url TEXT;
  v_adjuntos jsonb;
BEGIN
  IF OLD.estatus_id IS NOT DISTINCT FROM NEW.estatus_id THEN
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

  SELECT nombre INTO v_estatus_anterior
  FROM ticket_estatus
  WHERE id = OLD.estatus_id;

  SELECT nombre INTO v_estatus_nuevo
  FROM ticket_estatus
  WHERE id = NEW.estatus_id;

  v_url := '/tramites/' || NEW.id;
  
  -- Obtener TODOS los archivos del trámite
  v_adjuntos := get_tramite_attachments(NEW.id);

  PERFORM enviar_notificacion_transaccional(
    p_codigo_tipo := 'tramite_cambio_estatus',
    p_destinatario_id := v_agente.id,
    p_variables := jsonb_build_object(
      'folio', NEW.folio,
      'agente_nombre', v_agente.nombre_completo,
      'estatus_anterior', COALESCE(v_estatus_anterior, 'Sin estatus'),
      'estatus_nuevo', COALESCE(v_estatus_nuevo, 'Sin estatus'),
      'modificado_por', v_modificador.nombre_completo,
      'rol_modificador', v_modificador.rol,
      'tipo_tramite', NEW.tipo_tramite,
      'url', v_url
    ),
    p_adjuntos := v_adjuntos
  );

  RETURN NEW;
END;
$$;

-- Actualizar función para notificar documento cargado (CON ADJUNTOS)
CREATE OR REPLACE FUNCTION notificar_documento_tramite()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_tramite RECORD;
  v_agente RECORD;
  v_subidor RECORD;
  v_tamano_texto TEXT;
  v_url TEXT;
  v_adjuntos jsonb;
BEGIN
  SELECT t.*, te.nombre as estatus_nombre
  INTO v_tramite
  FROM tickets t
  LEFT JOIN ticket_estatus te ON t.estatus_id = te.id
  WHERE t.id = NEW.ticket_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  SELECT id, nombre_completo, email_laboral, celular_laboral
  INTO v_agente
  FROM usuarios
  WHERE id = v_tramite.agente_id;

  IF NOT FOUND OR v_agente.id = NEW.usuario_id THEN
    RETURN NEW;
  END IF;

  SELECT nombre_completo, rol
  INTO v_subidor
  FROM usuarios
  WHERE id = NEW.usuario_id;

  IF NEW.tamano IS NOT NULL THEN
    IF NEW.tamano < 1024 THEN
      v_tamano_texto := NEW.tamano || ' bytes';
    ELSIF NEW.tamano < 1048576 THEN
      v_tamano_texto := ROUND(NEW.tamano / 1024.0, 2) || ' KB';
    ELSE
      v_tamano_texto := ROUND(NEW.tamano / 1048576.0, 2) || ' MB';
    END IF;
  ELSE
    v_tamano_texto := 'Desconocido';
  END IF;

  v_url := '/tramites/' || v_tramite.id;
  
  -- Obtener TODOS los archivos del trámite
  v_adjuntos := get_tramite_attachments(v_tramite.id);

  PERFORM enviar_notificacion_transaccional(
    p_codigo_tipo := 'tramite_documento_cargado',
    p_destinatario_id := v_agente.id,
    p_variables := jsonb_build_object(
      'folio', v_tramite.folio,
      'agente_nombre', v_agente.nombre_completo,
      'nombre_archivo', NEW.nombre,
      'subido_por', v_subidor.nombre_completo,
      'rol_subidor', v_subidor.rol,
      'tamano_archivo', v_tamano_texto,
      'tipo_tramite', v_tramite.tipo_tramite,
      'estatus', COALESCE(v_tramite.estatus_nombre, 'Sin estatus'),
      'url', v_url
    ),
    p_adjuntos := v_adjuntos
  );

  RETURN NEW;
END;
$$;

-- Actualizar función para notificar actualización general (CON ADJUNTOS)
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
  v_adjuntos jsonb;
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

  IF OLD.responsable_id IS DISTINCT FROM NEW.responsable_id THEN
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

  v_url := '/tramites/' || NEW.id;
  
  -- Obtener TODOS los archivos del trámite
  v_adjuntos := get_tramite_attachments(NEW.id);

  PERFORM enviar_notificacion_transaccional(
    p_codigo_tipo := 'tramite_actualizado',
    p_destinatario_id := v_agente.id,
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
    p_adjuntos := v_adjuntos
  );

  RETURN NEW;
END;
$$;

-- Asegurar que la columna attachments existe en notification_jobs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'notification_jobs' 
    AND column_name = 'attachments'
  ) THEN
    ALTER TABLE notification_jobs 
    ADD COLUMN attachments jsonb;
    
    COMMENT ON COLUMN notification_jobs.attachments IS 'Array de adjuntos con filename, path, content_type';
  END IF;
END $$;

-- Actualizar plantillas de correo para mencionar adjuntos
UPDATE correo_plantillas
SET html_cuerpo = REPLACE(
  html_cuerpo,
  '<p>El documento está adjunto a este correo.</p>',
  '<p>Todos los documentos del trámite están adjuntos a este correo.</p>'
)
WHERE tipo_notificacion_id IN (
  SELECT id FROM correo_tipos_notificacion 
  WHERE codigo IN ('tramite_documento_cargado', 'tramite_comentario_nuevo', 'tramite_cambio_estatus', 'tramite_actualizado')
);

-- Agregar nota sobre adjuntos a las plantillas que no la tienen
UPDATE correo_plantillas
SET html_cuerpo = REPLACE(
  html_cuerpo,
  '<p><a href="{{url}}"',
  '<p><em>Nota: Todos los documentos del trámite están adjuntos a este correo.</em></p>
  <p><a href="{{url}}"'
)
WHERE tipo_notificacion_id IN (
  SELECT id FROM correo_tipos_notificacion 
  WHERE codigo IN ('tramite_comentario_nuevo', 'tramite_cambio_estatus', 'tramite_actualizado')
)
AND html_cuerpo NOT LIKE '%adjuntos%';

COMMENT ON FUNCTION enviar_notificacion_transaccional IS 
  'Envía notificaciones transaccionales con soporte para adjuntos. Crea notification_jobs para cada canal configurado.';

COMMENT ON FUNCTION get_tramite_attachments IS 
  'Obtiene todos los archivos de un trámite en formato JSON para adjuntar a correos';
