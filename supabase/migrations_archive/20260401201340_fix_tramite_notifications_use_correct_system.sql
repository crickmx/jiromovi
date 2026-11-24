/*
  # Fix Notificaciones de Trámites - Usar Sistema Correcto

  1. Problema
    - Los triggers de trámites llaman a función inexistente
    - Deben usar send_transactional_notification
    - Las plantillas deben estar en transactional_notification_templates

  2. Solución
    - Crear plantillas en transactional_notification_templates
    - Actualizar funciones de triggers
*/

-- Crear plantillas en transactional_notification_templates
DO $$
BEGIN
  -- Plantilla: tramite_comentario_nuevo
  IF NOT EXISTS (SELECT 1 FROM transactional_notification_templates WHERE event_key = 'tramite_comentario_nuevo') THEN
    INSERT INTO transactional_notification_templates (
      event_key,
      name,
      email_subject_template,
      email_body_template,
      whatsapp_body_template,
      inapp_title_template,
      inapp_body_template,
      is_active
    ) VALUES (
      'tramite_comentario_nuevo',
      'Nuevo Comentario en Trámite',
      'Nuevo comentario en tu trámite {{folio}}',
      '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Hola {{agente_nombre}}</h2>
        <p>Se ha agregado un nuevo comentario en tu trámite <strong>{{folio}}</strong>:</p>
        <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p><strong>{{autor_nombre}}</strong> ({{autor_rol}}):</p>
          <p style="margin: 10px 0;">{{comentario}}</p>
        </div>
        <p><strong>Tipo de trámite:</strong> {{tipo_tramite}}</p>
        <p><strong>Estatus actual:</strong> {{estatus}}</p>
        <p style="margin-top: 20px;">
          <a href="{{url}}" style="display: inline-block; padding: 10px 20px; background: #0066cc; color: white; text-decoration: none; border-radius: 5px;">Ver Trámite</a>
        </p>
      </div>',
      'Hola {{agente_nombre}},

{{autor_nombre}} ({{autor_rol}}) comentó en tu trámite {{folio}}:

"{{comentario}}"

Tipo: {{tipo_tramite}}
Estatus: {{estatus}}

Ver más: {{url}}',
      'Nuevo comentario en trámite',
      '{{autor_nombre}} comentó en tu trámite {{folio}}',
      true
    );
  END IF;

  -- Plantilla: tramite_cambio_estatus
  IF NOT EXISTS (SELECT 1 FROM transactional_notification_templates WHERE event_key = 'tramite_cambio_estatus') THEN
    INSERT INTO transactional_notification_templates (
      event_key,
      name,
      email_subject_template,
      email_body_template,
      whatsapp_body_template,
      inapp_title_template,
      inapp_body_template,
      is_active
    ) VALUES (
      'tramite_cambio_estatus',
      'Cambio de Estatus en Trámite',
      'Tu trámite {{folio}} cambió a: {{estatus_nuevo}}',
      '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Hola {{agente_nombre}}</h2>
        <p>El estatus de tu trámite <strong>{{folio}}</strong> ha sido actualizado:</p>
        <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p><strong>Estatus anterior:</strong> {{estatus_anterior}}</p>
          <p><strong>Estatus nuevo:</strong> <span style="color: #0066cc; font-weight: bold;">{{estatus_nuevo}}</span></p>
          <p><strong>Actualizado por:</strong> {{modificado_por}} ({{rol_modificador}})</p>
        </div>
        <p><strong>Tipo de trámite:</strong> {{tipo_tramite}}</p>
        <p style="margin-top: 20px;">
          <a href="{{url}}" style="display: inline-block; padding: 10px 20px; background: #0066cc; color: white; text-decoration: none; border-radius: 5px;">Ver Trámite</a>
        </p>
      </div>',
      'Hola {{agente_nombre}},

Tu trámite {{folio}} cambió de estatus:

Anterior: {{estatus_anterior}}
Nuevo: {{estatus_nuevo}}

Actualizado por: {{modificado_por}} ({{rol_modificador}})

Tipo: {{tipo_tramite}}

Ver más: {{url}}',
      'Cambio de estatus en trámite',
      'Tu trámite {{folio}} ahora está en: {{estatus_nuevo}}',
      true
    );
  END IF;

  -- Plantilla: tramite_documento_cargado
  IF NOT EXISTS (SELECT 1 FROM transactional_notification_templates WHERE event_key = 'tramite_documento_cargado') THEN
    INSERT INTO transactional_notification_templates (
      event_key,
      name,
      email_subject_template,
      email_body_template,
      whatsapp_body_template,
      inapp_title_template,
      inapp_body_template,
      is_active
    ) VALUES (
      'tramite_documento_cargado',
      'Nuevo Documento en Trámite',
      'Nuevo documento en tu trámite {{folio}}',
      '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Hola {{agente_nombre}}</h2>
        <p>Se ha cargado un nuevo documento en tu trámite <strong>{{folio}}</strong>:</p>
        <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p><strong>Archivo:</strong> {{nombre_archivo}}</p>
          <p><strong>Cargado por:</strong> {{subido_por}} ({{rol_subidor}})</p>
          <p><strong>Tamaño:</strong> {{tamano_archivo}}</p>
        </div>
        <p><strong>Tipo de trámite:</strong> {{tipo_tramite}}</p>
        <p><strong>Estatus actual:</strong> {{estatus}}</p>
        <p style="margin-top: 20px;">
          <a href="{{url}}" style="display: inline-block; padding: 10px 20px; background: #0066cc; color: white; text-decoration: none; border-radius: 5px;">Ver Trámite y Descargar</a>
        </p>
      </div>',
      'Hola {{agente_nombre}},

Nuevo documento en tu trámite {{folio}}:

Archivo: {{nombre_archivo}}
Subido por: {{subido_por}} ({{rol_subidor}})
Tamaño: {{tamano_archivo}}

Tipo: {{tipo_tramite}}
Estatus: {{estatus}}

Ver más: {{url}}',
      'Nuevo documento en trámite',
      '{{subido_por}} cargó {{nombre_archivo}} en tu trámite',
      true
    );
  END IF;

  -- Plantilla: tramite_actualizado
  IF NOT EXISTS (SELECT 1 FROM transactional_notification_templates WHERE event_key = 'tramite_actualizado') THEN
    INSERT INTO transactional_notification_templates (
      event_key,
      name,
      email_subject_template,
      email_body_template,
      whatsapp_body_template,
      inapp_title_template,
      inapp_body_template,
      is_active
    ) VALUES (
      'tramite_actualizado',
      'Trámite Actualizado',
      'Tu trámite {{folio}} ha sido actualizado',
      '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Hola {{agente_nombre}}</h2>
        <p>Tu trámite <strong>{{folio}}</strong> ha sido actualizado:</p>
        <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p><strong>Actualizado por:</strong> {{modificado_por}} ({{rol_modificador}})</p>
          <p><strong>Campos modificados:</strong> {{campos_modificados}}</p>
        </div>
        <p><strong>Tipo de trámite:</strong> {{tipo_tramite}}</p>
        <p><strong>Estatus actual:</strong> {{estatus}}</p>
        <p style="margin-top: 20px;">
          <a href="{{url}}" style="display: inline-block; padding: 10px 20px; background: #0066cc; color: white; text-decoration: none; border-radius: 5px;">Ver Trámite</a>
        </p>
      </div>',
      'Hola {{agente_nombre}},

Tu trámite {{folio}} fue actualizado:

Actualizado por: {{modificado_por}} ({{rol_modificador}})
Cambios: {{campos_modificados}}

Tipo: {{tipo_tramite}}
Estatus: {{estatus}}

Ver más: {{url}}',
      'Trámite actualizado',
      '{{modificado_por}} actualizó tu trámite {{folio}}',
      true
    );
  END IF;
END $$;

-- Actualizar función para comentarios
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

  PERFORM send_transactional_notification(
    p_event_key := 'tramite_comentario_nuevo',
    p_user_id := v_agente.id,
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
    p_link_url := v_url
  );

  RETURN NEW;
END;
$$;

-- Actualizar función para cambio de estatus
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

  PERFORM send_transactional_notification(
    p_event_key := 'tramite_cambio_estatus',
    p_user_id := v_agente.id,
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
    p_link_url := v_url
  );

  RETURN NEW;
END;
$$;

-- Actualizar función para documentos
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

  PERFORM send_transactional_notification(
    p_event_key := 'tramite_documento_cargado',
    p_user_id := v_agente.id,
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
    p_link_url := v_url
  );

  RETURN NEW;
END;
$$;

-- Actualizar función para actualizaciones generales
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
