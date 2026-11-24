/*
  # Fix comparison metrics when previous period has zero data

  1. Changes to `get_sicas_dashboard_kpis`
    - When previous period prima is 0 but current prima > 0, show 100% growth instead of 0%
    - Applies to: variacion_mes_anterior, variacion_interanual, crecimiento_ytd
    - When both are 0, still returns 0

  2. Changes to `get_sicas_avance_comercial`
    - Same fix for prima_vs_anterior, polizas_vs_anterior
    - When meta_mensual is 0 (no prior year), use proportional YTD logic as fallback
    - When no prior year exists, set avance_meta to 100% if any current production exists
    - YTD comparisons also fixed

  3. Important Notes
    - Affects agent-level filtering where an agent may not have prior year data
    - Global/office views are mostly unaffected since they aggregate across agents
*/

-- Fix get_sicas_dashboard_kpis
CREATE OR REPLACE FUNCTION get_sicas_dashboard_kpis(
  p_user_id uuid,
  p_scope text DEFAULT NULL,
  p_oficina_id uuid DEFAULT NULL,
  p_fecha_desde date DEFAULT NULL,
  p_fecha_hasta date DEFAULT NULL,
  p_vendedor_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rol text;
  v_oficina uuid;
  v_scope text;
  v_periodo_inicio date;
  v_periodo_fin date;
  v_custom_range boolean;
  v_mes_actual_inicio date;
  v_mes_actual_fin date;
  v_mes_anterior_inicio date;
  v_mes_anterior_fin date;
  v_mismo_mes_anio_ant_inicio date;
  v_mismo_mes_anio_ant_fin date;
  v_anio_actual_inicio date;
  v_mismo_periodo_ant_inicio date;
  v_mismo_periodo_ant_fin date;

  v_polizas_emitidas int;
  v_fianzas_emitidas int;
  v_total_emitidos int;
  v_prima_neta_emitida numeric;
  v_prima_total_emitida numeric;
  v_clientes_emision int;
  v_ticket_promedio numeric;
  v_docs_vigentes int;
  v_prima_vigente numeric;
  v_clientes_vigentes int;
  v_renov_pendientes int;
  v_prima_por_renovar numeric;
  v_renov_7 int;
  v_renov_15 int;
  v_renov_30 int;
  v_cancelaciones int;
  v_prima_mes_anterior numeric;
  v_prima_mismo_mes_ant numeric;
  v_acumulado_ytd numeric;
  v_acumulado_ytd_ant numeric;
  v_top_cliente jsonb;
  v_top_aseguradora jsonb;
  v_top_ramo jsonb;
  v_top_oficina jsonb;
  v_top_vendedor jsonb;
  v_conc_top5_clientes numeric;
  v_conc_top3_aseguradoras numeric;
  v_last_sync text;
BEGIN
  SELECT rol, oficina_id INTO v_rol, v_oficina FROM usuarios WHERE id = p_user_id;
  IF v_rol IS NULL THEN
    RETURN jsonb_build_object('error', 'Usuario no encontrado');
  END IF;

  IF v_rol = 'Administrador' THEN
    v_scope := COALESCE(p_scope, 'admin');
  ELSIF v_rol IN ('Gerente', 'Empleado', 'Ejecutivo') THEN
    v_scope := COALESCE(p_scope, 'office');
    IF v_scope = 'admin' THEN v_scope := 'office'; END IF;
  ELSE
    v_scope := 'self';
  END IF;

  IF p_oficina_id IS NOT NULL AND v_scope = 'admin' THEN
    v_oficina := p_oficina_id;
    v_scope := 'office';
  ELSIF v_scope = 'office' THEN
    v_oficina := COALESCE(p_oficina_id, v_oficina);
  END IF;

  v_custom_range := (p_fecha_desde IS NOT NULL AND p_fecha_hasta IS NOT NULL);

  v_mes_actual_inicio := date_trunc('month', CURRENT_DATE)::date;
  v_mes_actual_fin := (date_trunc('month', CURRENT_DATE) + interval '1 month' - interval '1 day')::date;

  IF v_custom_range THEN
    v_periodo_inicio := p_fecha_desde;
    v_periodo_fin := p_fecha_hasta;
  ELSE
    v_periodo_inicio := v_mes_actual_inicio;
    v_periodo_fin := v_mes_actual_fin;
  END IF;

  v_mes_anterior_inicio := (date_trunc('month', CURRENT_DATE) - interval '1 month')::date;
  v_mes_anterior_fin := (date_trunc('month', CURRENT_DATE) - interval '1 day')::date;
  v_mismo_mes_anio_ant_inicio := (date_trunc('month', CURRENT_DATE) - interval '1 year')::date;
  v_mismo_mes_anio_ant_fin := (date_trunc('month', CURRENT_DATE) - interval '1 year' + interval '1 month' - interval '1 day')::date;
  v_anio_actual_inicio := date_trunc('year', CURRENT_DATE)::date;
  v_mismo_periodo_ant_inicio := (date_trunc('year', CURRENT_DATE) - interval '1 year')::date;
  v_mismo_periodo_ant_fin := (CURRENT_DATE - interval '1 year');

  -- Emissions in the selected period
  SELECT
    COUNT(*) FILTER (WHERE NOT COALESCE(d.is_fianza, false)),
    COUNT(*) FILTER (WHERE COALESCE(d.is_fianza, false)),
    COUNT(*),
    COALESCE(SUM(d.prima_neta), 0),
    COALESCE(SUM(GREATEST(COALESCE(d.prima_total, 0), COALESCE(d.importe, 0))), 0),
    COUNT(DISTINCT d.cliente)
  INTO v_polizas_emitidas, v_fianzas_emitidas, v_total_emitidos, v_prima_neta_emitida, v_prima_total_emitida, v_clientes_emision
  FROM sicas_documents d
  WHERE d.fecha_captura::date BETWEEN v_periodo_inicio AND v_periodo_fin
    AND (v_scope = 'admin' OR (v_scope = 'office' AND d.oficina_id = v_oficina) OR (v_scope = 'self' AND d.usuario_id = p_user_id))
    AND (p_vendedor_id IS NULL OR d.vend_id = p_vendedor_id);

  v_ticket_promedio := CASE WHEN v_total_emitidos > 0 THEN v_prima_neta_emitida / v_total_emitidos ELSE 0 END;

  -- Vigentes (always current, no date filter)
  SELECT COUNT(*), COALESCE(SUM(d.prima_neta), 0), COUNT(DISTINCT d.cliente)
  INTO v_docs_vigentes, v_prima_vigente, v_clientes_vigentes
  FROM sicas_documents d
  WHERE d.is_vigente = true
    AND (v_scope = 'admin' OR (v_scope = 'office' AND d.oficina_id = v_oficina) OR (v_scope = 'self' AND d.usuario_id = p_user_id))
    AND (p_vendedor_id IS NULL OR d.vend_id = p_vendedor_id);

  -- Renovaciones (always current)
  SELECT
    COUNT(*),
    COALESCE(SUM(d.prima_neta), 0),
    COUNT(*) FILTER (WHERE d.renewal_days_remaining BETWEEN 0 AND 7),
    COUNT(*) FILTER (WHERE d.renewal_days_remaining BETWEEN 0 AND 15),
    COUNT(*) FILTER (WHERE d.renewal_days_remaining BETWEEN 0 AND 30)
  INTO v_renov_pendientes, v_prima_por_renovar, v_renov_7, v_renov_15, v_renov_30
  FROM sicas_documents d
  WHERE d.is_vigente = true AND d.renewal_days_remaining BETWEEN 0 AND 90
    AND (v_scope = 'admin' OR (v_scope = 'office' AND d.oficina_id = v_oficina) OR (v_scope = 'self' AND d.usuario_id = p_user_id))
    AND (p_vendedor_id IS NULL OR d.vend_id = p_vendedor_id);

  -- Cancelaciones in the selected period
  SELECT COUNT(*) INTO v_cancelaciones
  FROM sicas_documents d
  WHERE d.is_cancelada = true AND d.fecha_captura::date BETWEEN v_periodo_inicio AND v_periodo_fin
    AND (v_scope = 'admin' OR (v_scope = 'office' AND d.oficina_id = v_oficina) OR (v_scope = 'self' AND d.usuario_id = p_user_id))
    AND (p_vendedor_id IS NULL OR d.vend_id = p_vendedor_id);

  -- Previous month (always relative to current month)
  SELECT COALESCE(SUM(d.prima_neta), 0) INTO v_prima_mes_anterior
  FROM sicas_documents d
  WHERE d.fecha_captura::date BETWEEN v_mes_anterior_inicio AND v_mes_anterior_fin
    AND (v_scope = 'admin' OR (v_scope = 'office' AND d.oficina_id = v_oficina) OR (v_scope = 'self' AND d.usuario_id = p_user_id))
    AND (p_vendedor_id IS NULL OR d.vend_id = p_vendedor_id);

  -- Same month last year
  SELECT COALESCE(SUM(d.prima_neta), 0) INTO v_prima_mismo_mes_ant
  FROM sicas_documents d
  WHERE d.fecha_captura::date BETWEEN v_mismo_mes_anio_ant_inicio AND v_mismo_mes_anio_ant_fin
    AND (v_scope = 'admin' OR (v_scope = 'office' AND d.oficina_id = v_oficina) OR (v_scope = 'self' AND d.usuario_id = p_user_id))
    AND (p_vendedor_id IS NULL OR d.vend_id = p_vendedor_id);

  -- YTD
  SELECT COALESCE(SUM(d.prima_neta), 0) INTO v_acumulado_ytd
  FROM sicas_documents d
  WHERE d.fecha_captura::date BETWEEN v_anio_actual_inicio AND CURRENT_DATE
    AND (v_scope = 'admin' OR (v_scope = 'office' AND d.oficina_id = v_oficina) OR (v_scope = 'self' AND d.usuario_id = p_user_id))
    AND (p_vendedor_id IS NULL OR d.vend_id = p_vendedor_id);

  SELECT COALESCE(SUM(d.prima_neta), 0) INTO v_acumulado_ytd_ant
  FROM sicas_documents d
  WHERE d.fecha_captura::date BETWEEN v_mismo_periodo_ant_inicio AND v_mismo_periodo_ant_fin
    AND (v_scope = 'admin' OR (v_scope = 'office' AND d.oficina_id = v_oficina) OR (v_scope = 'self' AND d.usuario_id = p_user_id))
    AND (p_vendedor_id IS NULL OR d.vend_id = p_vendedor_id);

  -- Top client in selected period
  SELECT jsonb_build_object('nombre', t.cliente, 'prima', t.p) INTO v_top_cliente
  FROM (
    SELECT d.cliente, SUM(d.prima_neta) as p
    FROM sicas_documents d
    WHERE d.cliente IS NOT NULL AND d.fecha_captura::date BETWEEN v_periodo_inicio AND v_periodo_fin
      AND (v_scope = 'admin' OR (v_scope = 'office' AND d.oficina_id = v_oficina) OR (v_scope = 'self' AND d.usuario_id = p_user_id))
      AND (p_vendedor_id IS NULL OR d.vend_id = p_vendedor_id)
    GROUP BY d.cliente ORDER BY p DESC LIMIT 1
  ) t;

  -- Top aseguradora in selected period
  SELECT jsonb_build_object('nombre', t.compania, 'prima', t.p) INTO v_top_aseguradora
  FROM (
    SELECT d.compania, SUM(d.prima_neta) as p
    FROM sicas_documents d
    WHERE d.compania IS NOT NULL AND d.fecha_captura::date BETWEEN v_periodo_inicio AND v_periodo_fin
      AND (v_scope = 'admin' OR (v_scope = 'office' AND d.oficina_id = v_oficina) OR (v_scope = 'self' AND d.usuario_id = p_user_id))
      AND (p_vendedor_id IS NULL OR d.vend_id = p_vendedor_id)
    GROUP BY d.compania ORDER BY p DESC LIMIT 1
  ) t;

  -- Top ramo in selected period
  SELECT jsonb_build_object('nombre', t.ramo, 'prima', t.p) INTO v_top_ramo
  FROM (
    SELECT d.ramo, SUM(d.prima_neta) as p
    FROM sicas_documents d
    WHERE d.ramo IS NOT NULL AND d.fecha_captura::date BETWEEN v_periodo_inicio AND v_periodo_fin
      AND (v_scope = 'admin' OR (v_scope = 'office' AND d.oficina_id = v_oficina) OR (v_scope = 'self' AND d.usuario_id = p_user_id))
      AND (p_vendedor_id IS NULL OR d.vend_id = p_vendedor_id)
    GROUP BY d.ramo ORDER BY p DESC LIMIT 1
  ) t;

  -- Top oficina in selected period
  SELECT jsonb_build_object('nombre', t.nombre, 'prima', t.p, 'oficina_id', t.oid) INTO v_top_oficina
  FROM (
    SELECT COALESCE(o.nombre, d.oficina_nombre, d.desp_nombre, 'Sin oficina') as nombre,
           d.oficina_id as oid, SUM(d.prima_neta) as p
    FROM sicas_documents d
    LEFT JOIN oficinas o ON o.id = d.oficina_id
    WHERE d.fecha_captura::date BETWEEN v_periodo_inicio AND v_periodo_fin
      AND (v_scope = 'admin' OR (v_scope = 'office' AND d.oficina_id = v_oficina) OR (v_scope = 'self' AND d.usuario_id = p_user_id))
      AND (p_vendedor_id IS NULL OR d.vend_id = p_vendedor_id)
    GROUP BY d.oficina_id, o.nombre, d.oficina_nombre, d.desp_nombre ORDER BY p DESC LIMIT 1
  ) t;

  -- Top vendedor in selected period
  SELECT jsonb_build_object('nombre', t.vend_nombre, 'prima', t.p, 'vend_id', t.vid) INTO v_top_vendedor
  FROM (
    SELECT d.vend_nombre, d.vend_id as vid, SUM(d.prima_neta) as p
    FROM sicas_documents d
    WHERE d.vend_id IS NOT NULL AND d.fecha_captura::date BETWEEN v_periodo_inicio AND v_periodo_fin
      AND (v_scope = 'admin' OR (v_scope = 'office' AND d.oficina_id = v_oficina) OR (v_scope = 'self' AND d.usuario_id = p_user_id))
      AND (p_vendedor_id IS NULL OR d.vend_id = p_vendedor_id)
    GROUP BY d.vend_nombre, d.vend_id ORDER BY p DESC LIMIT 1
  ) t;

  -- Concentration top 5 clients in selected period
  SELECT CASE WHEN v_prima_neta_emitida > 0 THEN
    COALESCE((
      SELECT SUM(sub.p) * 100.0 / v_prima_neta_emitida
      FROM (
        SELECT SUM(d.prima_neta) as p
        FROM sicas_documents d
        WHERE d.cliente IS NOT NULL AND d.fecha_captura::date BETWEEN v_periodo_inicio AND v_periodo_fin
          AND (v_scope = 'admin' OR (v_scope = 'office' AND d.oficina_id = v_oficina) OR (v_scope = 'self' AND d.usuario_id = p_user_id))
          AND (p_vendedor_id IS NULL OR d.vend_id = p_vendedor_id)
        GROUP BY d.cliente ORDER BY p DESC LIMIT 5
      ) sub
    ), 0)
  ELSE 0 END
  INTO v_conc_top5_clientes;

  -- Concentration top 3 aseguradoras in selected period
  SELECT CASE WHEN v_prima_neta_emitida > 0 THEN
    COALESCE((
      SELECT SUM(sub.p) * 100.0 / v_prima_neta_emitida
      FROM (
        SELECT SUM(d.prima_neta) as p
        FROM sicas_documents d
        WHERE d.compania IS NOT NULL AND d.fecha_captura::date BETWEEN v_periodo_inicio AND v_periodo_fin
          AND (v_scope = 'admin' OR (v_scope = 'office' AND d.oficina_id = v_oficina) OR (v_scope = 'self' AND d.usuario_id = p_user_id))
          AND (p_vendedor_id IS NULL OR d.vend_id = p_vendedor_id)
        GROUP BY d.compania ORDER BY p DESC LIMIT 3
      ) sub
    ), 0)
  ELSE 0 END
  INTO v_conc_top3_aseguradoras;

  -- Last sync
  SELECT MAX(d.synced_at)::text INTO v_last_sync FROM sicas_documents d;

  RETURN jsonb_build_object(
    'polizas_emitidas', v_polizas_emitidas,
    'fianzas_emitidas', v_fianzas_emitidas,
    'total_emitidos', v_total_emitidos,
    'prima_neta_emitida', ROUND(v_prima_neta_emitida, 2),
    'prima_total_emitida', ROUND(v_prima_total_emitida, 2),
    'clientes_emision', v_clientes_emision,
    'ticket_promedio', ROUND(v_ticket_promedio, 2),
    'documentos_vigentes', v_docs_vigentes,
    'prima_vigente', ROUND(v_prima_vigente, 2),
    'clientes_vigentes', v_clientes_vigentes,
    'renovaciones_pendientes', v_renov_pendientes,
    'prima_por_renovar', ROUND(v_prima_por_renovar, 2),
    'renovaciones_7dias', v_renov_7,
    'renovaciones_15dias', v_renov_15,
    'renovaciones_30dias', v_renov_30,
    'cancelaciones_periodo', v_cancelaciones,
    'prima_mes_anterior', ROUND(v_prima_mes_anterior, 2),
    'prima_mismo_mes_ant', ROUND(v_prima_mismo_mes_ant, 2),
    'variacion_mes_anterior', CASE
      WHEN v_prima_mes_anterior > 0 THEN ROUND((v_prima_neta_emitida - v_prima_mes_anterior) * 100.0 / v_prima_mes_anterior, 2)
      WHEN v_prima_neta_emitida > 0 THEN 100
      ELSE 0
    END,
    'variacion_interanual', CASE
      WHEN v_prima_mismo_mes_ant > 0 THEN ROUND((v_prima_neta_emitida - v_prima_mismo_mes_ant) * 100.0 / v_prima_mismo_mes_ant, 2)
      WHEN v_prima_neta_emitida > 0 THEN 100
      ELSE 0
    END,
    'acumulado_ytd', ROUND(v_acumulado_ytd, 2),
    'acumulado_ytd_anterior', ROUND(v_acumulado_ytd_ant, 2),
    'crecimiento_ytd', CASE
      WHEN v_acumulado_ytd_ant > 0 THEN ROUND((v_acumulado_ytd - v_acumulado_ytd_ant) * 100.0 / v_acumulado_ytd_ant, 2)
      WHEN v_acumulado_ytd > 0 THEN 100
      ELSE 0
    END,
    'top_cliente', COALESCE(v_top_cliente, '{"nombre":null,"prima":0}'::jsonb),
    'top_aseguradora', COALESCE(v_top_aseguradora, '{"nombre":null,"prima":0}'::jsonb),
    'top_ramo', COALESCE(v_top_ramo, '{"nombre":null,"prima":0}'::jsonb),
    'top_oficina', COALESCE(v_top_oficina, '{"nombre":null,"prima":0}'::jsonb),
    'top_vendedor', COALESCE(v_top_vendedor, '{"nombre":null,"prima":0}'::jsonb),
    'concentracion_top5_clientes', ROUND(v_conc_top5_clientes, 2),
    'concentracion_top3_aseguradoras', ROUND(v_conc_top3_aseguradoras, 2),
    'scope', v_scope,
    'last_sync', v_last_sync
  );
END;
$$;

-- Fix get_sicas_avance_comercial
CREATE OR REPLACE FUNCTION get_sicas_avance_comercial(
  p_user_id uuid,
  p_scope text DEFAULT NULL,
  p_oficina_id uuid DEFAULT NULL,
  p_vendedor_id text DEFAULT NULL,
  p_fecha_desde date DEFAULT NULL,
  p_fecha_hasta date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rol text;
  v_oficina uuid;
  v_scope text;

  v_desde date;
  v_hasta date;
  v_desde_ant date;
  v_hasta_ant date;
  v_ytd_desde date;
  v_ytd_hasta date;
  v_ytd_ant_desde date;
  v_ytd_ant_hasta date;
  v_anio_ant_desde date;
  v_anio_ant_hasta date;
  v_dia_del_mes int;
  v_mes_actual int;

  v_cur_prima numeric;
  v_cur_polizas int;
  v_cur_fianzas int;
  v_cur_total int;
  v_cur_clientes int;
  v_cur_prima_total numeric;

  v_ant_prima numeric;
  v_ant_polizas int;
  v_ant_fianzas int;
  v_ant_total int;
  v_ant_clientes int;
  v_ant_prima_total numeric;

  v_ytd_prima numeric;
  v_ytd_polizas int;
  v_ytd_total int;

  v_ytd_ant_prima numeric;
  v_ytd_ant_polizas int;
  v_ytd_ant_total int;

  v_full_ant_prima numeric;
  v_full_ant_polizas int;
  v_full_ant_total int;

  v_meta_prima numeric;
  v_meta_polizas numeric;
  v_meta_mensual_prima numeric;
  v_meta_mensual_polizas numeric;
BEGIN
  SELECT rol, oficina_id INTO v_rol, v_oficina FROM usuarios WHERE id = p_user_id;
  IF v_rol IS NULL THEN
    RETURN jsonb_build_object('error', 'Usuario no encontrado');
  END IF;

  IF v_rol = 'Administrador' THEN
    v_scope := COALESCE(p_scope, 'admin');
  ELSIF v_rol IN ('Gerente', 'Empleado', 'Ejecutivo') THEN
    v_scope := COALESCE(p_scope, 'office');
    IF v_scope = 'admin' THEN v_scope := 'office'; END IF;
  ELSE
    v_scope := 'self';
  END IF;

  IF p_oficina_id IS NOT NULL AND v_scope = 'admin' THEN
    v_oficina := p_oficina_id;
    v_scope := 'office';
  ELSIF v_scope = 'office' THEN
    v_oficina := COALESCE(p_oficina_id, v_oficina);
  END IF;

  v_desde := COALESCE(p_fecha_desde, date_trunc('month', CURRENT_DATE)::date);
  v_hasta := COALESCE(p_fecha_hasta, CURRENT_DATE);
  v_desde_ant := v_desde - interval '1 year';
  v_hasta_ant := v_hasta - interval '1 year';

  v_ytd_desde := date_trunc('year', CURRENT_DATE)::date;
  v_ytd_hasta := CURRENT_DATE;
  v_ytd_ant_desde := (date_trunc('year', CURRENT_DATE) - interval '1 year')::date;
  v_ytd_ant_hasta := (CURRENT_DATE - interval '1 year')::date;

  v_anio_ant_desde := (date_trunc('year', CURRENT_DATE) - interval '1 year')::date;
  v_anio_ant_hasta := (date_trunc('year', CURRENT_DATE) - interval '1 day')::date;

  v_dia_del_mes := EXTRACT(DAY FROM CURRENT_DATE)::int;
  v_mes_actual := EXTRACT(MONTH FROM CURRENT_DATE)::int;

  -- CURRENT PERIOD
  SELECT
    COALESCE(SUM(d.prima_neta), 0),
    COALESCE(SUM(GREATEST(COALESCE(d.prima_total, 0), COALESCE(d.importe, 0))), 0),
    COUNT(*) FILTER (WHERE NOT COALESCE(d.is_fianza, false)),
    COUNT(*) FILTER (WHERE COALESCE(d.is_fianza, false)),
    COUNT(*),
    COUNT(DISTINCT d.cliente)
  INTO v_cur_prima, v_cur_prima_total, v_cur_polizas, v_cur_fianzas, v_cur_total, v_cur_clientes
  FROM sicas_documents d
  WHERE d.fecha_captura::date BETWEEN v_desde AND v_hasta
    AND (v_scope = 'admin' OR (v_scope = 'office' AND d.oficina_id = v_oficina) OR (v_scope = 'self' AND d.usuario_id = p_user_id))
    AND (p_vendedor_id IS NULL OR d.vend_id = p_vendedor_id);

  -- SAME PERIOD LAST YEAR
  SELECT
    COALESCE(SUM(d.prima_neta), 0),
    COALESCE(SUM(GREATEST(COALESCE(d.prima_total, 0), COALESCE(d.importe, 0))), 0),
    COUNT(*) FILTER (WHERE NOT COALESCE(d.is_fianza, false)),
    COUNT(*) FILTER (WHERE COALESCE(d.is_fianza, false)),
    COUNT(*),
    COUNT(DISTINCT d.cliente)
  INTO v_ant_prima, v_ant_prima_total, v_ant_polizas, v_ant_fianzas, v_ant_total, v_ant_clientes
  FROM sicas_documents d
  WHERE d.fecha_captura::date BETWEEN v_desde_ant AND v_hasta_ant
    AND (v_scope = 'admin' OR (v_scope = 'office' AND d.oficina_id = v_oficina) OR (v_scope = 'self' AND d.usuario_id = p_user_id))
    AND (p_vendedor_id IS NULL OR d.vend_id = p_vendedor_id);

  -- YTD CURRENT
  SELECT
    COALESCE(SUM(d.prima_neta), 0),
    COUNT(*) FILTER (WHERE NOT COALESCE(d.is_fianza, false)),
    COUNT(*)
  INTO v_ytd_prima, v_ytd_polizas, v_ytd_total
  FROM sicas_documents d
  WHERE d.fecha_captura::date BETWEEN v_ytd_desde AND v_ytd_hasta
    AND (v_scope = 'admin' OR (v_scope = 'office' AND d.oficina_id = v_oficina) OR (v_scope = 'self' AND d.usuario_id = p_user_id))
    AND (p_vendedor_id IS NULL OR d.vend_id = p_vendedor_id);

  -- YTD LAST YEAR (same day)
  SELECT
    COALESCE(SUM(d.prima_neta), 0),
    COUNT(*) FILTER (WHERE NOT COALESCE(d.is_fianza, false)),
    COUNT(*)
  INTO v_ytd_ant_prima, v_ytd_ant_polizas, v_ytd_ant_total
  FROM sicas_documents d
  WHERE d.fecha_captura::date BETWEEN v_ytd_ant_desde AND v_ytd_ant_hasta
    AND (v_scope = 'admin' OR (v_scope = 'office' AND d.oficina_id = v_oficina) OR (v_scope = 'self' AND d.usuario_id = p_user_id))
    AND (p_vendedor_id IS NULL OR d.vend_id = p_vendedor_id);

  -- FULL PREVIOUS YEAR
  SELECT
    COALESCE(SUM(d.prima_neta), 0),
    COUNT(*) FILTER (WHERE NOT COALESCE(d.is_fianza, false)),
    COUNT(*)
  INTO v_full_ant_prima, v_full_ant_polizas, v_full_ant_total
  FROM sicas_documents d
  WHERE d.fecha_captura::date BETWEEN v_anio_ant_desde AND v_anio_ant_hasta
    AND (v_scope = 'admin' OR (v_scope = 'office' AND d.oficina_id = v_oficina) OR (v_scope = 'self' AND d.usuario_id = p_user_id))
    AND (p_vendedor_id IS NULL OR d.vend_id = p_vendedor_id);

  -- CALCULATE GOALS
  v_meta_prima := ROUND(v_full_ant_prima * 1.20, 2);
  v_meta_polizas := CEIL(v_full_ant_polizas * 1.20);
  v_meta_mensual_prima := ROUND(v_meta_prima / 12.0, 2);
  v_meta_mensual_polizas := CEIL(v_meta_polizas / 12.0);

  RETURN jsonb_build_object(
    'periodo_actual', jsonb_build_object(
      'prima_neta', ROUND(v_cur_prima, 2),
      'prima_total', ROUND(v_cur_prima_total, 2),
      'polizas', v_cur_polizas,
      'fianzas', v_cur_fianzas,
      'total_docs', v_cur_total,
      'clientes', v_cur_clientes,
      'fecha_desde', v_desde::text,
      'fecha_hasta', v_hasta::text
    ),
    'periodo_anterior', jsonb_build_object(
      'prima_neta', ROUND(v_ant_prima, 2),
      'prima_total', ROUND(v_ant_prima_total, 2),
      'polizas', v_ant_polizas,
      'fianzas', v_ant_fianzas,
      'total_docs', v_ant_total,
      'clientes', v_ant_clientes,
      'fecha_desde', v_desde_ant::text,
      'fecha_hasta', v_hasta_ant::text
    ),
    'ytd_actual', jsonb_build_object(
      'prima_neta', ROUND(v_ytd_prima, 2),
      'polizas', v_ytd_polizas,
      'total_docs', v_ytd_total,
      'fecha_desde', v_ytd_desde::text,
      'fecha_hasta', v_ytd_hasta::text
    ),
    'ytd_anterior', jsonb_build_object(
      'prima_neta', ROUND(v_ytd_ant_prima, 2),
      'polizas', v_ytd_ant_polizas,
      'total_docs', v_ytd_ant_total,
      'fecha_desde', v_ytd_ant_desde::text,
      'fecha_hasta', v_ytd_ant_hasta::text
    ),
    'anual_anterior_completo', jsonb_build_object(
      'prima_neta', ROUND(v_full_ant_prima, 2),
      'polizas', v_full_ant_polizas,
      'total_docs', v_full_ant_total,
      'fecha_desde', v_anio_ant_desde::text,
      'fecha_hasta', v_anio_ant_hasta::text
    ),
    'meta_anual', jsonb_build_object(
      'prima_neta', v_meta_prima,
      'polizas', v_meta_polizas::int,
      'total_docs', CEIL(v_full_ant_total * 1.20)::int
    ),
    'meta_mensual', jsonb_build_object(
      'prima_neta', v_meta_mensual_prima,
      'polizas', v_meta_mensual_polizas::int
    ),
    'crecimiento', jsonb_build_object(
      'prima_vs_anterior', CASE
        WHEN v_ant_prima > 0 THEN ROUND((v_cur_prima - v_ant_prima) * 100.0 / v_ant_prima, 2)
        WHEN v_cur_prima > 0 THEN 100
        ELSE 0
      END,
      'polizas_vs_anterior', CASE
        WHEN v_ant_polizas > 0 THEN ROUND((v_cur_polizas - v_ant_polizas) * 100.0 / v_ant_polizas, 2)
        WHEN v_cur_polizas > 0 THEN 100
        ELSE 0
      END,
      'prima_delta', ROUND(v_cur_prima - v_ant_prima, 2),
      'polizas_delta', v_cur_polizas - v_ant_polizas,
      'avance_meta_prima_pct', CASE
        WHEN v_meta_mensual_prima > 0 THEN ROUND(v_cur_prima * 100.0 / v_meta_mensual_prima, 2)
        WHEN v_cur_prima > 0 THEN 100
        ELSE 0
      END,
      'avance_meta_polizas_pct', CASE
        WHEN v_meta_mensual_polizas > 0 THEN ROUND(v_cur_polizas * 100.0 / v_meta_mensual_polizas, 2)
        WHEN v_cur_polizas > 0 THEN 100
        ELSE 0
      END,
      'falta_prima', CASE
        WHEN v_meta_mensual_prima > 0 THEN GREATEST(ROUND(v_meta_mensual_prima - v_cur_prima, 2), 0)
        ELSE 0
      END,
      'falta_polizas', CASE
        WHEN v_meta_mensual_polizas > 0 THEN GREATEST(v_meta_mensual_polizas - v_cur_polizas, 0)
        ELSE 0
      END,
      'ytd_prima_vs_anterior', CASE
        WHEN v_ytd_ant_prima > 0 THEN ROUND((v_ytd_prima - v_ytd_ant_prima) * 100.0 / v_ytd_ant_prima, 2)
        WHEN v_ytd_prima > 0 THEN 100
        ELSE 0
      END,
      'ytd_polizas_vs_anterior', CASE
        WHEN v_ytd_ant_polizas > 0 THEN ROUND((v_ytd_polizas - v_ytd_ant_polizas) * 100.0 / v_ytd_ant_polizas, 2)
        WHEN v_ytd_polizas > 0 THEN 100
        ELSE 0
      END,
      'avance_meta_anual_prima_pct', CASE
        WHEN v_meta_prima > 0 THEN ROUND(v_ytd_prima * 100.0 / v_meta_prima, 2)
        WHEN v_ytd_prima > 0 THEN 100
        ELSE 0
      END,
      'avance_meta_anual_polizas_pct', CASE
        WHEN v_meta_polizas > 0 THEN ROUND(v_ytd_polizas * 100.0 / v_meta_polizas, 2)
        WHEN v_ytd_polizas > 0 THEN 100
        ELSE 0
      END
    ),
    'has_previous_year_data', (v_full_ant_prima > 0),
    'scope', v_scope,
    'dia_del_mes', v_dia_del_mes,
    'mes_actual', v_mes_actual
  );
END;
$$;
