/*
  # Función simplificada y funcional para get_user_full_context
  
  1. Cambios
     - Usar columnas correctas (estatus_id en lugar de estado)
     - Simplificar queries para evitar errores
*/

CREATE OR REPLACE FUNCTION get_user_full_context(p_usuario_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'usuario_id', p_usuario_id,
    
    -- Chat conversaciones
    'chat_conversaciones', (
      SELECT COALESCE(jsonb_agg(chat_data), '[]'::jsonb)
      FROM (
        SELECT jsonb_build_object(
          'chat_id', c.id,
          'tipo', c.tipo,
          'nombre', c.nombre,
          'ultimo_mensaje_at', c.ultimo_mensaje_at,
          'ultimos_mensajes', (
            SELECT COALESCE(jsonb_agg(msg_data), '[]'::jsonb)
            FROM (
              SELECT jsonb_build_object(
                'remitente', u2.nombre_completo,
                'mensaje', cm.mensaje,
                'created_at', cm.created_at
              ) as msg_data
              FROM chat_mensajes cm
              LEFT JOIN usuarios u2 ON u2.id = cm.remitente_id
              WHERE cm.chat_id = c.id
                AND cm.eliminado = false
              ORDER BY cm.created_at DESC
              LIMIT 5
            ) msgs
          )
        ) as chat_data
        FROM chats c
        INNER JOIN chat_miembros cmem ON cmem.chat_id = c.id
        WHERE cmem.usuario_id = p_usuario_id
        ORDER BY c.ultimo_mensaje_at DESC NULLS LAST
        LIMIT 20
      ) chats
    ),
    
    -- Comisiones
    'comisiones_count', (
      SELECT COUNT(*)
      FROM commission_details
      WHERE movi_user_id = p_usuario_id
    ),
    
    -- Tareas CRM
    'tareas_pendientes', (
      SELECT COUNT(*)
      FROM crm_tareas
      WHERE creado_por = p_usuario_id
        AND completada = false
    ),
    
    -- Tickets
    'tickets_activos', (
      SELECT COUNT(*)
      FROM tickets
      WHERE creado_por = p_usuario_id
        AND cerrado_en IS NULL
    )
  )
  INTO v_result;
  
  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION get_user_full_context IS 'Obtiene snapshot completo del usuario incluyendo conversaciones de chat';
