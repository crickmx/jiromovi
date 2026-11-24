/*
  # Sistema de Notificaciones para Trámites

  1. Tipos de Notificación
    - tramite_comentario_nuevo
    - tramite_cambio_estatus  
    - tramite_documento_cargado
    - tramite_actualizado

  2. Plantillas de Notificación  
    - Crear plantillas para cada tipo

  3. Triggers
    - Trigger para comentarios
    - Trigger para cambio de estatus
    - Trigger para documentos
    - Trigger para actualizaciones generales
*/

-- Crear tipos de notificación y plantillas
DO $$
DECLARE
  v_tipo_id uuid;
  v_plantilla_existe boolean;
BEGIN
  -- Tipo: tramite_comentario_nuevo
  SELECT id INTO v_tipo_id
  FROM correo_tipos_notificacion
  WHERE codigo = 'tramite_comentario_nuevo';

  IF v_tipo_id IS NULL THEN
    INSERT INTO correo_tipos_notificacion (
      codigo,
      nombre,
      descripcion,
      activo
    ) VALUES (
      'tramite_comentario_nuevo',
      'Nuevo Comentario en Trámite',
      'Se envía cuando un empleado/gerente/administrador agrega un comentario en un trámite',
      true
    ) RETURNING id INTO v_tipo_id;
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM correo_plantillas WHERE tipo_notificacion_id = v_tipo_id AND es_plantilla_default = true
  ) INTO v_plantilla_existe;

  IF NOT v_plantilla_existe THEN
    INSERT INTO correo_plantillas (
      tipo_notificacion_id,
      asunto,
      html_cuerpo,
      variables_disponibles,
      es_plantilla_default
    ) VALUES (
      v_tipo_id,
      'Nuevo comentario en tu trámite {{folio}}',
      '<h2>Hola {{agente_nombre}}</h2>
      <p>Se ha agregado un nuevo comentario en tu trámite <strong>{{folio}}</strong>:</p>
      <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <p><strong>{{autor_nombre}}</strong> ({{autor_rol}}):</p>
        <p>{{comentario}}</p>
      </div>
      <p><strong>Tipo de trámite:</strong> {{tipo_tramite}}</p>
      <p><strong>Estatus actual:</strong> {{estatus}}</p>
      <p><a href="{{url}}" style="display: inline-block; padding: 10px 20px; background: #0066cc; color: white; text-decoration: none; border-radius: 5px;">Ver Trámite</a></p>',
      ARRAY['folio', 'agente_nombre', 'comentario', 'autor_nombre', 'autor_rol', 'tipo_tramite', 'estatus', 'url'],
      true
    );
  END IF;

  -- Tipo: tramite_cambio_estatus
  SELECT id INTO v_tipo_id
  FROM correo_tipos_notificacion
  WHERE codigo = 'tramite_cambio_estatus';

  IF v_tipo_id IS NULL THEN
    INSERT INTO correo_tipos_notificacion (
      codigo,
      nombre,
      descripcion,
      activo
    ) VALUES (
      'tramite_cambio_estatus',
      'Cambio de Estatus en Trámite',
      'Se envía cuando cambia el estatus de un trámite',
      true
    ) RETURNING id INTO v_tipo_id;
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM correo_plantillas WHERE tipo_notificacion_id = v_tipo_id AND es_plantilla_default = true
  ) INTO v_plantilla_existe;

  IF NOT v_plantilla_existe THEN
    INSERT INTO correo_plantillas (
      tipo_notificacion_id,
      asunto,
      html_cuerpo,
      variables_disponibles,
      es_plantilla_default
    ) VALUES (
      v_tipo_id,
      'El estatus de tu trámite {{folio}} cambió a {{estatus_nuevo}}',
      '<h2>Hola {{agente_nombre}}</h2>
      <p>El estatus de tu trámite <strong>{{folio}}</strong> ha sido actualizado:</p>
      <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <p><strong>Estatus anterior:</strong> {{estatus_anterior}}</p>
        <p><strong>Estatus nuevo:</strong> {{estatus_nuevo}}</p>
        <p><strong>Actualizado por:</strong> {{modificado_por}} ({{rol_modificador}})</p>
      </div>
      <p><strong>Tipo de trámite:</strong> {{tipo_tramite}}</p>
      <p><a href="{{url}}" style="display: inline-block; padding: 10px 20px; background: #0066cc; color: white; text-decoration: none; border-radius: 5px;">Ver Trámite</a></p>',
      ARRAY['folio', 'agente_nombre', 'estatus_anterior', 'estatus_nuevo', 'modificado_por', 'rol_modificador', 'tipo_tramite', 'url'],
      true
    );
  END IF;

  -- Tipo: tramite_documento_cargado
  SELECT id INTO v_tipo_id
  FROM correo_tipos_notificacion
  WHERE codigo = 'tramite_documento_cargado';

  IF v_tipo_id IS NULL THEN
    INSERT INTO correo_tipos_notificacion (
      codigo,
      nombre,
      descripcion,
      activo
    ) VALUES (
      'tramite_documento_cargado',
      'Nuevo Documento en Trámite',
      'Se envía cuando se carga un nuevo documento en un trámite',
      true
    ) RETURNING id INTO v_tipo_id;
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM correo_plantillas WHERE tipo_notificacion_id = v_tipo_id AND es_plantilla_default = true
  ) INTO v_plantilla_existe;

  IF NOT v_plantilla_existe THEN
    INSERT INTO correo_plantillas (
      tipo_notificacion_id,
      asunto,
      html_cuerpo,
      variables_disponibles,
      es_plantilla_default
    ) VALUES (
      v_tipo_id,
      'Nuevo documento cargado en tu trámite {{folio}}',
      '<h2>Hola {{agente_nombre}}</h2>
      <p>Se ha cargado un nuevo documento en tu trámite <strong>{{folio}}</strong>:</p>
      <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <p><strong>Archivo:</strong> {{nombre_archivo}}</p>
        <p><strong>Cargado por:</strong> {{subido_por}} ({{rol_subidor}})</p>
        <p><strong>Tamaño:</strong> {{tamano_archivo}}</p>
      </div>
      <p><strong>Tipo de trámite:</strong> {{tipo_tramite}}</p>
      <p><strong>Estatus actual:</strong> {{estatus}}</p>
      <p>El documento está adjunto a este correo.</p>
      <p><a href="{{url}}" style="display: inline-block; padding: 10px 20px; background: #0066cc; color: white; text-decoration: none; border-radius: 5px;">Ver Trámite</a></p>',
      ARRAY['folio', 'agente_nombre', 'nombre_archivo', 'subido_por', 'rol_subidor', 'tamano_archivo', 'tipo_tramite', 'estatus', 'url'],
      true
    );
  END IF;

  -- Tipo: tramite_actualizado
  SELECT id INTO v_tipo_id
  FROM correo_tipos_notificacion
  WHERE codigo = 'tramite_actualizado';

  IF v_tipo_id IS NULL THEN
    INSERT INTO correo_tipos_notificacion (
      codigo,
      nombre,
      descripcion,
      activo
    ) VALUES (
      'tramite_actualizado',
      'Trámite Actualizado',
      'Se envía cuando se actualiza información de un trámite',
      true
    ) RETURNING id INTO v_tipo_id;
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM correo_plantillas WHERE tipo_notificacion_id = v_tipo_id AND es_plantilla_default = true
  ) INTO v_plantilla_existe;

  IF NOT v_plantilla_existe THEN
    INSERT INTO correo_plantillas (
      tipo_notificacion_id,
      asunto,
      html_cuerpo,
      variables_disponibles,
      es_plantilla_default
    ) VALUES (
      v_tipo_id,
      'Tu trámite {{folio}} ha sido actualizado',
      '<h2>Hola {{agente_nombre}}</h2>
      <p>Tu trámite <strong>{{folio}}</strong> ha sido actualizado:</p>
      <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <p><strong>Actualizado por:</strong> {{modificado_por}} ({{rol_modificador}})</p>
        <p><strong>Campos modificados:</strong> {{campos_modificados}}</p>
      </div>
      <p><strong>Tipo de trámite:</strong> {{tipo_tramite}}</p>
      <p><strong>Estatus actual:</strong> {{estatus}}</p>
      <p><a href="{{url}}" style="display: inline-block; padding: 10px 20px; background: #0066cc; color: white; text-decoration: none; border-radius: 5px;">Ver Trámite</a></p>',
      ARRAY['folio', 'agente_nombre', 'modificado_por', 'rol_modificador', 'campos_modificados', 'tipo_tramite', 'estatus', 'url'],
      true
    );
  END IF;
END $$;

-- Función para notificar nuevo comentario
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

  v_url := 'https://moviapp.com/tramites/' || v_tramite.id;

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
    )
  );

  RETURN NEW;
END;
$$;

-- Función para notificar cambio de estatus
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

  v_url := 'https://moviapp.com/tramites/' || NEW.id;

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
    )
  );

  RETURN NEW;
END;
$$;

-- Función para notificar documento cargado (con adjunto)
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

  v_url := 'https://moviapp.com/tramites/' || v_tramite.id;

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
    p_adjuntos := jsonb_build_array(
      jsonb_build_object(
        'filename', NEW.nombre,
        'path', NEW.url,
        'content_type', COALESCE(NEW.tipo, 'application/octet-stream')
      )
    )
  );

  RETURN NEW;
END;
$$;

-- Función para notificar actualización general
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

  v_url := 'https://moviapp.com/tramites/' || NEW.id;

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
    )
  );

  RETURN NEW;
END;
$$;

-- Crear triggers
DROP TRIGGER IF EXISTS trigger_notificar_comentario_tramite ON ticket_comentarios;
CREATE TRIGGER trigger_notificar_comentario_tramite
  AFTER INSERT ON ticket_comentarios
  FOR EACH ROW
  EXECUTE FUNCTION notificar_comentario_tramite();

DROP TRIGGER IF EXISTS trigger_notificar_cambio_estatus_tramite ON tickets;
CREATE TRIGGER trigger_notificar_cambio_estatus_tramite
  AFTER UPDATE ON tickets
  FOR EACH ROW
  EXECUTE FUNCTION notificar_cambio_estatus_tramite();

DROP TRIGGER IF EXISTS trigger_notificar_documento_tramite ON ticket_archivos;
CREATE TRIGGER trigger_notificar_documento_tramite
  AFTER INSERT ON ticket_archivos
  FOR EACH ROW
  EXECUTE FUNCTION notificar_documento_tramite();

DROP TRIGGER IF EXISTS trigger_notificar_actualizacion_tramite ON tickets;
CREATE TRIGGER trigger_notificar_actualizacion_tramite
  AFTER UPDATE ON tickets
  FOR EACH ROW
  EXECUTE FUNCTION notificar_actualizacion_tramite();
