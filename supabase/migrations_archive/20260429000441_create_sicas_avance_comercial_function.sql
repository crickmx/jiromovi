/*
  # Create SICAS Avance Comercial (Commercial Performance) function

  1. New Function: `get_sicas_avance_comercial`
    - Returns comparative commercial performance metrics
    - Current period vs same period last year
    - Annual totals for goal calculation (last year full + 20% = this year goal)
    - Monthly equivalents for goal progress

  2. Parameters
    - `p_user_id` (uuid) - authenticated user
    - `p_scope` (text) - admin/office/self
    - `p_oficina_id` (uuid) - optional office filter
    - `p_vendedor_id` (text) - optional vendor filter
    - `p_fecha_desde` (date) - period start (defaults to month start)
    - `p_fecha_hasta` (date) - period end (defaults to today)

  3. Returns JSON with:
    - `periodo_actual`: prima_neta, polizas, fianzas, total_docs, clientes, fecha_desde, fecha_hasta
    - `periodo_anterior`: same metrics for same date range last year
    - `anual_actual`: YTD totals
    - `anual_anterior`: same period YTD last year
    - `anual_completo_anterior`: full previous year totals (for goal base)
    - `meta`: calculated goals (anual_completo_anterior * 1.20)
    - `meta_mensual`: monthly equivalent of annual goal
    - `crecimiento`: percent changes and deltas

  4. Security
    - SECURITY DEFINER with search_path = public
    - Role-based scoping enforced
*/

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

  -- Period boundaries
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

  -- Current period
  v_cur_prima numeric;
  v_cur_polizas int;
  v_cur_fianzas int;
  v_cur_total int;
  v_cur_clientes int;
  v_cur_prima_total numeric;

  -- Same period last year
  v_ant_prima numeric;
  v_ant_polizas int;
  v_ant_fianzas int;
  v_ant_total int;
  v_ant_clientes int;
  v_ant_prima_total numeric;

  -- YTD current
  v_ytd_prima numeric;
  v_ytd_polizas int;
  v_ytd_total int;

  -- YTD last year (same day range)
  v_ytd_ant_prima numeric;
  v_ytd_ant_polizas int;
  v_ytd_ant_total int;

  -- Full previous year
  v_full_ant_prima numeric;
  v_full_ant_polizas int;
  v_full_ant_total int;

  -- Goals
  v_meta_prima numeric;
  v_meta_polizas numeric;
  v_meta_mensual_prima numeric;
  v_meta_mensual_polizas numeric;
BEGIN
  -- Resolve user role and scope
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

  -- Calculate date ranges
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

  -- ============ CURRENT PERIOD ============
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

  -- ============ SAME PERIOD LAST YEAR ============
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

  -- ============ YTD CURRENT ============
  SELECT
    COALESCE(SUM(d.prima_neta), 0),
    COUNT(*) FILTER (WHERE NOT COALESCE(d.is_fianza, false)),
    COUNT(*)
  INTO v_ytd_prima, v_ytd_polizas, v_ytd_total
  FROM sicas_documents d
  WHERE d.fecha_captura::date BETWEEN v_ytd_desde AND v_ytd_hasta
    AND (v_scope = 'admin' OR (v_scope = 'office' AND d.oficina_id = v_oficina) OR (v_scope = 'self' AND d.usuario_id = p_user_id))
    AND (p_vendedor_id IS NULL OR d.vend_id = p_vendedor_id);

  -- ============ YTD LAST YEAR (same day) ============
  SELECT
    COALESCE(SUM(d.prima_neta), 0),
    COUNT(*) FILTER (WHERE NOT COALESCE(d.is_fianza, false)),
    COUNT(*)
  INTO v_ytd_ant_prima, v_ytd_ant_polizas, v_ytd_ant_total
  FROM sicas_documents d
  WHERE d.fecha_captura::date BETWEEN v_ytd_ant_desde AND v_ytd_ant_hasta
    AND (v_scope = 'admin' OR (v_scope = 'office' AND d.oficina_id = v_oficina) OR (v_scope = 'self' AND d.usuario_id = p_user_id))
    AND (p_vendedor_id IS NULL OR d.vend_id = p_vendedor_id);

  -- ============ FULL PREVIOUS YEAR ============
  SELECT
    COALESCE(SUM(d.prima_neta), 0),
    COUNT(*) FILTER (WHERE NOT COALESCE(d.is_fianza, false)),
    COUNT(*)
  INTO v_full_ant_prima, v_full_ant_polizas, v_full_ant_total
  FROM sicas_documents d
  WHERE d.fecha_captura::date BETWEEN v_anio_ant_desde AND v_anio_ant_hasta
    AND (v_scope = 'admin' OR (v_scope = 'office' AND d.oficina_id = v_oficina) OR (v_scope = 'self' AND d.usuario_id = p_user_id))
    AND (p_vendedor_id IS NULL OR d.vend_id = p_vendedor_id);

  -- ============ CALCULATE GOALS ============
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
      'prima_vs_anterior', CASE WHEN v_ant_prima > 0 THEN ROUND((v_cur_prima - v_ant_prima) * 100.0 / v_ant_prima, 2) ELSE 0 END,
      'polizas_vs_anterior', CASE WHEN v_ant_polizas > 0 THEN ROUND((v_cur_polizas - v_ant_polizas) * 100.0 / v_ant_polizas, 2) ELSE 0 END,
      'prima_delta', ROUND(v_cur_prima - v_ant_prima, 2),
      'polizas_delta', v_cur_polizas - v_ant_polizas,
      'avance_meta_prima_pct', CASE WHEN v_meta_mensual_prima > 0 THEN ROUND(v_cur_prima * 100.0 / v_meta_mensual_prima, 2) ELSE 0 END,
      'avance_meta_polizas_pct', CASE WHEN v_meta_mensual_polizas > 0 THEN ROUND(v_cur_polizas * 100.0 / v_meta_mensual_polizas, 2) ELSE 0 END,
      'falta_prima', GREATEST(ROUND(v_meta_mensual_prima - v_cur_prima, 2), 0),
      'falta_polizas', GREATEST(v_meta_mensual_polizas - v_cur_polizas, 0),
      'ytd_prima_vs_anterior', CASE WHEN v_ytd_ant_prima > 0 THEN ROUND((v_ytd_prima - v_ytd_ant_prima) * 100.0 / v_ytd_ant_prima, 2) ELSE 0 END,
      'ytd_polizas_vs_anterior', CASE WHEN v_ytd_ant_polizas > 0 THEN ROUND((v_ytd_polizas - v_ytd_ant_polizas) * 100.0 / v_ytd_ant_polizas, 2) ELSE 0 END,
      'avance_meta_anual_prima_pct', CASE WHEN v_meta_prima > 0 THEN ROUND(v_ytd_prima * 100.0 / v_meta_prima, 2) ELSE 0 END,
      'avance_meta_anual_polizas_pct', CASE WHEN v_meta_polizas > 0 THEN ROUND(v_ytd_polizas * 100.0 / v_meta_polizas, 2) ELSE 0 END
    ),
    'scope', v_scope,
    'dia_del_mes', v_dia_del_mes,
    'mes_actual', v_mes_actual
  );
END;
$$;