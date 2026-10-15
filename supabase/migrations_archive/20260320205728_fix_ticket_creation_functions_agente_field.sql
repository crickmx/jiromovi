/*
  # Fix ticket creation functions to use correct agente_solicitante_id field

  1. Changes
    - Update crear_ticket_cambio_bancario function to use agente_solicitante_id instead of agente_id
    - Ensures new tickets have correct field mapping for agent/responsable distinction
*/

-- Update function to create payment change tickets with correct field
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
  WHERE agente_solicitante_id = p_usuario_id
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
      agente_solicitante_id,
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
