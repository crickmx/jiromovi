/*
  # Corregir columna name en get_user_full_context
  
  1. Cambios
     - Usar cfr.name en lugar de cfr.nombre
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
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'chat_id', c.id,
        'tipo', c.tipo,
        'nombre', c.nombre,
        'ultimo_mensaje_at', c.ultimo_mensaje_at,
        'ultimos_mensajes', (
          SELECT COALESCE(jsonb_agg(jsonb_build_object(
            'remitente', u2.nombre_completo,
            'mensaje', cm.mensaje,
            'created_at', cm.created_at
          ) ORDER BY cm.created_at DESC), '[]'::jsonb)
          FROM chat_mensajes cm
          LEFT JOIN usuarios u2 ON u2.id = cm.remitente_id
          WHERE cm.chat_id = c.id
            AND cm.eliminado = false
          ORDER BY cm.created_at DESC
          LIMIT 5
        )
      ) ORDER BY c.ultimo_mensaje_at DESC), '[]'::jsonb)
      FROM chats c
      INNER JOIN chat_miembros cmem ON cmem.chat_id = c.id
      WHERE cmem.usuario_id = p_usuario_id
      ORDER BY c.ultimo_mensaje_at DESC
      LIMIT 20
    ),
    
    'comisiones', jsonb_build_object(
      'mes_actual', jsonb_build_object(
        'total_neto', COALESCE((
          SELECT SUM(commission_neta)
          FROM commission_details
          WHERE movi_user_id = p_usuario_id
            AND created_at >= v_fecha_inicio::timestamp
        ), 0),
        'total_bruto', COALESCE((
          SELECT SUM(commission_bruta)
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
      ),
      'ultimas', (
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
          'id', id,
          'nombre_asegurado', nombre_asegurado,
          'poliza', poliza,
          'ramo', ramo,
          'commission_neta', commission_neta,
          'commission_bruta', commission_bruta,
          'created_at', created_at
        ) ORDER BY created_at DESC), '[]'::jsonb)
        FROM commission_details
        WHERE movi_user_id = p_usuario_id
        ORDER BY created_at DESC
        LIMIT 10
      )
    ),
    
    'produccion', jsonb_build_object(
      'mes_actual', jsonb_build_object(
        'total', COALESCE((
          SELECT SUM(importe_pesos)
          FROM production_records
          WHERE user_id = p_usuario_id
            AND fecha >= v_fecha_inicio::date
        ), 0),
        'por_ramo', (
          SELECT COALESCE(jsonb_object_agg(ramo_nombre, total), '{}'::jsonb)
          FROM (
            SELECT 
              COALESCE(ramo_nombre, 'Sin ramo') as ramo_nombre,
              SUM(importe_pesos) as total
            FROM production_records
            WHERE user_id = p_usuario_id
              AND fecha >= v_fecha_inicio::date
            GROUP BY ramo_nombre
          ) sub
        )
      )
    ),
    
    'crm', jsonb_build_object(
      'tareas_pendientes', (
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
          'id', t.id,
          'titulo', t.titulo,
          'descripcion', t.descripcion,
          'fecha_vencimiento', t.fecha_vencimiento,
          'prioridad', t.prioridad,
          'estado', t.estado,
          'contacto', jsonb_build_object(
            'nombre', c.nombre,
            'telefono', c.telefono
          )
        ) ORDER BY t.fecha_vencimiento ASC), '[]'::jsonb)
        FROM crm_tareas t
        LEFT JOIN crm_contactos c ON c.id = t.contacto_id
        WHERE t.creado_por = p_usuario_id
          AND t.completada = false
        ORDER BY t.fecha_vencimiento ASC
        LIMIT 20
      ),
      'renovaciones_proximas', (
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
          'id', p.id,
          'numero_poliza', p.numero_poliza,
          'aseguradora', p.aseguradora,
          'ramo', p.ramo,
          'fecha_vencimiento', p.fecha_vencimiento,
          'prima_total', p.prima_total,
          'contacto', jsonb_build_object(
            'nombre', c.nombre,
            'telefono', c.telefono,
            'email', c.email
          )
        ) ORDER BY p.fecha_vencimiento ASC), '[]'::jsonb)
        FROM crm_polizas p
        LEFT JOIN crm_contactos c ON c.id = p.contacto_id
        WHERE p.creado_por = p_usuario_id
          AND p.fecha_vencimiento >= CURRENT_DATE
          AND p.fecha_vencimiento <= CURRENT_DATE + INTERVAL '60 days'
        ORDER BY p.fecha_vencimiento ASC
        LIMIT 20
      ),
      'total_contactos', (
        SELECT COUNT(*)
        FROM crm_contactos
        WHERE creado_por = p_usuario_id
      )
    ),
    
    'tickets', jsonb_build_object(
      'activos', (
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
          'id', id,
          'tipo', tipo,
          'titulo', titulo,
          'estado', estado,
          'prioridad', prioridad,
          'created_at', created_at
        ) ORDER BY created_at DESC), '[]'::jsonb)
        FROM tickets
        WHERE creado_por = p_usuario_id
          AND estado != 'cerrado'
        ORDER BY created_at DESC
        LIMIT 20
      ),
      'total_activos', (
        SELECT COUNT(*)
        FROM tickets
        WHERE creado_por = p_usuario_id
          AND estado != 'cerrado'
      )
    ),
    
    'vacaciones', jsonb_build_object(
      'dias_disponibles', COALESCE((
        SELECT dias_disponibles
        FROM vacaciones
        WHERE usuario_id = p_usuario_id
        ORDER BY ano DESC
        LIMIT 1
      ), 0),
      'proximas_salidas', (
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
          'fecha_inicio', fecha_inicio,
          'fecha_fin', fecha_fin,
          'dias', dias_solicitados,
          'estado', estado
        ) ORDER BY fecha_inicio ASC), '[]'::jsonb)
        FROM vacaciones_solicitudes
        WHERE usuario_id = p_usuario_id
          AND fecha_inicio >= CURRENT_DATE
          AND estado IN ('aprobada', 'pendiente')
        ORDER BY fecha_inicio ASC
        LIMIT 5
      )
    ),
    
    'store_pedidos', jsonb_build_object(
      'recientes', (
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
          'id', id,
          'folio', folio,
          'estado', estado,
          'total', total,
          'created_at', created_at
        ) ORDER BY created_at DESC), '[]'::jsonb)
        FROM store_pedidos
        WHERE usuario_id = p_usuario_id
        ORDER BY created_at DESC
        LIMIT 10
      )
    ),
    
    'comunicados_no_leidos', (
      SELECT COUNT(*)
      FROM comunicados c
      WHERE c.publicado = true
        AND c.fecha_publicacion <= now()
        AND NOT EXISTS (
          SELECT 1
          FROM comunicados_leidos cl
          WHERE cl.comunicado_id = c.id
            AND cl.usuario_id = p_usuario_id
        )
    ),
    
    'capacitaciones_proximas', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id', s.id,
        'titulo', l.titulo,
        'fecha_sesion', s.fecha_sesion,
        'hora_inicio', s.hora_inicio,
        'duracion_minutos', s.duracion_minutos,
        'inscrito', EXISTS(
          SELECT 1
          FROM seguros_sesiones_asistentes ssa
          WHERE ssa.sesion_id = s.id
            AND ssa.usuario_id = p_usuario_id
        )
      ) ORDER BY s.fecha_sesion ASC), '[]'::jsonb)
      FROM seguros_sesiones_programadas s
      INNER JOIN seguros_lessons l ON l.id = s.lesson_id
      WHERE s.fecha_sesion >= CURRENT_DATE
      ORDER BY s.fecha_sesion ASC
      LIMIT 10
    ),
    
    'reservas_proximas', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id', id,
        'espacio', espacio,
        'fecha', fecha,
        'hora_inicio', hora_inicio,
        'hora_fin', hora_fin,
        'motivo', motivo,
        'estado', estado
      ) ORDER BY fecha ASC, hora_inicio ASC), '[]'::jsonb)
      FROM reservas_espacio
      WHERE usuario_id = p_usuario_id
        AND fecha >= CURRENT_DATE
        AND estado = 'confirmada'
      ORDER BY fecha ASC, hora_inicio ASC
      LIMIT 10
    )
  );
  
  RETURN v_result;
END;
$$;
