/*
  # Agregar tipo de trámite "Lead – Registro MOVI"
  
  1. Cambios
    - Elimina el constraint actual de tipo_tramite
    - Crea nuevo constraint que incluye 'lead_registro_movi'
    - Actualiza la función para usar el tipo correcto
  
  2. Contexto
    - El constraint tickets_tipo_tramite_check solo aceptaba 3 tipos
    - Se necesita agregar soporte para leads de registro desde el formulario "Aún no soy usuario"
    - Esto permite crear tickets de prospección/registro de nuevos usuarios
*/

-- 1. Eliminar el constraint existente
ALTER TABLE tickets DROP CONSTRAINT IF EXISTS tickets_tipo_tramite_check;

-- 2. Crear nuevo constraint con el tipo adicional
ALTER TABLE tickets ADD CONSTRAINT tickets_tipo_tramite_check 
  CHECK (tipo_tramite IN (
    'correccion_poliza_registrada', 
    'correccion_comisiones', 
    'registro_poliza',
    'lead_registro_movi'
  ));

-- 3. Actualizar función para usar el tipo correcto
CREATE OR REPLACE FUNCTION procesar_registro_no_usuario(
  p_nombre text,
  p_apellidos text,
  p_email text,
  p_whatsapp text,
  p_es_agente_jiro boolean,
  p_oficina_id uuid DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_registro_id uuid;
  v_tarea_id uuid;
  v_destinatario record;
  v_oficina_nombre text := 'N/A';
  v_nombre_completo text;
  v_es_agente_texto text;
  v_descripcion_tarea text;
  v_url_base text := 'https://movi.grupojiro.com';
  v_estatus_nuevo_id uuid;
BEGIN
  -- Obtener ID del estado "Nuevo"
  SELECT id INTO v_estatus_nuevo_id
  FROM ticket_estatus
  WHERE nombre = 'Nuevo'
  AND activo = true
  LIMIT 1;

  IF v_estatus_nuevo_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Error de configuración: Estado de ticket no encontrado'
    );
  END IF;

  -- Validar email único (si ya existe nuevo, retornar mensaje)
  IF EXISTS (
    SELECT 1 FROM registro_interesados
    WHERE email = p_email
    AND status = 'nuevo'
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Ya recibimos tu solicitud anteriormente. Pronto te contactaremos.'
    );
  END IF;

  -- Validar que si es agente, tenga oficina
  IF p_es_agente_jiro AND p_oficina_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Debes seleccionar una oficina'
    );
  END IF;

  -- Obtener nombre de oficina si aplica
  IF p_oficina_id IS NOT NULL THEN
    SELECT nombre INTO v_oficina_nombre
    FROM oficinas
    WHERE id = p_oficina_id;
    
    IF v_oficina_nombre IS NULL THEN
      v_oficina_nombre := 'Oficina no encontrada';
    END IF;
  END IF;

  -- Preparar variables
  v_nombre_completo := p_nombre || ' ' || p_apellidos;
  v_es_agente_texto := CASE WHEN p_es_agente_jiro THEN 'Sí' ELSE 'No' END;

  -- 1. Crear registro en BD
  INSERT INTO registro_interesados (
    nombre,
    apellidos,
    email,
    whatsapp,
    es_agente_jiro,
    oficina_id,
    status,
    source,
    metadata
  ) VALUES (
    p_nombre,
    p_apellidos,
    p_email,
    p_whatsapp,
    p_es_agente_jiro,
    p_oficina_id,
    'nuevo',
    'login_registro',
    p_metadata
  ) RETURNING id INTO v_registro_id;

  -- 2. Preparar descripción de tarea
  v_descripcion_tarea := format(
    E'**Nuevo registro recibido**\n\n' ||
    E'**Nombre completo:** %s\n' ||
    E'**Email:** %s\n' ||
    E'**WhatsApp:** %s\n' ||
    E'**¿Es agente Grupo JIRO?:** %s\n' ||
    CASE WHEN p_es_agente_jiro
      THEN format(E'**Oficina:** %s\n', v_oficina_nombre)
      ELSE ''
    END ||
    E'**Fecha de registro:** %s\n\n' ||
    E'Por favor, contacta a esta persona lo antes posible.',
    v_nombre_completo,
    p_email,
    p_whatsapp,
    v_es_agente_texto,
    to_char(now(), 'DD/MM/YYYY HH24:MI')
  );

  -- 3. Determinar destinatarios y crear tareas
  IF p_es_agente_jiro THEN
    -- Caso A: Es agente - Asignar a gerentes de oficina + admins

    -- Crear tarea para cada gerente de la oficina
    FOR v_destinatario IN (
      SELECT id, nombre, apellidos
      FROM usuarios
      WHERE rol = 'Gerente'
      AND oficina_id = p_oficina_id
      AND estado IN ('activo', 'pendiente')
    ) LOOP
      -- Crear tarea con tipo correcto
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
        'lead_registro_movi',
        v_descripcion_tarea,
        'Alta',
        v_estatus_nuevo_id,
        v_destinatario.id,
        v_destinatario.id,
        v_destinatario.id,
        jsonb_build_object(
          'registro_id', v_registro_id,
          'tipo', 'registro_no_usuario',
          'titulo', 'Nuevo registro: ' || v_nombre_completo
        )
      ) RETURNING id INTO v_tarea_id;

      -- Enviar notificaciones (campanita + email + whatsapp)
      PERFORM enviar_notificacion_completa(
        p_tipo_codigo := 'nuevo_registro_no_usuario',
        p_user_id := v_destinatario.id,
        p_titulo := 'Nuevo registro: Aún no soy usuario',
        p_mensaje := v_nombre_completo || ' solicitó registro. ' || v_es_agente_texto || ' - ' || v_oficina_nombre,
        p_modulo := 'tramites',
        p_datos_adicionales := jsonb_build_object(
          'nombre_completo', v_nombre_completo,
          'email', p_email,
          'whatsapp', p_whatsapp,
          'es_agente_texto', v_es_agente_texto,
          'oficina_nombre', v_oficina_nombre,
          'fecha_registro', to_char(now(), 'DD/MM/YYYY HH24:MI'),
          'url_tarea', v_url_base || '/tramites/' || v_tarea_id
        ),
        p_accion_url := '/tramites/' || v_tarea_id
      );
    END LOOP;

    -- Crear tarea para cada administrador
    FOR v_destinatario IN (
      SELECT id, nombre, apellidos
      FROM usuarios
      WHERE rol = 'Administrador'
      AND estado IN ('activo', 'pendiente')
    ) LOOP
      -- Crear tarea
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
        'lead_registro_movi',
        v_descripcion_tarea,
        'Alta',
        v_estatus_nuevo_id,
        v_destinatario.id,
        v_destinatario.id,
        v_destinatario.id,
        jsonb_build_object(
          'registro_id', v_registro_id,
          'tipo', 'registro_no_usuario',
          'titulo', 'Nuevo registro: ' || v_nombre_completo
        )
      ) RETURNING id INTO v_tarea_id;

      -- Enviar notificaciones
      PERFORM enviar_notificacion_completa(
        p_tipo_codigo := 'nuevo_registro_no_usuario',
        p_user_id := v_destinatario.id,
        p_titulo := 'Nuevo registro: Aún no soy usuario',
        p_mensaje := v_nombre_completo || ' solicitó registro. ' || v_es_agente_texto || ' - ' || v_oficina_nombre,
        p_modulo := 'tramites',
        p_datos_adicionales := jsonb_build_object(
          'nombre_completo', v_nombre_completo,
          'email', p_email,
          'whatsapp', p_whatsapp,
          'es_agente_texto', v_es_agente_texto,
          'oficina_nombre', v_oficina_nombre,
          'fecha_registro', to_char(now(), 'DD/MM/YYYY HH24:MI'),
          'url_tarea', v_url_base || '/tramites/' || v_tarea_id
        ),
        p_accion_url := '/tramites/' || v_tarea_id
      );
    END LOOP;

  ELSE
    -- Caso B: No es agente - Solo admins
    FOR v_destinatario IN (
      SELECT id, nombre, apellidos
      FROM usuarios
      WHERE rol = 'Administrador'
      AND estado IN ('activo', 'pendiente')
    ) LOOP
      -- Crear tarea
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
        'lead_registro_movi',
        v_descripcion_tarea,
        'Alta',
        v_estatus_nuevo_id,
        v_destinatario.id,
        v_destinatario.id,
        v_destinatario.id,
        jsonb_build_object(
          'registro_id', v_registro_id,
          'tipo', 'registro_no_usuario',
          'titulo', 'Nuevo registro: ' || v_nombre_completo
        )
      ) RETURNING id INTO v_tarea_id;

      -- Enviar notificaciones
      PERFORM enviar_notificacion_completa(
        p_tipo_codigo := 'nuevo_registro_no_usuario',
        p_user_id := v_destinatario.id,
        p_titulo := 'Nuevo registro: Aún no soy usuario',
        p_mensaje := v_nombre_completo || ' solicitó registro. ' || v_es_agente_texto,
        p_modulo := 'tramites',
        p_datos_adicionales := jsonb_build_object(
          'nombre_completo', v_nombre_completo,
          'email', p_email,
          'whatsapp', p_whatsapp,
          'es_agente_texto', v_es_agente_texto,
          'oficina_nombre', 'N/A',
          'fecha_registro', to_char(now(), 'DD/MM/YYYY HH24:MI'),
          'url_tarea', v_url_base || '/tramites/' || v_tarea_id
        ),
        p_accion_url := '/tramites/' || v_tarea_id
      );
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'message', '¡Listo! Recibimos tus datos. En breve un miembro del equipo te contactará.',
    'registro_id', v_registro_id
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Error al procesar el registro: ' || SQLERRM
    );
END;
$$;

COMMENT ON FUNCTION procesar_registro_no_usuario IS 'Procesa registro de "Aún no soy usuario", crea tareas (tickets) tipo lead_registro_movi y envía notificaciones';
