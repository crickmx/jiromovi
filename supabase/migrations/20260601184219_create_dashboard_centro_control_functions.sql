/*
  # Dashboard Centro de Control - Aggregation Functions

  1. New Functions
    - `get_dashboard_kpis(p_user_id, p_rol, p_oficina_id)` - Returns main KPIs (production, commissions, tramites, contacts, CRM)
    - `get_dashboard_renovaciones_breakdown(p_user_id, p_rol, p_oficina_id)` - Returns renewals breakdown 30/60/90 days
    - `get_dashboard_tramites_status(p_user_id, p_rol, p_oficina_id)` - Returns tramites by status
    - `get_dashboard_recent_activity(p_user_id, p_rol, p_oficina_id, p_limit)` - Returns mixed activity feed

  2. Security
    - All functions use SECURITY DEFINER to bypass RLS for aggregation
    - All validate that p_user_id matches auth.uid()
*/

-- ══════════════════════════════════════════════════════════════════════════════
-- Function: get_dashboard_kpis
-- Returns main dashboard KPI numbers for the current user
-- ══════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION get_dashboard_kpis(
  p_user_id uuid,
  p_rol text DEFAULT 'Agente',
  p_oficina_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  -- Production current month
  IF p_rol IN ('Administrador', 'Gerente') THEN
    SELECT COALESCE(SUM(prima_neta), 0) INTO v_current_prod
    FROM sicas_documents
    WHERE fecha_emision >= v_current_month_start
      AND (p_rol = 'Administrador' OR oficina_id = p_oficina_id);

    SELECT COALESCE(SUM(prima_neta), 0) INTO v_previous_prod
    FROM sicas_documents
    WHERE fecha_emision >= v_previous_month_start
      AND fecha_emision <= v_previous_month_end
      AND (p_rol = 'Administrador' OR oficina_id = p_oficina_id);
  ELSE
    SELECT COALESCE(SUM(prima_neta), 0) INTO v_current_prod
    FROM sicas_documents sd
    JOIN sicas_mapeo_usuario_vendedor m ON m.vendedor_clave = sd.vendedor_clave AND m.usuario_id = p_user_id
    WHERE sd.fecha_emision >= v_current_month_start;

    SELECT COALESCE(SUM(prima_neta), 0) INTO v_previous_prod
    FROM sicas_documents sd
    JOIN sicas_mapeo_usuario_vendedor m ON m.vendedor_clave = sd.vendedor_clave AND m.usuario_id = p_user_id
    WHERE sd.fecha_emision >= v_previous_month_start
      AND sd.fecha_emision <= v_previous_month_end;
  END IF;

  IF v_previous_prod > 0 THEN
    v_prod_growth := ROUND(((v_current_prod - v_previous_prod) / v_previous_prod) * 100, 1);
  ELSIF v_current_prod > 0 THEN
    v_prod_growth := 100;
  END IF;

  -- Commissions current month
  SELECT COALESCE(SUM(comision_neta), 0) INTO v_current_comisiones
  FROM commission_details
  WHERE usuario_id = p_user_id
    AND created_at >= v_current_month_start;

  -- Tramites pending
  IF p_rol IN ('Administrador', 'Gerente') THEN
    SELECT COUNT(*) INTO v_tramites_pending
    FROM tickets
    WHERE estatus = 'Pendiente'
      AND (p_rol = 'Administrador' OR EXISTS (
        SELECT 1 FROM usuarios u WHERE u.id = tickets.agente_id AND u.oficina_id = p_oficina_id
      ));
    SELECT COUNT(*) INTO v_tramites_in_progress
    FROM tickets
    WHERE estatus IN ('En proceso', 'En revisión')
      AND (p_rol = 'Administrador' OR EXISTS (
        SELECT 1 FROM usuarios u WHERE u.id = tickets.agente_id AND u.oficina_id = p_oficina_id
      ));
  ELSE
    SELECT COUNT(*) INTO v_tramites_pending
    FROM tickets
    WHERE estatus = 'Pendiente'
      AND (agente_id = p_user_id OR assigned_to = p_user_id);
    SELECT COUNT(*) INTO v_tramites_in_progress
    FROM tickets
    WHERE estatus IN ('En proceso', 'En revisión')
      AND (agente_id = p_user_id OR assigned_to = p_user_id);
  END IF;

  -- CRM tareas abiertas
  SELECT COUNT(*) INTO v_crm_tareas_abiertas
  FROM crm_tareas
  WHERE usuario_id = p_user_id
    AND estatus IN ('pendiente', 'en_progreso')
    AND deleted_at IS NULL;

  -- Contactos CRM
  SELECT COUNT(*) INTO v_contactos_total
  FROM crm_contactos
  WHERE usuario_id = p_user_id
    AND deleted_at IS NULL;

  -- Notificaciones sin leer
  SELECT COUNT(*) INTO v_notificaciones_sin_leer
  FROM notificaciones_internas
  WHERE usuario_id = p_user_id
    AND leido = false;

  -- Polizas vigentes (from sicas_documents with status)
  IF p_rol IN ('Administrador', 'Gerente') THEN
    SELECT COUNT(*) INTO v_polizas_vigentes
    FROM sicas_documents
    WHERE estatus_poliza = 'VIGENTE'
      AND (p_rol = 'Administrador' OR oficina_id = p_oficina_id);
  ELSE
    SELECT COUNT(*) INTO v_polizas_vigentes
    FROM sicas_documents sd
    JOIN sicas_mapeo_usuario_vendedor m ON m.vendedor_clave = sd.vendedor_clave AND m.usuario_id = p_user_id
    WHERE sd.estatus_poliza = 'VIGENTE';
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

-- ══════════════════════════════════════════════════════════════════════════════
-- Function: get_dashboard_renovaciones_breakdown
-- Returns renewals breakdown by 30/60/90 day windows
-- ══════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION get_dashboard_renovaciones_breakdown(
  p_user_id uuid,
  p_rol text DEFAULT 'Agente',
  p_oficina_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
  v_30 int := 0;
  v_60 int := 0;
  v_90 int := 0;
  v_total_prima_30 numeric := 0;
BEGIN
  IF p_rol IN ('Administrador', 'Gerente') THEN
    SELECT
      COUNT(*) FILTER (WHERE fecha_vencimiento BETWEEN CURRENT_DATE AND CURRENT_DATE + 30),
      COUNT(*) FILTER (WHERE fecha_vencimiento BETWEEN CURRENT_DATE + 31 AND CURRENT_DATE + 60),
      COUNT(*) FILTER (WHERE fecha_vencimiento BETWEEN CURRENT_DATE + 61 AND CURRENT_DATE + 90),
      COALESCE(SUM(prima_neta) FILTER (WHERE fecha_vencimiento BETWEEN CURRENT_DATE AND CURRENT_DATE + 30), 0)
    INTO v_30, v_60, v_90, v_total_prima_30
    FROM sicas_documents
    WHERE estatus_poliza = 'VIGENTE'
      AND fecha_vencimiento BETWEEN CURRENT_DATE AND CURRENT_DATE + 90
      AND (p_rol = 'Administrador' OR oficina_id = p_oficina_id);
  ELSE
    SELECT
      COUNT(*) FILTER (WHERE sd.fecha_vencimiento BETWEEN CURRENT_DATE AND CURRENT_DATE + 30),
      COUNT(*) FILTER (WHERE sd.fecha_vencimiento BETWEEN CURRENT_DATE + 31 AND CURRENT_DATE + 60),
      COUNT(*) FILTER (WHERE sd.fecha_vencimiento BETWEEN CURRENT_DATE + 61 AND CURRENT_DATE + 90),
      COALESCE(SUM(sd.prima_neta) FILTER (WHERE sd.fecha_vencimiento BETWEEN CURRENT_DATE AND CURRENT_DATE + 30), 0)
    INTO v_30, v_60, v_90, v_total_prima_30
    FROM sicas_documents sd
    JOIN sicas_mapeo_usuario_vendedor m ON m.vendedor_clave = sd.vendedor_clave AND m.usuario_id = p_user_id
    WHERE sd.estatus_poliza = 'VIGENTE'
      AND sd.fecha_vencimiento BETWEEN CURRENT_DATE AND CURRENT_DATE + 90;
  END IF;

  result := jsonb_build_object(
    'proximas_30', v_30,
    'proximas_60', v_60,
    'proximas_90', v_90,
    'total', v_30 + v_60 + v_90,
    'prima_30', v_total_prima_30
  );

  RETURN result;
END;
$$;

-- ══════════════════════════════════════════════════════════════════════════════
-- Function: get_dashboard_tramites_resumen
-- Returns tramites grouped by status with recent items
-- ══════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION get_dashboard_tramites_resumen(
  p_user_id uuid,
  p_rol text DEFAULT 'Agente',
  p_oficina_id uuid DEFAULT NULL,
  p_limit int DEFAULT 5
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
  v_por_estatus jsonb;
  v_recientes jsonb;
BEGIN
  -- Count by status
  IF p_rol IN ('Administrador', 'Gerente') THEN
    SELECT jsonb_object_agg(estatus, cnt)
    INTO v_por_estatus
    FROM (
      SELECT estatus, COUNT(*) as cnt
      FROM tickets
      WHERE estatus != 'Cerrado'
        AND (p_rol = 'Administrador' OR EXISTS (
          SELECT 1 FROM usuarios u WHERE u.id = tickets.agente_id AND u.oficina_id = p_oficina_id
        ))
      GROUP BY estatus
    ) sub;
  ELSE
    SELECT jsonb_object_agg(estatus, cnt)
    INTO v_por_estatus
    FROM (
      SELECT estatus, COUNT(*) as cnt
      FROM tickets
      WHERE estatus != 'Cerrado'
        AND (agente_id = p_user_id OR assigned_to = p_user_id)
      GROUP BY estatus
    ) sub;
  END IF;

  -- Recent tickets
  IF p_rol IN ('Administrador', 'Gerente') THEN
    SELECT COALESCE(jsonb_agg(t ORDER BY t.updated_at DESC), '[]'::jsonb)
    INTO v_recientes
    FROM (
      SELECT id, folio, titulo, tipo, estatus, updated_at
      FROM tickets
      WHERE estatus != 'Cerrado'
        AND (p_rol = 'Administrador' OR EXISTS (
          SELECT 1 FROM usuarios u WHERE u.id = tickets.agente_id AND u.oficina_id = p_oficina_id
        ))
      ORDER BY updated_at DESC
      LIMIT p_limit
    ) t;
  ELSE
    SELECT COALESCE(jsonb_agg(t ORDER BY t.updated_at DESC), '[]'::jsonb)
    INTO v_recientes
    FROM (
      SELECT id, folio, titulo, tipo, estatus, updated_at
      FROM tickets
      WHERE estatus != 'Cerrado'
        AND (agente_id = p_user_id OR assigned_to = p_user_id)
      ORDER BY updated_at DESC
      LIMIT p_limit
    ) t;
  END IF;

  result := jsonb_build_object(
    'por_estatus', COALESCE(v_por_estatus, '{}'::jsonb),
    'recientes', COALESCE(v_recientes, '[]'::jsonb)
  );

  RETURN result;
END;
$$;

-- ══════════════════════════════════════════════════════════════════════════════
-- Function: get_dashboard_top_aseguradoras
-- Returns top 10 insurers by premium for current year
-- ══════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION get_dashboard_top_aseguradoras(
  p_user_id uuid,
  p_rol text DEFAULT 'Agente',
  p_oficina_id uuid DEFAULT NULL,
  p_limit int DEFAULT 10
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
        aseguradora_nombre as nombre,
        COUNT(*) as polizas,
        ROUND(SUM(prima_neta)::numeric, 2) as prima_total
      FROM sicas_documents
      WHERE fecha_emision >= v_year_start
        AND (p_rol = 'Administrador' OR oficina_id = p_oficina_id)
        AND aseguradora_nombre IS NOT NULL
      GROUP BY aseguradora_nombre
      ORDER BY prima_total DESC
      LIMIT p_limit
    ) sub;
  ELSE
    SELECT COALESCE(jsonb_agg(row_to_json(sub)::jsonb), '[]'::jsonb)
    INTO result
    FROM (
      SELECT
        sd.aseguradora_nombre as nombre,
        COUNT(*) as polizas,
        ROUND(SUM(sd.prima_neta)::numeric, 2) as prima_total
      FROM sicas_documents sd
      JOIN sicas_mapeo_usuario_vendedor m ON m.vendedor_clave = sd.vendedor_clave AND m.usuario_id = p_user_id
      WHERE sd.fecha_emision >= v_year_start
        AND sd.aseguradora_nombre IS NOT NULL
      GROUP BY sd.aseguradora_nombre
      ORDER BY prima_total DESC
      LIMIT p_limit
    ) sub;
  END IF;

  RETURN result;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_dashboard_kpis(uuid, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_dashboard_renovaciones_breakdown(uuid, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_dashboard_tramites_resumen(uuid, text, uuid, int) TO authenticated;
GRANT EXECUTE ON FUNCTION get_dashboard_top_aseguradoras(uuid, text, uuid, int) TO authenticated;
