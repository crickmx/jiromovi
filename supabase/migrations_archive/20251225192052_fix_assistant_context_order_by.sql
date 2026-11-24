/*
  # Arreglar ORDER BY en get_user_full_context
  
  1. Cambios
     - Remover ORDER BY problemático en subqueries de jsonb_agg
*/

CREATE OR REPLACE FUNCTION get_user_full_context(p_usuario_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
  v_usuario record;
  v_mes_actual text;
  v_fecha_inicio text;
BEGIN
  v_mes_actual := to_char(now(), 'YYYY-MM');
  v_fecha_inicio := v_mes_actual || '-01';
  
  SELECT
    u.id,
    u.nombre,
    u.apellidos,
    u.nombre_completo,
    u.email_laboral,
    u.rol,
    u.puesto,
    COALESCE(cfr.name, 'Sin régimen fiscal') as regimen_fiscal,
    o.nombre as oficina_nombre
  INTO v_usuario
  FROM usuarios u
  LEFT JOIN oficinas o ON o.id = u.oficina_id
  LEFT JOIN commission_fiscal_regimes cfr ON cfr.id = u.regimen_fiscal_id
  WHERE u.id = p_usuario_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Usuario no encontrado');
  END IF;
  
  v_result := jsonb_build_object(
    'usuario', jsonb_build_object(
      'id', v_usuario.id,
      'nombre_completo', v_usuario.nombre_completo,
      'email', v_usuario.email_laboral,
      'rol', v_usuario.rol,
      'puesto', v_usuario.puesto,
      'regimen_fiscal', v_usuario.regimen_fiscal,
      'oficina', v_usuario.oficina_nombre
    ),
    
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
        ORDER BY c.ultimo_mensaje_at DESC
        LIMIT 20
      ) chats
    ),
    
    'comisiones', jsonb_build_object(
      'mes_actual', jsonb_build_object(
        'total_neto', COALESCE((
          SELECT SUM(commission_neta)
          FROM commission_details
          WHERE movi_user_id = p_usuario_id
            AND created_at >= v_fecha_inicio::timestamp
        ), 0),
        'cantidad', COALESCE((
          SELECT COUNT(*)
          FROM commission_details
          WHERE movi_user_id = p_usuario_id
            AND created_at >= v_fecha_inicio::timestamp
        ), 0)
      )
    ),
    
    'crm', jsonb_build_object(
      'tareas_pendientes', COALESCE((
        SELECT COUNT(*)
        FROM crm_tareas
        WHERE creado_por = p_usuario_id
          AND completada = false
      ), 0)
    ),
    
    'tickets', jsonb_build_object(
      'total_activos', COALESCE((
        SELECT COUNT(*)
        FROM tickets
        WHERE creado_por = p_usuario_id
          AND estado != 'cerrado'
      ), 0)
    )
  );
  
  RETURN v_result;
END;
$$;
