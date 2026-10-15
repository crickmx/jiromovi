/*
  # Corrección función get_user_full_context - columna activa

  1. Corrección
    - Cambiar o.activo por o.activa en la tabla oficinas
    - La columna correcta es activa (femenino)

  2. Seguridad
    - Mantiene SECURITY DEFINER
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
    ),
    
    -- DIRECTORIO COMPLETO
    'directorio_empleados', (
      SELECT COALESCE(jsonb_agg(emp_data ORDER BY nombre, apellidos), '[]'::jsonb)
      FROM (
        SELECT jsonb_build_object(
          'id', u.id,
          'nombre_completo', u.nombre || ' ' || u.apellidos,
          'nombre', u.nombre,
          'apellidos', u.apellidos,
          'rol', u.rol,
          'puesto', u.puesto,
          'oficina', o.nombre,
          'celular_laboral', u.celular_laboral,
          'extension_telefonica', u.extension_telefonica,
          'email_laboral', u.email_laboral,
          'celular_personal', u.celular_personal,
          'email_personal', u.email_personal
        ) as emp_data,
        u.nombre,
        u.apellidos
        FROM usuarios u
        LEFT JOIN oficinas o ON u.oficina_id = o.id
        WHERE u.activo = true
      ) empleados
    ),
    
    -- OFICINAS COMPLETO
    'directorio_oficinas', (
      SELECT COALESCE(jsonb_agg(ofi_data ORDER BY nombre), '[]'::jsonb)
      FROM (
        SELECT jsonb_build_object(
          'id', o.id,
          'nombre', o.nombre,
          'telefono', o.telefono,
          'domicilio', o.domicilio,
          'email', o.email,
          'facebook', o.facebook,
          'instagram', o.instagram,
          'gerente', (
            SELECT u.nombre || ' ' || u.apellidos
            FROM usuarios u
            WHERE u.oficina_id = o.id
              AND u.rol = 'Gerente'
              AND u.activo = true
            LIMIT 1
          )
        ) as ofi_data,
        o.nombre
        FROM oficinas o
        WHERE o.activa = true
      ) oficinas
    )
  )
  INTO v_result;
  
  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION get_user_full_context IS 'Obtiene snapshot completo del usuario incluyendo conversaciones de chat, comisiones, tareas, tickets, directorio de empleados y oficinas';
