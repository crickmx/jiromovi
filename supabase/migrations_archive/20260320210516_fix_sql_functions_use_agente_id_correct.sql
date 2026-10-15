/*
  # Fix SQL functions to use correct column name agente_id

  1. Changes
    - Update crear_ticket_cambio_bancario to use agente_id (correct column name)
    - Update procesar_registro_no_usuario to use agente_id (correct column name)
*/

-- Update function to create payment change tickets
CREATE OR REPLACE FUNCTION crear_ticket_cambio_bancario(
  p_usuario_id uuid,
  p_regimen_fiscal_nombre text DEFAULT NULL,
  p_banco text DEFAULT NULL,
  p_clabe text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_ticket_id uuid;
  v_ticket_folio text;
  v_estatus_nuevo_id uuid;
  v_ticket_existente_id uuid;
  v_instrucciones text;
  v_usuario_nombre text;
  v_usuario_apellidos text;
  v_oficina_id uuid;
  v_resultado jsonb;
BEGIN
  -- Obtener datos del usuario
  SELECT nombre, apellidos, oficina_id
  INTO v_usuario_nombre, v_usuario_apellidos, v_oficina_id
  FROM usuarios
  WHERE id = p_usuario_id;

  -- Obtener estatus "Nuevo"
  SELECT id INTO v_estatus_nuevo_id
  FROM ticket_estatus
  WHERE nombre = 'Nuevo'
  LIMIT 1;

  IF v_estatus_nuevo_id IS NULL THEN
    RAISE EXCEPTION 'No se encontró el estatus "Nuevo" para tickets';
  END IF;

  -- Construir descripción con los nuevos datos
  v_instrucciones := E'CAMBIO DE INFORMACIÓN DE PAGO\n\n';

  IF p_regimen_fiscal_nombre IS NOT NULL THEN
    v_instrucciones := v_instrucciones || 'Régimen fiscal: ' || p_regimen_fiscal_nombre || E'\n';
  END IF;

  IF p_banco IS NOT NULL THEN
    v_instrucciones := v_instrucciones || 'Banco (nuevo): ' || p_banco || E'\n';
  END IF;

  IF p_clabe IS NOT NULL THEN
    v_instrucciones := v_instrucciones || 'CLABE (nuevo): ' || p_clabe || E'\n';
  END IF;

  v_instrucciones := v_instrucciones || E'\n⏱️ Este cambio tarda de 24 a 72 horas en aplicarse.';

  -- Verificar si existe un ticket reciente de cambios bancarios (últimos 15 minutos)
  SELECT id INTO v_ticket_existente_id
  FROM tickets
  WHERE agente_id = p_usuario_id
    AND poliza = 'CAMBIOS BANCARIOS'
    AND fecha_creacion >= (now() - interval '15 minutes')
    AND cerrado_en IS NULL
  ORDER BY fecha_creacion DESC
  LIMIT 1;

  IF v_ticket_existente_id IS NOT NULL THEN
    -- Actualizar ticket existente
    UPDATE tickets
    SET
      instrucciones = v_instrucciones,
      ultima_modificacion = now(),
      modificado_por = p_usuario_id
    WHERE id = v_ticket_existente_id;

    v_ticket_id := v_ticket_existente_id;

    -- Obtener folio del ticket existente
    SELECT folio INTO v_ticket_folio
    FROM tickets
    WHERE id = v_ticket_id;

    -- Agregar comentario indicando actualización
    INSERT INTO ticket_comentarios (ticket_id, usuario_id, mensaje)
    VALUES (
      v_ticket_id,
      p_usuario_id,
      'Información actualizada con nuevos datos de pago.'
    );

    v_resultado := jsonb_build_object(
      'ticket_id', v_ticket_id,
      'folio', v_ticket_folio,
      'accion', 'actualizado',
      'mensaje', 'Ticket de cambios bancarios actualizado'
    );

  ELSE
    -- Crear nuevo ticket
    INSERT INTO tickets (
      tipo_tramite,
      agente_id,
      estatus_id,
      prioridad,
      poliza,
      instrucciones,
      creado_por,
      fecha_creacion
    )
    VALUES (
      'cambio_datos_pago',
      p_usuario_id,
      v_estatus_nuevo_id,
      'Alta',
      'CAMBIOS BANCARIOS',
      v_instrucciones,
      p_usuario_id,
      now()
    )
    RETURNING id, folio INTO v_ticket_id, v_ticket_folio;

    -- Enviar notificación in-app al usuario
    PERFORM enviar_notificacion_completa(
      'ticket_creado',
      p_usuario_id,
      jsonb_build_object(
        'ticket_folio', v_ticket_folio,
        'tipo_tramite', 'Cambio de datos bancarios'
      )
    );

    -- Enviar notificación a administradores
    PERFORM enviar_notificacion_completa(
      'ticket_cambio_bancario_admin',
      admin.id,
      jsonb_build_object(
        'ticket_folio', v_ticket_folio,
        'usuario_nombre', v_usuario_nombre || ' ' || v_usuario_apellidos,
        'usuario_id', p_usuario_id
      )
    )
    FROM usuarios admin
    WHERE admin.rol = 'Administrador' AND admin.estado = 'Activo';

    v_resultado := jsonb_build_object(
      'ticket_id', v_ticket_id,
      'folio', v_ticket_folio,
      'accion', 'creado',
      'mensaje', 'Ticket de cambios bancarios creado exitosamente'
    );
  END IF;

  RETURN v_resultado;
END;
$$;

-- Update function to process non-user registrations
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
      -- Crear tarea con estructura correcta usando agente_id
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
    -- Crear tarea usando agente_id
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
