-- Fix get_dashboard_kpis: use fecha_captura instead of fecha_emision
-- since fecha_emision is the original policy date (many years back)
-- while fecha_captura is when the document was captured in SICAS (recent)
DROP FUNCTION IF EXISTS get_dashboard_kpis(uuid, text, uuid);

CREATE FUNCTION get_dashboard_kpis(p_user_id uuid, p_rol text, p_oficina_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  result jsonb;
  v_current_month_start date;
  v_previous_month_start date;
  v_previous_month_end date;
  v_current_prod numeric := 0;
  v_previous_prod numeric := 0;
  v_current_comisiones numeric := 0;
  v_tramites_pending int := 0;
  v_tramites_in_progress int := 0;
  v_contactos_total int := 0;
  v_crm_tareas_abiertas int := 0;
  v_notificaciones_sin_leer int := 0;
  v_polizas_vigentes int := 0;
  v_prod_growth numeric := 0;
BEGIN
  v_current_month_start := date_trunc('month', CURRENT_DATE)::date;
  v_previous_month_start := (date_trunc('month', CURRENT_DATE) - interval '1 month')::date;
  v_previous_month_end := (v_current_month_start - interval '1 day')::date;

  -- Production current month (use fecha_captura as it reflects recent activity)
  IF p_rol IN ('Administrador', 'Gerente') THEN
    SELECT COALESCE(SUM(prima_neta), 0) INTO v_current_prod
    FROM sicas_documents
    WHERE fecha_captura >= v_current_month_start
    AND (p_rol = 'Administrador' OR oficina_id = p_oficina_id);

    SELECT COALESCE(SUM(prima_neta), 0) INTO v_previous_prod
    FROM sicas_documents
    WHERE fecha_captura >= v_previous_month_start
    AND fecha_captura <= v_previous_month_end
    AND (p_rol = 'Administrador' OR oficina_id = p_oficina_id);
  ELSE
    SELECT COALESCE(SUM(sd.prima_neta), 0) INTO v_current_prod
    FROM sicas_documents sd
    JOIN sicas_mapeo_vendedor_usuario m ON m.id_sicas_vendedor = sd.vend_id AND m.movi_user_id = p_user_id
    WHERE sd.fecha_captura >= v_current_month_start;

    SELECT COALESCE(SUM(sd.prima_neta), 0) INTO v_previous_prod
    FROM sicas_documents sd
    JOIN sicas_mapeo_vendedor_usuario m ON m.id_sicas_vendedor = sd.vend_id AND m.movi_user_id = p_user_id
    WHERE sd.fecha_captura >= v_previous_month_start
    AND sd.fecha_captura <= v_previous_month_end;
  END IF;

  IF v_previous_prod > 0 THEN
    v_prod_growth := ROUND(((v_current_prod - v_previous_prod) / v_previous_prod) * 100, 1);
  ELSIF v_current_prod > 0 THEN
    v_prod_growth := 100;
  END IF;

  -- Commissions current month
  SELECT COALESCE(SUM(COALESCE(commission_neta, 0)), 0) INTO v_current_comisiones
  FROM commission_details
  WHERE movi_user_id = p_user_id
  AND created_at >= v_current_month_start;

  -- Tramites
  IF p_rol IN ('Administrador', 'Gerente') THEN
    SELECT COUNT(*) INTO v_tramites_pending
    FROM tickets t
    JOIN ticket_estatus te ON te.id = t.estatus_id
    WHERE te.nombre = 'Iniciado'
    AND (p_rol = 'Administrador' OR EXISTS (
      SELECT 1 FROM usuarios u WHERE u.id = t.agente_id AND u.oficina_id = p_oficina_id
    ));
    SELECT COUNT(*) INTO v_tramites_in_progress
    FROM tickets t
    JOIN ticket_estatus te ON te.id = t.estatus_id
    WHERE te.nombre IN ('En Proceso', 'Espera Agente', 'Espera Aseguradora', 'Cotizado')
    AND (p_rol = 'Administrador' OR EXISTS (
      SELECT 1 FROM usuarios u WHERE u.id = t.agente_id AND u.oficina_id = p_oficina_id
    ));
  ELSE
    SELECT COUNT(*) INTO v_tramites_pending
    FROM tickets t
    JOIN ticket_estatus te ON te.id = t.estatus_id
    WHERE te.nombre = 'Iniciado'
    AND (t.agente_id = p_user_id OR t.agente_usuario_id = p_user_id OR t.assigned_to_user_id = p_user_id);
    SELECT COUNT(*) INTO v_tramites_in_progress
    FROM tickets t
    JOIN ticket_estatus te ON te.id = t.estatus_id
    WHERE te.nombre IN ('En Proceso', 'Espera Agente', 'Espera Aseguradora', 'Cotizado')
    AND (t.agente_id = p_user_id OR t.agente_usuario_id = p_user_id OR t.assigned_to_user_id = p_user_id);
  END IF;

  -- CRM tareas abiertas
  SELECT COUNT(*) INTO v_crm_tareas_abiertas
  FROM crm_tareas
  WHERE (creado_por = p_user_id OR asignado_a = p_user_id)
  AND estatus IN ('pendiente', 'en_progreso');

  -- Contactos CRM
  SELECT COUNT(*) INTO v_contactos_total
  FROM crm_contactos
  WHERE creado_por = p_user_id;

  -- Notificaciones sin leer
  SELECT COUNT(*) INTO v_notificaciones_sin_leer
  FROM notificaciones_internas
  WHERE usuario_id = p_user_id
  AND leido = false;

  -- Polizas vigentes
  IF p_rol IN ('Administrador', 'Gerente') THEN
    SELECT COUNT(*) INTO v_polizas_vigentes
    FROM sicas_documents
    WHERE is_vigente = true
    AND (p_rol = 'Administrador' OR oficina_id = p_oficina_id);
  ELSE
    SELECT COUNT(*) INTO v_polizas_vigentes
    FROM sicas_documents sd
    JOIN sicas_mapeo_vendedor_usuario m ON m.id_sicas_vendedor = sd.vend_id AND m.movi_user_id = p_user_id
    WHERE sd.is_vigente = true;
  END IF;

  result := jsonb_build_object(
    'produccion_mes', v_current_prod,
    'produccion_anterior', v_previous_prod,
    'produccion_growth', v_prod_growth,
    'comisiones_mes', v_current_comisiones,
    'tramites_pendientes', v_tramites_pending,
    'tramites_en_proceso', v_tramites_in_progress,
    'crm_tareas_abiertas', v_crm_tareas_abiertas,
    'contactos_total', v_contactos_total,
    'notificaciones_sin_leer', v_notificaciones_sin_leer,
    'polizas_vigentes', v_polizas_vigentes
  );

  RETURN result;
END;
$$;

-- Fix get_dashboard_top_aseguradoras: use fecha_captura instead of fecha_emision
DROP FUNCTION IF EXISTS get_dashboard_top_aseguradoras(uuid, text, uuid, int);

CREATE FUNCTION get_dashboard_top_aseguradoras(p_user_id uuid, p_rol text, p_oficina_id uuid DEFAULT NULL, p_limit int DEFAULT 7)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  result jsonb;
  v_year_start date;
BEGIN
  v_year_start := date_trunc('year', CURRENT_DATE)::date;

  IF p_rol IN ('Administrador', 'Gerente') THEN
    SELECT COALESCE(jsonb_agg(row_to_json(sub)::jsonb), '[]'::jsonb)
    INTO result
    FROM (
      SELECT
        COALESCE(compania, aseguradora_nombre, 'Sin nombre') as nombre,
        COUNT(*) as polizas,
        ROUND(SUM(prima_neta)::numeric, 2) as prima_total
      FROM sicas_documents
      WHERE fecha_captura >= v_year_start
      AND (p_rol = 'Administrador' OR oficina_id = p_oficina_id)
      AND (compania IS NOT NULL OR aseguradora_nombre IS NOT NULL)
      GROUP BY COALESCE(compania, aseguradora_nombre, 'Sin nombre')
      ORDER BY prima_total DESC
      LIMIT p_limit
    ) sub;
  ELSE
    SELECT COALESCE(jsonb_agg(row_to_json(sub)::jsonb), '[]'::jsonb)
    INTO result
    FROM (
      SELECT
        COALESCE(sd.compania, sd.aseguradora_nombre, 'Sin nombre') as nombre,
        COUNT(*) as polizas,
        ROUND(SUM(sd.prima_neta)::numeric, 2) as prima_total
      FROM sicas_documents sd
      JOIN sicas_mapeo_vendedor_usuario m ON m.id_sicas_vendedor = sd.vend_id AND m.movi_user_id = p_user_id
      WHERE sd.fecha_captura >= v_year_start
      AND (sd.compania IS NOT NULL OR sd.aseguradora_nombre IS NOT NULL)
      GROUP BY COALESCE(sd.compania, sd.aseguradora_nombre, 'Sin nombre')
      ORDER BY prima_total DESC
      LIMIT p_limit
    ) sub;
  END IF;

  RETURN result;
END;
$$;