/*
  # Fix: Corregir URLs en funciones SQL a app.movi.digital

  1. Cambios
    - Actualizar funciones que generan URLs con moviapp.com
    - Actualizar funciones que usan movi.grupojiro.com
    - Actualizar funciones que usan www.movi.digital para app
    
  2. Funciones Afectadas
    - notificar_actualizacion_tramite
    - notificar_cambio_estatus_tramite
    - notificar_comentario_tramite
    - notificar_documento_tramite
    - notificar_equipos_nuevo_usuario
    - procesar_registro_no_usuario
*/

-- ============================================
-- Función: Notificar actualización de trámite
-- ============================================
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

-- ============================================
-- Función: Notificar cambio de estatus
-- ============================================
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

  v_url := 'https://app.movi.digital/tramites/' || NEW.id;

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

-- ============================================
-- Función: Notificar comentario en trámite
-- ============================================
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

  v_url := 'https://app.movi.digital/tramites/' || v_tramite.id;

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

-- ============================================
-- Función: Notificar documento cargado
-- ============================================
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

  v_url := 'https://app.movi.digital/tramites/' || v_tramite.id;

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

-- ============================================
-- Función: Notificar nuevo usuario a equipos
-- ============================================
CREATE OR REPLACE FUNCTION notificar_equipos_nuevo_usuario()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_destinatarios uuid[];
  v_destinatario uuid;
  v_oficina_nombre text;
  v_creador_nombre text;
  v_link_usuario text;
  v_datos jsonb;
BEGIN
  IF TG_OP != 'INSERT' THEN
    RETURN NEW;
  END IF;

  SELECT nombre INTO v_oficina_nombre
  FROM oficinas
  WHERE id = NEW.oficina_id;

  IF v_oficina_nombre IS NULL THEN
    v_oficina_nombre := 'Sin oficina asignada';
  END IF;

  v_creador_nombre := 'Sistema';
  IF current_setting('app.current_user_id', true) IS NOT NULL THEN
    SELECT nombre_completo INTO v_creador_nombre
    FROM usuarios
    WHERE id = current_setting('app.current_user_id', true)::uuid;

    IF v_creador_nombre IS NULL THEN
      v_creador_nombre := 'Administrador';
    END IF;
  END IF;

  v_link_usuario := 'https://app.movi.digital/usuario/' || NEW.id::text;

  v_datos := jsonb_build_object(
    'usuario_nombre', NEW.nombre,
    'usuario_apellidos', NEW.apellidos,
    'usuario_email_laboral', NEW.email_laboral,
    'usuario_rol', NEW.rol,
    'usuario_oficina', v_oficina_nombre,
    'usuario_fecha_alta', to_char(NEW.created_at, 'DD/MM/YYYY HH24:MI'),
    'creado_por', v_creador_nombre,
    'link_usuario', v_link_usuario
  );

  SELECT ARRAY_AGG(DISTINCT usuario_id)
  INTO v_destinatarios
  FROM correo_destinatarios_notificacion cdn
  INNER JOIN correo_tipos_notificacion ctn ON ctn.id = cdn.tipo_notificacion_id
  INNER JOIN usuarios u ON u.id = cdn.usuario_id
  WHERE ctn.codigo = 'nuevo_usuario_creado'
  AND ctn.activo = true
  AND u.estado = 'activo'
  AND u.rol IN ('Empleado', 'Gerente', 'Administrador');

  IF v_destinatarios IS NULL OR array_length(v_destinatarios, 1) = 0 THEN
    RAISE LOG '[nuevo_usuario] No hay destinatarios configurados para nuevo_usuario_creado';
    RETURN NEW;
  END IF;

  RAISE LOG '[nuevo_usuario] Notificando a % destinatarios sobre nuevo usuario: %', 
    array_length(v_destinatarios, 1), NEW.email_laboral;

  FOREACH v_destinatario IN ARRAY v_destinatarios
  LOOP
    BEGIN
      PERFORM enviar_notificacion_completa(
        p_tipo_codigo := 'nuevo_usuario_creado',
        p_user_id := v_destinatario,
        p_titulo := 'Nuevo usuario registrado',
        p_mensaje := NEW.nombre || ' ' || NEW.apellidos || ' (' || NEW.rol || ') se ha registrado en ' || v_oficina_nombre,
        p_modulo := 'usuarios',
        p_datos_adicionales := v_datos,
        p_accion_url := '/usuario/' || NEW.id::text
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE LOG '[nuevo_usuario] Error notificando a destinatario %: %', v_destinatario, SQLERRM;
    END;
  END LOOP;

  RETURN NEW;
END;
$$;

-- ============================================
-- Función: Procesar registro no usuario (DROP y recrear)
-- ============================================
DROP FUNCTION IF EXISTS procesar_registro_no_usuario(text,text,text,text,boolean,uuid,jsonb);

CREATE FUNCTION procesar_registro_no_usuario(
  p_nombre text,
  p_apellidos text,
  p_email text,
  p_whatsapp text,
  p_es_agente_jiro boolean,
  p_oficina_id uuid,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_registro_id uuid;
  v_tarea_id uuid;
  v_destinatario record;
  v_oficina_nombre text := 'N/A';
  v_nombre_completo text;
  v_es_agente_texto text;
  v_descripcion_tarea text;
  v_url_base text := 'https://app.movi.digital';
  v_estatus_nuevo_id uuid;
BEGIN
  SELECT id INTO v_estatus_nuevo_id
  FROM ticket_estatus
  WHERE nombre = 'Nuevo'
  LIMIT 1;

  IF v_estatus_nuevo_id IS NULL THEN
    RAISE EXCEPTION 'No se encontró el estatus "Nuevo"';
  END IF;

  INSERT INTO registros_no_usuarios (
    nombre,
    apellidos,
    email,
    whatsapp,
    es_agente_jiro,
    oficina_id,
    metadata
  ) VALUES (
    p_nombre,
    p_apellidos,
    p_email,
    p_whatsapp,
    p_es_agente_jiro,
    p_oficina_id,
    p_metadata
  )
  RETURNING id INTO v_registro_id;

  v_nombre_completo := p_nombre || ' ' || p_apellidos;
  v_es_agente_texto := CASE WHEN p_es_agente_jiro THEN 'Sí' ELSE 'No' END;

  IF p_oficina_id IS NOT NULL THEN
    SELECT nombre INTO v_oficina_nombre
    FROM oficinas
    WHERE id = p_oficina_id;
  END IF;

  v_descripcion_tarea := format(
    E'NUEVO REGISTRO DE USUARIO\n\n' ||
    'Nombre: %s\n' ||
    'Email: %s\n' ||
    'WhatsApp: %s\n' ||
    '¿Es agente de Jiro?: %s\n' ||
    'Oficina: %s\n\n' ||
    'Ver registro completo: %s/administrador/usuarios-pendientes',
    v_nombre_completo,
    p_email,
    p_whatsapp,
    v_es_agente_texto,
    v_oficina_nombre,
    v_url_base
  );

  IF p_es_agente_jiro AND p_oficina_id IS NOT NULL THEN
    FOR v_destinatario IN (
      SELECT id, nombre_completo
      FROM usuarios
      WHERE rol = 'Gerente'
      AND oficina_id = p_oficina_id
      AND estado IN ('Activo', 'Pendiente')
    ) LOOP
      INSERT INTO tickets (
        tipo_tramite,
        instrucciones,
        prioridad,
        estatus_id,
        assigned_to_user_id,
        agente_id,
        creado_por,
        metadata
      ) VALUES (
        'Lead – Registro MOVI',
        v_descripcion_tarea,
        'Alta',
        v_estatus_nuevo_id,
        v_destinatario.id,
        v_destinatario.id,
        v_destinatario.id,
        jsonb_build_object(
          'registro_id', v_registro_id,
          'tipo', 'registro_no_usuario',
          'email', p_email
        )
      )
      RETURNING id INTO v_tarea_id;

      PERFORM enviar_notificacion_completa(
        'nuevo_usuario_creado',
        v_destinatario.id,
        jsonb_build_object(
          'usuario_nombre', v_nombre_completo,
          'usuario_email', p_email
        )
      );
    END LOOP;
  END IF;

  FOR v_destinatario IN (
    SELECT id, nombre_completo
    FROM usuarios
    WHERE rol = 'Administrador'
    AND estado IN ('Activo', 'Pendiente')
  ) LOOP
    INSERT INTO tickets (
      tipo_tramite,
      instrucciones,
      prioridad,
      estatus_id,
      assigned_to_user_id,
      agente_id,
      creado_por,
      metadata
    ) VALUES (
      'Lead – Registro MOVI',
      v_descripcion_tarea,
      'Alta',
      v_estatus_nuevo_id,
      v_destinatario.id,
      v_destinatario.id,
      v_destinatario.id,
      jsonb_build_object(
        'registro_id', v_registro_id,
        'tipo', 'registro_no_usuario',
        'email', p_email
      )
    )
    RETURNING id INTO v_tarea_id;

    PERFORM enviar_notificacion_completa(
      'nuevo_usuario_creado',
      v_destinatario.id,
      jsonb_build_object(
        'usuario_nombre', v_nombre_completo,
        'usuario_email', p_email
      )
    );
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'registro_id', v_registro_id,
    'mensaje', 'Registro procesado exitosamente'
  );
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Error al procesar registro: %', SQLERRM;
END;
$$;
