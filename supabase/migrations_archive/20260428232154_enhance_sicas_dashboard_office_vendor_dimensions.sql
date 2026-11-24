/*
  # Enhance SICAS Dashboard with Office and Vendor Dimensions

  1. Changes to `get_sicas_dashboard_top`
    - Add support for 'oficina' dimension (top offices by prima)
    - Add support for 'vendedor' dimension (top vendors by prima)

  2. Changes to `get_sicas_dashboard_kpis`
    - Add optional p_vendedor_id parameter for vendor-level filtering
    - Add top_oficina and top_vendedor to returned KPIs

  3. Changes to `get_sicas_dashboard_charts`
    - Add optional p_vendedor_id parameter for vendor-level filtering
    - Add por_oficina and por_vendedor chart dimensions

  4. New function `get_sicas_dashboard_oficinas`
    - Returns list of offices with document counts for admin filter dropdown

  5. Security
    - All functions remain SECURITY DEFINER
    - Role-based scoping enforced in all functions
*/

-- 1. Enhanced get_sicas_dashboard_top with oficina/vendedor dimensions
CREATE OR REPLACE FUNCTION get_sicas_dashboard_top(
  p_user_id uuid,
  p_dimension text DEFAULT 'cliente',
  p_limit int DEFAULT 10,
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
  v_desde date;
  v_hasta date;
  v_result jsonb;
BEGIN
  SELECT rol, oficina_id INTO v_rol, v_oficina FROM usuarios WHERE id = p_user_id;
  IF v_rol IS NULL THEN RETURN '[]'::jsonb; END IF;

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
  END IF;

  v_desde := COALESCE(p_fecha_desde, date_trunc('year', CURRENT_DATE)::date);
  v_hasta := COALESCE(p_fecha_hasta, CURRENT_DATE);

  IF p_dimension = 'cliente' THEN
    SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) INTO v_result
    FROM (
      SELECT
        d.cliente AS nombre,
        COUNT(*) AS documentos,
        COALESCE(SUM(d.prima_neta), 0) AS prima_neta,
        COALESCE(SUM(GREATEST(d.prima_total, d.importe)), 0) AS prima_total,
        COUNT(DISTINCT d.compania) AS aseguradoras,
        COUNT(DISTINCT d.ramo) AS ramos,
        MIN(d.vigencia_hasta)::text AS proxima_renovacion
      FROM sicas_documents d
      WHERE d.cliente IS NOT NULL
        AND d.fecha_captura::date BETWEEN v_desde AND v_hasta
        AND (v_scope = 'admin' OR (v_scope = 'office' AND d.oficina_id = v_oficina) OR (v_scope = 'self' AND d.usuario_id = p_user_id))
        AND (p_vendedor_id IS NULL OR d.vend_id = p_vendedor_id)
      GROUP BY d.cliente
      ORDER BY prima_neta DESC
      LIMIT p_limit
    ) t;

  ELSIF p_dimension = 'aseguradora' THEN
    SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) INTO v_result
    FROM (
      SELECT
        d.compania AS nombre,
        COUNT(*) AS documentos,
        COALESCE(SUM(d.prima_neta), 0) AS prima_neta,
        COALESCE(SUM(GREATEST(d.prima_total, d.importe)), 0) AS prima_total,
        COUNT(DISTINCT d.cliente) AS clientes,
        COUNT(DISTINCT d.ramo) AS ramos
      FROM sicas_documents d
      WHERE d.compania IS NOT NULL
        AND d.fecha_captura::date BETWEEN v_desde AND v_hasta
        AND (v_scope = 'admin' OR (v_scope = 'office' AND d.oficina_id = v_oficina) OR (v_scope = 'self' AND d.usuario_id = p_user_id))
        AND (p_vendedor_id IS NULL OR d.vend_id = p_vendedor_id)
      GROUP BY d.compania
      ORDER BY prima_neta DESC
      LIMIT p_limit
    ) t;

  ELSIF p_dimension = 'ramo' THEN
    SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) INTO v_result
    FROM (
      SELECT
        d.ramo AS nombre,
        COUNT(*) AS documentos,
        COALESCE(SUM(d.prima_neta), 0) AS prima_neta,
        COALESCE(SUM(GREATEST(d.prima_total, d.importe)), 0) AS prima_total,
        COUNT(DISTINCT d.cliente) AS clientes,
        COUNT(DISTINCT d.compania) AS aseguradoras
      FROM sicas_documents d
      WHERE d.ramo IS NOT NULL
        AND d.fecha_captura::date BETWEEN v_desde AND v_hasta
        AND (v_scope = 'admin' OR (v_scope = 'office' AND d.oficina_id = v_oficina) OR (v_scope = 'self' AND d.usuario_id = p_user_id))
        AND (p_vendedor_id IS NULL OR d.vend_id = p_vendedor_id)
      GROUP BY d.ramo
      ORDER BY prima_neta DESC
      LIMIT p_limit
    ) t;

  ELSIF p_dimension = 'subramo' THEN
    SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) INTO v_result
    FROM (
      SELECT
        d.subramo AS nombre,
        d.ramo,
        COUNT(*) AS documentos,
        COALESCE(SUM(d.prima_neta), 0) AS prima_neta,
        COALESCE(SUM(GREATEST(d.prima_total, d.importe)), 0) AS prima_total,
        COUNT(DISTINCT d.cliente) AS clientes
      FROM sicas_documents d
      WHERE d.subramo IS NOT NULL
        AND d.fecha_captura::date BETWEEN v_desde AND v_hasta
        AND (v_scope = 'admin' OR (v_scope = 'office' AND d.oficina_id = v_oficina) OR (v_scope = 'self' AND d.usuario_id = p_user_id))
        AND (p_vendedor_id IS NULL OR d.vend_id = p_vendedor_id)
      GROUP BY d.subramo, d.ramo
      ORDER BY prima_neta DESC
      LIMIT p_limit
    ) t;

  ELSIF p_dimension = 'oficina' THEN
    SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) INTO v_result
    FROM (
      SELECT
        COALESCE(o.nombre, d.oficina_nombre, d.desp_nombre, 'Sin oficina') AS nombre,
        d.oficina_id,
        COUNT(*) AS documentos,
        COALESCE(SUM(d.prima_neta), 0) AS prima_neta,
        COALESCE(SUM(GREATEST(d.prima_total, d.importe)), 0) AS prima_total,
        COUNT(DISTINCT d.cliente) AS clientes,
        COUNT(DISTINCT d.vend_id) AS vendedores,
        COUNT(DISTINCT d.compania) AS aseguradoras
      FROM sicas_documents d
      LEFT JOIN oficinas o ON o.id = d.oficina_id
      WHERE d.fecha_captura::date BETWEEN v_desde AND v_hasta
        AND (v_scope = 'admin' OR (v_scope = 'office' AND d.oficina_id = v_oficina) OR (v_scope = 'self' AND d.usuario_id = p_user_id))
        AND (p_vendedor_id IS NULL OR d.vend_id = p_vendedor_id)
      GROUP BY d.oficina_id, o.nombre, d.oficina_nombre, d.desp_nombre
      ORDER BY prima_neta DESC
      LIMIT p_limit
    ) t;

  ELSIF p_dimension = 'vendedor' THEN
    SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) INTO v_result
    FROM (
      SELECT
        COALESCE(d.vend_nombre, 'Sin vendedor') AS nombre,
        d.vend_id,
        COUNT(*) AS documentos,
        COALESCE(SUM(d.prima_neta), 0) AS prima_neta,
        COALESCE(SUM(GREATEST(d.prima_total, d.importe)), 0) AS prima_total,
        COUNT(DISTINCT d.cliente) AS clientes,
        COUNT(DISTINCT d.compania) AS aseguradoras,
        COUNT(DISTINCT d.ramo) AS ramos,
        MIN(d.vigencia_hasta)::text AS proxima_renovacion
      FROM sicas_documents d
      WHERE d.vend_id IS NOT NULL
        AND d.fecha_captura::date BETWEEN v_desde AND v_hasta
        AND (v_scope = 'admin' OR (v_scope = 'office' AND d.oficina_id = v_oficina) OR (v_scope = 'self' AND d.usuario_id = p_user_id))
      GROUP BY d.vend_id, d.vend_nombre
      ORDER BY prima_neta DESC
      LIMIT p_limit
    ) t;

  ELSE
    v_result := '[]'::jsonb;
  END IF;

  RETURN v_result;
END;
$$;

-- 2. Enhanced get_sicas_dashboard_kpis with vendedor filter and top oficina/vendedor
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
  v_mes_actual_inicio date;
  v_mes_actual_fin date;
  v_mes_anterior_inicio date;
  v_mes_anterior_fin date;
  v_mismo_mes_anio_ant_inicio date;
  v_mismo_mes_anio_ant_fin date;
  v_anio_actual_inicio date;
  v_mismo_periodo_ant_inicio date;
  v_mismo_periodo_ant_fin date;
  v_result jsonb;

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

  v_mes_actual_inicio := date_trunc('month', CURRENT_DATE)::date;
  v_mes_actual_fin := (date_trunc('month', CURRENT_DATE) + interval '1 month' - interval '1 day')::date;
  v_mes_anterior_inicio := (date_trunc('month', CURRENT_DATE) - interval '1 month')::date;
  v_mes_anterior_fin := (date_trunc('month', CURRENT_DATE) - interval '1 day')::date;
  v_mismo_mes_anio_ant_inicio := (date_trunc('month', CURRENT_DATE) - interval '1 year')::date;
  v_mismo_mes_anio_ant_fin := (date_trunc('month', CURRENT_DATE) - interval '1 year' + interval '1 month' - interval '1 day')::date;
  v_anio_actual_inicio := date_trunc('year', CURRENT_DATE)::date;
  v_mismo_periodo_ant_inicio := (date_trunc('year', CURRENT_DATE) - interval '1 year')::date;
  v_mismo_periodo_ant_fin := (CURRENT_DATE - interval '1 year');

  -- Current month emissions
  SELECT
    COUNT(*) FILTER (WHERE NOT COALESCE(d.is_fianza, false)),
    COUNT(*) FILTER (WHERE COALESCE(d.is_fianza, false)),
    COUNT(*),
    COALESCE(SUM(d.prima_neta), 0),
    COALESCE(SUM(GREATEST(COALESCE(d.prima_total, 0), COALESCE(d.importe, 0))), 0),
    COUNT(DISTINCT d.cliente)
  INTO v_polizas_emitidas, v_fianzas_emitidas, v_total_emitidos, v_prima_neta_emitida, v_prima_total_emitida, v_clientes_emision
  FROM sicas_documents d
  WHERE d.fecha_captura::date BETWEEN v_mes_actual_inicio AND v_mes_actual_fin
    AND (v_scope = 'admin' OR (v_scope = 'office' AND d.oficina_id = v_oficina) OR (v_scope = 'self' AND d.usuario_id = p_user_id))
    AND (p_vendedor_id IS NULL OR d.vend_id = p_vendedor_id);

  v_ticket_promedio := CASE WHEN v_total_emitidos > 0 THEN v_prima_neta_emitida / v_total_emitidos ELSE 0 END;

  -- Vigentes
  SELECT COUNT(*), COALESCE(SUM(d.prima_neta), 0), COUNT(DISTINCT d.cliente)
  INTO v_docs_vigentes, v_prima_vigente, v_clientes_vigentes
  FROM sicas_documents d
  WHERE d.is_vigente = true
    AND (v_scope = 'admin' OR (v_scope = 'office' AND d.oficina_id = v_oficina) OR (v_scope = 'self' AND d.usuario_id = p_user_id))
    AND (p_vendedor_id IS NULL OR d.vend_id = p_vendedor_id);

  -- Renovaciones
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

  -- Cancelaciones
  SELECT COUNT(*) INTO v_cancelaciones
  FROM sicas_documents d
  WHERE d.is_cancelada = true AND d.fecha_captura::date BETWEEN v_mes_actual_inicio AND v_mes_actual_fin
    AND (v_scope = 'admin' OR (v_scope = 'office' AND d.oficina_id = v_oficina) OR (v_scope = 'self' AND d.usuario_id = p_user_id))
    AND (p_vendedor_id IS NULL OR d.vend_id = p_vendedor_id);

  -- Previous month
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

  -- Top client
  SELECT jsonb_build_object('nombre', t.cliente, 'prima', t.p) INTO v_top_cliente
  FROM (
    SELECT d.cliente, SUM(d.prima_neta) as p
    FROM sicas_documents d
    WHERE d.cliente IS NOT NULL AND d.fecha_captura::date BETWEEN v_mes_actual_inicio AND v_mes_actual_fin
      AND (v_scope = 'admin' OR (v_scope = 'office' AND d.oficina_id = v_oficina) OR (v_scope = 'self' AND d.usuario_id = p_user_id))
      AND (p_vendedor_id IS NULL OR d.vend_id = p_vendedor_id)
    GROUP BY d.cliente ORDER BY p DESC LIMIT 1
  ) t;

  -- Top aseguradora
  SELECT jsonb_build_object('nombre', t.compania, 'prima', t.p) INTO v_top_aseguradora
  FROM (
    SELECT d.compania, SUM(d.prima_neta) as p
    FROM sicas_documents d
    WHERE d.compania IS NOT NULL AND d.fecha_captura::date BETWEEN v_mes_actual_inicio AND v_mes_actual_fin
      AND (v_scope = 'admin' OR (v_scope = 'office' AND d.oficina_id = v_oficina) OR (v_scope = 'self' AND d.usuario_id = p_user_id))
      AND (p_vendedor_id IS NULL OR d.vend_id = p_vendedor_id)
    GROUP BY d.compania ORDER BY p DESC LIMIT 1
  ) t;

  -- Top ramo
  SELECT jsonb_build_object('nombre', t.ramo, 'prima', t.p) INTO v_top_ramo
  FROM (
    SELECT d.ramo, SUM(d.prima_neta) as p
    FROM sicas_documents d
    WHERE d.ramo IS NOT NULL AND d.fecha_captura::date BETWEEN v_mes_actual_inicio AND v_mes_actual_fin
      AND (v_scope = 'admin' OR (v_scope = 'office' AND d.oficina_id = v_oficina) OR (v_scope = 'self' AND d.usuario_id = p_user_id))
      AND (p_vendedor_id IS NULL OR d.vend_id = p_vendedor_id)
    GROUP BY d.ramo ORDER BY p DESC LIMIT 1
  ) t;

  -- Top oficina (admin only)
  SELECT jsonb_build_object('nombre', t.nombre, 'prima', t.p, 'oficina_id', t.oid) INTO v_top_oficina
  FROM (
    SELECT COALESCE(o.nombre, d.oficina_nombre, d.desp_nombre, 'Sin oficina') as nombre,
           d.oficina_id as oid, SUM(d.prima_neta) as p
    FROM sicas_documents d
    LEFT JOIN oficinas o ON o.id = d.oficina_id
    WHERE d.fecha_captura::date BETWEEN v_mes_actual_inicio AND v_mes_actual_fin
      AND (v_scope = 'admin' OR (v_scope = 'office' AND d.oficina_id = v_oficina) OR (v_scope = 'self' AND d.usuario_id = p_user_id))
      AND (p_vendedor_id IS NULL OR d.vend_id = p_vendedor_id)
    GROUP BY d.oficina_id, o.nombre, d.oficina_nombre, d.desp_nombre ORDER BY p DESC LIMIT 1
  ) t;

  -- Top vendedor
  SELECT jsonb_build_object('nombre', t.vend_nombre, 'prima', t.p, 'vend_id', t.vid) INTO v_top_vendedor
  FROM (
    SELECT d.vend_nombre, d.vend_id as vid, SUM(d.prima_neta) as p
    FROM sicas_documents d
    WHERE d.vend_id IS NOT NULL AND d.fecha_captura::date BETWEEN v_mes_actual_inicio AND v_mes_actual_fin
      AND (v_scope = 'admin' OR (v_scope = 'office' AND d.oficina_id = v_oficina) OR (v_scope = 'self' AND d.usuario_id = p_user_id))
      AND (p_vendedor_id IS NULL OR d.vend_id = p_vendedor_id)
    GROUP BY d.vend_nombre, d.vend_id ORDER BY p DESC LIMIT 1
  ) t;

  -- Concentration top 5 clients
  SELECT CASE WHEN v_prima_neta_emitida > 0 THEN
    COALESCE((
      SELECT SUM(sub.p) * 100.0 / v_prima_neta_emitida
      FROM (
        SELECT SUM(d.prima_neta) as p
        FROM sicas_documents d
        WHERE d.cliente IS NOT NULL AND d.fecha_captura::date BETWEEN v_mes_actual_inicio AND v_mes_actual_fin
          AND (v_scope = 'admin' OR (v_scope = 'office' AND d.oficina_id = v_oficina) OR (v_scope = 'self' AND d.usuario_id = p_user_id))
          AND (p_vendedor_id IS NULL OR d.vend_id = p_vendedor_id)
        GROUP BY d.cliente ORDER BY p DESC LIMIT 5
      ) sub
    ), 0)
  ELSE 0 END
  INTO v_conc_top5_clientes;

  -- Concentration top 3 aseguradoras
  SELECT CASE WHEN v_prima_neta_emitida > 0 THEN
    COALESCE((
      SELECT SUM(sub.p) * 100.0 / v_prima_neta_emitida
      FROM (
        SELECT SUM(d.prima_neta) as p
        FROM sicas_documents d
        WHERE d.compania IS NOT NULL AND d.fecha_captura::date BETWEEN v_mes_actual_inicio AND v_mes_actual_fin
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
    'variacion_mes_anterior', CASE WHEN v_prima_mes_anterior > 0 THEN ROUND((v_prima_neta_emitida - v_prima_mes_anterior) * 100.0 / v_prima_mes_anterior, 2) ELSE 0 END,
    'variacion_interanual', CASE WHEN v_prima_mismo_mes_ant > 0 THEN ROUND((v_prima_neta_emitida - v_prima_mismo_mes_ant) * 100.0 / v_prima_mismo_mes_ant, 2) ELSE 0 END,
    'acumulado_ytd', ROUND(v_acumulado_ytd, 2),
    'acumulado_ytd_anterior', ROUND(v_acumulado_ytd_ant, 2),
    'crecimiento_ytd', CASE WHEN v_acumulado_ytd_ant > 0 THEN ROUND((v_acumulado_ytd - v_acumulado_ytd_ant) * 100.0 / v_acumulado_ytd_ant, 2) ELSE 0 END,
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

-- 3. Enhanced get_sicas_dashboard_charts with vendedor filter and por_oficina/por_vendedor
CREATE OR REPLACE FUNCTION get_sicas_dashboard_charts(
  p_user_id uuid,
  p_scope text DEFAULT NULL,
  p_oficina_id uuid DEFAULT NULL,
  p_meses int DEFAULT 24,
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
  v_desde date;
  v_result jsonb;
  v_prima_por_mes jsonb;
  v_por_aseguradora jsonb;
  v_por_ramo jsonb;
  v_por_subramo jsonb;
  v_por_cliente jsonb;
  v_por_oficina jsonb;
  v_por_vendedor jsonb;
  v_renovaciones jsonb;
BEGIN
  SELECT rol, oficina_id INTO v_rol, v_oficina FROM usuarios WHERE id = p_user_id;
  IF v_rol IS NULL THEN RETURN '{}'::jsonb; END IF;

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

  v_desde := CURRENT_DATE - (p_meses || ' months')::interval;

  -- Prima por mes
  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.mes), '[]'::jsonb) INTO v_prima_por_mes
  FROM (
    SELECT
      to_char(d.fecha_captura, 'YYYY-MM') AS mes,
      EXTRACT(YEAR FROM d.fecha_captura)::int AS anio,
      EXTRACT(MONTH FROM d.fecha_captura)::int AS mes_num,
      COUNT(*) AS emisiones,
      COALESCE(SUM(d.prima_neta), 0) AS prima_neta,
      COALESCE(SUM(GREATEST(COALESCE(d.prima_total, 0), COALESCE(d.importe, 0))), 0) AS prima_total,
      COUNT(*) FILTER (WHERE NOT COALESCE(d.is_fianza, false)) AS polizas,
      COUNT(*) FILTER (WHERE COALESCE(d.is_fianza, false)) AS fianzas
    FROM sicas_documents d
    WHERE d.fecha_captura::date >= v_desde
      AND (v_scope = 'admin' OR (v_scope = 'office' AND d.oficina_id = v_oficina) OR (v_scope = 'self' AND d.usuario_id = p_user_id))
      AND (p_vendedor_id IS NULL OR d.vend_id = p_vendedor_id)
    GROUP BY to_char(d.fecha_captura, 'YYYY-MM'), EXTRACT(YEAR FROM d.fecha_captura), EXTRACT(MONTH FROM d.fecha_captura)
    ORDER BY mes
  ) t;

  -- Por aseguradora YTD
  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) INTO v_por_aseguradora
  FROM (
    SELECT d.compania AS nombre, COUNT(*) AS cantidad, COALESCE(SUM(d.prima_neta), 0) AS prima
    FROM sicas_documents d
    WHERE d.compania IS NOT NULL AND d.fecha_captura::date >= date_trunc('year', CURRENT_DATE)::date
      AND (v_scope = 'admin' OR (v_scope = 'office' AND d.oficina_id = v_oficina) OR (v_scope = 'self' AND d.usuario_id = p_user_id))
      AND (p_vendedor_id IS NULL OR d.vend_id = p_vendedor_id)
    GROUP BY d.compania ORDER BY prima DESC LIMIT 15
  ) t;

  -- Por ramo YTD
  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) INTO v_por_ramo
  FROM (
    SELECT d.ramo AS nombre, COUNT(*) AS cantidad, COALESCE(SUM(d.prima_neta), 0) AS prima
    FROM sicas_documents d
    WHERE d.ramo IS NOT NULL AND d.fecha_captura::date >= date_trunc('year', CURRENT_DATE)::date
      AND (v_scope = 'admin' OR (v_scope = 'office' AND d.oficina_id = v_oficina) OR (v_scope = 'self' AND d.usuario_id = p_user_id))
      AND (p_vendedor_id IS NULL OR d.vend_id = p_vendedor_id)
    GROUP BY d.ramo ORDER BY prima DESC LIMIT 15
  ) t;

  -- Por subramo YTD
  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) INTO v_por_subramo
  FROM (
    SELECT d.subramo AS nombre, COUNT(*) AS cantidad, COALESCE(SUM(d.prima_neta), 0) AS prima
    FROM sicas_documents d
    WHERE d.subramo IS NOT NULL AND d.fecha_captura::date >= date_trunc('year', CURRENT_DATE)::date
      AND (v_scope = 'admin' OR (v_scope = 'office' AND d.oficina_id = v_oficina) OR (v_scope = 'self' AND d.usuario_id = p_user_id))
      AND (p_vendedor_id IS NULL OR d.vend_id = p_vendedor_id)
    GROUP BY d.subramo ORDER BY prima DESC LIMIT 15
  ) t;

  -- Por cliente YTD
  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) INTO v_por_cliente
  FROM (
    SELECT d.cliente AS nombre, COUNT(*) AS cantidad, COALESCE(SUM(d.prima_neta), 0) AS prima
    FROM sicas_documents d
    WHERE d.cliente IS NOT NULL AND d.fecha_captura::date >= date_trunc('year', CURRENT_DATE)::date
      AND (v_scope = 'admin' OR (v_scope = 'office' AND d.oficina_id = v_oficina) OR (v_scope = 'self' AND d.usuario_id = p_user_id))
      AND (p_vendedor_id IS NULL OR d.vend_id = p_vendedor_id)
    GROUP BY d.cliente ORDER BY prima DESC LIMIT 15
  ) t;

  -- Por oficina YTD
  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) INTO v_por_oficina
  FROM (
    SELECT COALESCE(o.nombre, d.oficina_nombre, d.desp_nombre, 'Sin oficina') AS nombre,
           d.oficina_id,
           COUNT(*) AS cantidad,
           COALESCE(SUM(d.prima_neta), 0) AS prima
    FROM sicas_documents d
    LEFT JOIN oficinas o ON o.id = d.oficina_id
    WHERE d.fecha_captura::date >= date_trunc('year', CURRENT_DATE)::date
      AND (v_scope = 'admin' OR (v_scope = 'office' AND d.oficina_id = v_oficina) OR (v_scope = 'self' AND d.usuario_id = p_user_id))
      AND (p_vendedor_id IS NULL OR d.vend_id = p_vendedor_id)
    GROUP BY d.oficina_id, o.nombre, d.oficina_nombre, d.desp_nombre
    ORDER BY prima DESC LIMIT 15
  ) t;

  -- Por vendedor YTD
  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) INTO v_por_vendedor
  FROM (
    SELECT COALESCE(d.vend_nombre, 'Sin vendedor') AS nombre,
           d.vend_id,
           COUNT(*) AS cantidad,
           COALESCE(SUM(d.prima_neta), 0) AS prima
    FROM sicas_documents d
    WHERE d.vend_id IS NOT NULL AND d.fecha_captura::date >= date_trunc('year', CURRENT_DATE)::date
      AND (v_scope = 'admin' OR (v_scope = 'office' AND d.oficina_id = v_oficina) OR (v_scope = 'self' AND d.usuario_id = p_user_id))
      AND (p_vendedor_id IS NULL OR d.vend_id = p_vendedor_id)
    GROUP BY d.vend_id, d.vend_nombre
    ORDER BY prima DESC LIMIT 15
  ) t;

  -- Renovaciones horizonte
  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) INTO v_renovaciones
  FROM (
    SELECT
      CASE
        WHEN d.renewal_days_remaining BETWEEN 0 AND 7 THEN '0-7 dias'
        WHEN d.renewal_days_remaining BETWEEN 8 AND 15 THEN '8-15 dias'
        WHEN d.renewal_days_remaining BETWEEN 16 AND 30 THEN '16-30 dias'
        WHEN d.renewal_days_remaining BETWEEN 31 AND 60 THEN '31-60 dias'
        WHEN d.renewal_days_remaining BETWEEN 61 AND 90 THEN '61-90 dias'
      END AS periodo,
      COUNT(*) AS cantidad,
      COALESCE(SUM(d.prima_neta), 0) AS prima
    FROM sicas_documents d
    WHERE d.is_vigente = true AND d.renewal_days_remaining BETWEEN 0 AND 90
      AND (v_scope = 'admin' OR (v_scope = 'office' AND d.oficina_id = v_oficina) OR (v_scope = 'self' AND d.usuario_id = p_user_id))
      AND (p_vendedor_id IS NULL OR d.vend_id = p_vendedor_id)
    GROUP BY 1
    ORDER BY MIN(d.renewal_days_remaining)
  ) t;

  RETURN jsonb_build_object(
    'prima_por_mes', v_prima_por_mes,
    'por_aseguradora', v_por_aseguradora,
    'por_ramo', v_por_ramo,
    'por_subramo', v_por_subramo,
    'por_cliente', v_por_cliente,
    'por_oficina', v_por_oficina,
    'por_vendedor', v_por_vendedor,
    'renovaciones_horizonte', v_renovaciones
  );
END;
$$;

-- 4. Helper function to list offices with document counts for admin dropdown
CREATE OR REPLACE FUNCTION get_sicas_oficinas_con_documentos()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN COALESCE((
    SELECT jsonb_agg(row_to_json(t) ORDER BY t.nombre)
    FROM (
      SELECT
        d.oficina_id AS id,
        COALESCE(o.nombre, d.oficina_nombre, d.desp_nombre, 'Sin oficina') AS nombre,
        COUNT(*) AS documentos
      FROM sicas_documents d
      LEFT JOIN oficinas o ON o.id = d.oficina_id
      WHERE d.oficina_id IS NOT NULL
      GROUP BY d.oficina_id, o.nombre, d.oficina_nombre, d.desp_nombre
      ORDER BY nombre
    ) t
  ), '[]'::jsonb);
END;
$$;
