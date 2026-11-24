/*
  # Sistema Automático de Tickets para Cambios en Información de Pago

  1. Nueva Función
    - `crear_ticket_cambio_bancario` - Crea o actualiza ticket de cambios bancarios
      - Verifica si existe ticket reciente (últimos 15 minutos)
      - Crea nuevo ticket si no existe uno reciente
      - Actualiza ticket existente si lo hay
      - Establece prioridad Alta automáticamente
      - Formatea la descripción con los nuevos datos

  2. Campos del Ticket
    - poliza: "CAMBIOS BANCARIOS"
    - instrucciones: Formato con régimen fiscal, banco y CLABE
    - prioridad: "Alta"
    - Visible para usuario y administradores

  3. Notificaciones
    - Notificación in-app para el usuario
    - Notificación in-app para administradores
*/

-- Función para crear ticket de cambios bancarios
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
      agente_id,
      estatus_id,
      prioridad,
      poliza,
      instrucciones,
      creado_por,
      fecha_creacion
    )
    VALUES (
      p_usuario_id,
      v_estatus_nuevo_id,
      'Alta',
      'CAMBIOS BANCARIOS',
      v_instrucciones,
      p_usuario_id,
      now()
    )
    RETURNING id, folio INTO v_ticket_id, v_ticket_folio;

    v_resultado := jsonb_build_object(
      'ticket_id', v_ticket_id,
      'folio', v_ticket_folio,
      'accion', 'creado',
      'mensaje', 'Ticket de cambios bancarios creado exitosamente'
    );

    -- Crear notificación para el usuario
    INSERT INTO notificaciones_globales (
      usuario_id,
      tipo,
      titulo,
      mensaje,
      enlace,
      fecha_hora
    )
    VALUES (
      p_usuario_id,
      'ticket',
      'Solicitud registrada',
      'Tu solicitud de CAMBIOS BANCARIOS fue registrada con el folio ' || v_ticket_folio || '.',
      '/tramites/' || v_ticket_id,
      now()
    );

    -- Crear notificaciones para todos los administradores
    INSERT INTO notificaciones_globales (
      usuario_id,
      tipo,
      titulo,
      mensaje,
      enlace,
      fecha_hora
    )
    SELECT
      id,
      'ticket',
      'Nuevo trámite: CAMBIOS BANCARIOS',
      'Nuevo trámite de cambios bancarios del usuario ' || v_usuario_nombre || ' ' || v_usuario_apellidos || ' (Folio: ' || v_ticket_folio || ')',
      '/tramites/' || v_ticket_id,
      now()
    FROM usuarios
    WHERE rol = 'Administrador'
      AND estado = 'Activo'
      AND deleted_at IS NULL;

    -- Si hay gerentes en la misma oficina, también notificarles
    IF v_oficina_id IS NOT NULL THEN
      INSERT INTO notificaciones_globales (
        usuario_id,
        tipo,
        titulo,
        mensaje,
        enlace,
        fecha_hora
      )
      SELECT
        id,
        'ticket',
        'Nuevo trámite: CAMBIOS BANCARIOS',
        'Nuevo trámite de cambios bancarios del usuario ' || v_usuario_nombre || ' ' || v_usuario_apellidos || ' (Folio: ' || v_ticket_folio || ')',
        '/tramites/' || v_ticket_id,
        now()
      FROM usuarios
      WHERE rol = 'Gerente'
        AND oficina_id = v_oficina_id
        AND estado = 'Activo'
        AND deleted_at IS NULL
        AND id != p_usuario_id;
    END IF;
  END IF;

  RETURN v_resultado;
END;
$$;

-- Permitir que usuarios autenticados ejecuten la función
GRANT EXECUTE ON FUNCTION crear_ticket_cambio_bancario TO authenticated;

-- Comentario de la función
COMMENT ON FUNCTION crear_ticket_cambio_bancario IS 'Crea o actualiza automáticamente un ticket de cambios bancarios cuando el usuario modifica su información de pago. Evita duplicados verificando tickets recientes (últimos 15 minutos).';