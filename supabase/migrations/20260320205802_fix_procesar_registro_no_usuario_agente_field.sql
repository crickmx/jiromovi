/*
  # Fix procesar_registro_no_usuario function to use agente_solicitante_id

  1. Changes
    - Update function to use agente_solicitante_id instead of agente_id
    - Maintains assigned_to_user_id for responsable
    - agente_solicitante_id represents who created/requested the ticket
*/

-- Get the function definition first to preserve all logic
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
  LIMIT 1;

  IF v_estatus_nuevo_id IS NULL THEN
    RAISE EXCEPTION 'No se encontró el estatus "Nuevo"';
  END IF;

  -- Insertar en tabla temporal de registros no usuarios
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

  -- Preparar datos para las tareas
  v_nombre_completo := p_nombre || ' ' || p_apellidos;
  v_es_agente_texto := CASE WHEN p_es_agente_jiro THEN 'Sí' ELSE 'No' END;

  -- Obtener nombre de oficina si existe
  IF p_oficina_id IS NOT NULL THEN
    SELECT nombre INTO v_oficina_nombre
    FROM oficinas
    WHERE id = p_oficina_id;
  END IF;

  -- Construir descripción de la tarea
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

  -- Si es agente Jiro y tiene oficina, notificar a gerentes
  IF p_es_agente_jiro AND p_oficina_id IS NOT NULL THEN
    FOR v_destinatario IN (
      SELECT id, nombre_completo
      FROM usuarios
      WHERE rol = 'Gerente'
      AND oficina_id = p_oficina_id
      AND estado IN ('Activo', 'Pendiente')
    ) LOOP
      -- Crear tarea con estructura correcta usando agente_solicitante_id
      INSERT INTO tickets (
        tipo_tramite,
        instrucciones,
        prioridad,
        estatus_id,
        assigned_to_user_id,
        agente_solicitante_id,
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

      -- Notificación in-app para gerente
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

  -- Siempre notificar a administradores
  FOR v_destinatario IN (
    SELECT id, nombre_completo
    FROM usuarios
    WHERE rol = 'Administrador'
    AND estado IN ('Activo', 'Pendiente')
  ) LOOP
    -- Crear tarea usando agente_solicitante_id
    INSERT INTO tickets (
      tipo_tramite,
      instrucciones,
      prioridad,
      estatus_id,
      assigned_to_user_id,
      agente_solicitante_id,
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

    -- Notificación in-app para administrador
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
