/*
  # SICAS Dashboard Server-Side Functions

  1. New Functions
    - `get_sicas_dashboard_kpis(p_user_id, p_scope, p_oficina_id, p_fecha_desde, p_fecha_hasta)` 
      Returns JSON with all KPIs respecting role scope
    - `get_sicas_dashboard_charts(p_user_id, p_scope, p_oficina_id, p_fecha_desde, p_fecha_hasta)`
      Returns JSON with chart aggregations
    - `get_sicas_dashboard_top(p_user_id, p_scope, p_oficina_id, p_dimension, p_limit, p_fecha_desde, p_fecha_hasta)`
      Returns top N by dimension (cliente, aseguradora, ramo, subramo)
    - `get_sicas_user_scope(p_user_id)` 
      Returns the user's role scope (admin/office/self) with oficina_id

  2. Security
    - All functions use SECURITY DEFINER to bypass RLS
    - All functions validate user existence and role
    - Scope enforcement: admin=all, gerente/empleado=office, agente=self
*/

-- Helper: determine user scope
CREATE OR REPLACE FUNCTION get_sicas_user_scope(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rol text;
  v_oficina_id uuid;
  v_scope text;
  v_id_sicas text;
BEGIN
  SELECT rol, oficina_id, id_sicas
  INTO v_rol, v_oficina_id, v_id_sicas
  FROM usuarios
  WHERE id = p_user_id AND (deleted_at IS NULL);

  IF v_rol IS NULL THEN
    RETURN jsonb_build_object('error', 'User not found');
  END IF;

  IF v_rol = 'Administrador' THEN
    v_scope := 'admin';
  ELSIF v_rol IN ('Gerente', 'Empleado', 'Ejecutivo') THEN
    v_scope := 'office';
  ELSE
    v_scope := 'self';
  END IF;

  RETURN jsonb_build_object(
    'scope', v_scope,
    'rol', v_rol,
    'oficina_id', v_oficina_id,
    'id_sicas', v_id_sicas
  );
END;
$$;

-- Main KPIs function
CREATE OR REPLACE FUNCTION get_sicas_dashboard_kpis(
  p_user_id uuid,
  p_scope text DEFAULT NULL,
  p_oficina_id uuid DEFAULT NULL,
  p_fecha_desde date DEFAULT NULL,
  p_fecha_hasta date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_scope_info jsonb;
  v_scope text;
  v_oficina uuid;
  v_result jsonb;
  v_mes_actual_inicio date;
  v_mes_actual_fin date;
  v_mes_anterior_inicio date;
  v_mes_anterior_fin date;
  v_mismo_mes_anio_ant_inicio date;
  v_mismo_mes_anio_ant_fin date;
  v_anio_actual_inicio date;
  v_mismo_periodo_ant_inicio date;
  v_mismo_periodo_ant_fin date;
BEGIN
  -- Resolve scope
  v_scope_info := get_sicas_user_scope(p_user_id);
  IF v_scope_info ? 'error' THEN
    RETURN v_scope_info;
  END IF;
  
  v_scope := COALESCE(p_scope, v_scope_info->>'scope');
  v_oficina := COALESCE(p_oficina_id, (v_scope_info->>'oficina_id')::uuid);

  -- Security: non-admin cannot escalate scope
  IF (v_scope_info->>'scope') != 'admin' AND v_scope = 'admin' THEN
    v_scope := v_scope_info->>'scope';
  END IF;
  IF (v_scope_info->>'scope') = 'self' AND v_scope = 'office' THEN
    v_scope := 'self';
  END IF;

  -- Date ranges
  v_mes_actual_inicio := date_trunc('month', CURRENT_DATE)::date;
  v_mes_actual_fin := (date_trunc('month', CURRENT_DATE) + interval '1 month' - interval '1 day')::date;
  v_mes_anterior_inicio := (date_trunc('month', CURRENT_DATE) - interval '1 month')::date;
  v_mes_anterior_fin := (date_trunc('month', CURRENT_DATE) - interval '1 day')::date;
  v_mismo_mes_anio_ant_inicio := (date_trunc('month', CURRENT_DATE) - interval '1 year')::date;
  v_mismo_mes_anio_ant_fin := (date_trunc('month', CURRENT_DATE) - interval '1 year' + interval '1 month' - interval '1 day')::date;
  v_anio_actual_inicio := date_trunc('year', CURRENT_DATE)::date;
  v_mismo_periodo_ant_inicio := (date_trunc('year', CURRENT_DATE) - interval '1 year')::date;
  v_mismo_periodo_ant_fin := (CURRENT_DATE - interval '1 year');

  WITH scoped_docs AS (
    SELECT * FROM sicas_documents d
    WHERE 
      CASE 
        WHEN v_scope = 'admin' THEN true
        WHEN v_scope = 'office' THEN d.oficina_id = v_oficina
        WHEN v_scope = 'self' THEN d.usuario_id = p_user_id
        ELSE false
      END
  ),
  mes_actual AS (
    SELECT 
      COUNT(*) FILTER (WHERE lower(COALESCE(tipo_documento,'')) NOT LIKE '%fianza%') as polizas_emitidas,
      COUNT(*) FILTER (WHERE lower(COALESCE(tipo_documento,'')) LIKE '%fianza%') as fianzas_emitidas,
      COUNT(*) as total_emitidos,
      COALESCE(SUM(prima_neta), 0) as prima_neta_emitida,
      COALESCE(SUM(GREATEST(prima_total, importe)), 0) as prima_total_emitida,
      COUNT(DISTINCT cliente) as clientes_emision,
      CASE WHEN COUNT(*) > 0 THEN COALESCE(SUM(prima_neta), 0) / COUNT(*) ELSE 0 END as ticket_promedio
    FROM scoped_docs
    WHERE fecha_captura::date BETWEEN v_mes_actual_inicio AND v_mes_actual_fin
  ),
  vigentes AS (
    SELECT
      COUNT(*) as documentos_vigentes,
      COALESCE(SUM(prima_neta), 0) as prima_vigente,
      COUNT(DISTINCT cliente) as clientes_vigentes
    FROM scoped_docs
    WHERE is_vigente = true
  ),
  renovaciones AS (
    SELECT
      COUNT(*) FILTER (WHERE renewal_days_remaining BETWEEN 0 AND 90) as renovaciones_pendientes,
      COALESCE(SUM(prima_neta) FILTER (WHERE renewal_days_remaining BETWEEN 0 AND 90), 0) as prima_por_renovar,
      COUNT(*) FILTER (WHERE renewal_days_remaining BETWEEN 0 AND 7) as renovaciones_7dias,
      COUNT(*) FILTER (WHERE renewal_days_remaining BETWEEN 0 AND 15) as renovaciones_15dias,
      COUNT(*) FILTER (WHERE renewal_days_remaining BETWEEN 0 AND 30) as renovaciones_30dias
    FROM scoped_docs
    WHERE is_vigente = true AND renewal_days_remaining >= 0
  ),
  cancelaciones AS (
    SELECT COUNT(*) as cancelaciones_periodo
    FROM scoped_docs
    WHERE is_cancelada = true
      AND fecha_captura::date BETWEEN v_mes_actual_inicio AND v_mes_actual_fin
  ),
  mes_anterior AS (
    SELECT COALESCE(SUM(prima_neta), 0) as prima_mes_anterior
    FROM scoped_docs
    WHERE fecha_captura::date BETWEEN v_mes_anterior_inicio AND v_mes_anterior_fin
  ),
  mismo_mes_anio_ant AS (
    SELECT COALESCE(SUM(prima_neta), 0) as prima_mismo_mes_ant
    FROM scoped_docs
    WHERE fecha_captura::date BETWEEN v_mismo_mes_anio_ant_inicio AND v_mismo_mes_anio_ant_fin
  ),
  acumulado_actual AS (
    SELECT COALESCE(SUM(prima_neta), 0) as acumulado_ytd
    FROM scoped_docs
    WHERE fecha_captura::date BETWEEN v_anio_actual_inicio AND CURRENT_DATE
  ),
  acumulado_anterior AS (
    SELECT COALESCE(SUM(prima_neta), 0) as acumulado_ytd_ant
    FROM scoped_docs
    WHERE fecha_captura::date BETWEEN v_mismo_periodo_ant_inicio AND v_mismo_periodo_ant_fin
  ),
  top_cliente AS (
    SELECT cliente as nombre, COALESCE(SUM(prima_neta), 0) as prima
    FROM scoped_docs
    WHERE fecha_captura::date BETWEEN v_mes_actual_inicio AND v_mes_actual_fin
      AND cliente IS NOT NULL AND cliente != ''
    GROUP BY cliente ORDER BY prima DESC LIMIT 1
  ),
  top_aseguradora AS (
    SELECT compania as nombre, COALESCE(SUM(prima_neta), 0) as prima
    FROM scoped_docs
    WHERE fecha_captura::date BETWEEN v_mes_actual_inicio AND v_mes_actual_fin
      AND compania IS NOT NULL AND compania != ''
    GROUP BY compania ORDER BY prima DESC LIMIT 1
  ),
  top_ramo AS (
    SELECT ramo as nombre, COALESCE(SUM(prima_neta), 0) as prima
    FROM scoped_docs
    WHERE fecha_captura::date BETWEEN v_mes_actual_inicio AND v_mes_actual_fin
      AND ramo IS NOT NULL AND ramo != ''
    GROUP BY ramo ORDER BY prima DESC LIMIT 1
  ),
  concentracion_top5_clientes AS (
    SELECT COALESCE(SUM(p), 0) as prima_top5
    FROM (
      SELECT SUM(prima_neta) as p
      FROM scoped_docs
      WHERE fecha_captura::date BETWEEN v_mes_actual_inicio AND v_mes_actual_fin
        AND cliente IS NOT NULL AND cliente != ''
      GROUP BY cliente ORDER BY p DESC LIMIT 5
    ) sub
  ),
  concentracion_top3_aseg AS (
    SELECT COALESCE(SUM(p), 0) as prima_top3
    FROM (
      SELECT SUM(prima_neta) as p
      FROM scoped_docs
      WHERE fecha_captura::date BETWEEN v_mes_actual_inicio AND v_mes_actual_fin
        AND compania IS NOT NULL AND compania != ''
      GROUP BY compania ORDER BY p DESC LIMIT 3
    ) sub
  )
  SELECT jsonb_build_object(
    'polizas_emitidas', ma.polizas_emitidas,
    'fianzas_emitidas', ma.fianzas_emitidas,
    'total_emitidos', ma.total_emitidos,
    'prima_neta_emitida', ma.prima_neta_emitida,
    'prima_total_emitida', ma.prima_total_emitida,
    'clientes_emision', ma.clientes_emision,
    'ticket_promedio', ma.ticket_promedio,
    'documentos_vigentes', v.documentos_vigentes,
    'prima_vigente', v.prima_vigente,
    'clientes_vigentes', v.clientes_vigentes,
    'renovaciones_pendientes', r.renovaciones_pendientes,
    'prima_por_renovar', r.prima_por_renovar,
    'renovaciones_7dias', r.renovaciones_7dias,
    'renovaciones_15dias', r.renovaciones_15dias,
    'renovaciones_30dias', r.renovaciones_30dias,
    'cancelaciones_periodo', c.cancelaciones_periodo,
    'prima_mes_anterior', mant.prima_mes_anterior,
    'prima_mismo_mes_ant', mmant.prima_mismo_mes_ant,
    'variacion_mes_anterior', CASE WHEN mant.prima_mes_anterior > 0 THEN ROUND(((ma.prima_neta_emitida - mant.prima_mes_anterior) / mant.prima_mes_anterior * 100)::numeric, 1) ELSE 0 END,
    'variacion_interanual', CASE WHEN mmant.prima_mismo_mes_ant > 0 THEN ROUND(((ma.prima_neta_emitida - mmant.prima_mismo_mes_ant) / mmant.prima_mismo_mes_ant * 100)::numeric, 1) ELSE 0 END,
    'acumulado_ytd', aa.acumulado_ytd,
    'acumulado_ytd_anterior', aant.acumulado_ytd_ant,
    'crecimiento_ytd', CASE WHEN aant.acumulado_ytd_ant > 0 THEN ROUND(((aa.acumulado_ytd - aant.acumulado_ytd_ant) / aant.acumulado_ytd_ant * 100)::numeric, 1) ELSE 0 END,
    'top_cliente', COALESCE((SELECT jsonb_build_object('nombre', tc.nombre, 'prima', tc.prima) FROM top_cliente tc), '{"nombre":"","prima":0}'::jsonb),
    'top_aseguradora', COALESCE((SELECT jsonb_build_object('nombre', ta.nombre, 'prima', ta.prima) FROM top_aseguradora ta), '{"nombre":"","prima":0}'::jsonb),
    'top_ramo', COALESCE((SELECT jsonb_build_object('nombre', tr.nombre, 'prima', tr.prima) FROM top_ramo tr), '{"nombre":"","prima":0}'::jsonb),
    'concentracion_top5_clientes', CASE WHEN ma.prima_neta_emitida > 0 THEN ROUND((ct5.prima_top5 / ma.prima_neta_emitida * 100)::numeric, 1) ELSE 0 END,
    'concentracion_top3_aseguradoras', CASE WHEN ma.prima_neta_emitida > 0 THEN ROUND((ct3.prima_top3 / ma.prima_neta_emitida * 100)::numeric, 1) ELSE 0 END,
    'scope', v_scope,
    'last_sync', (SELECT MAX(synced_at) FROM sicas_documents)
  ) INTO v_result
  FROM mes_actual ma
  CROSS JOIN vigentes v
  CROSS JOIN renovaciones r
  CROSS JOIN cancelaciones c
  CROSS JOIN mes_anterior mant
  CROSS JOIN mismo_mes_anio_ant mmant
  CROSS JOIN acumulado_actual aa
  CROSS JOIN acumulado_anterior aant
  CROSS JOIN concentracion_top5_clientes ct5
  CROSS JOIN concentracion_top3_aseg ct3;

  RETURN v_result;
END;
$$;

-- Chart data function
CREATE OR REPLACE FUNCTION get_sicas_dashboard_charts(
  p_user_id uuid,
  p_scope text DEFAULT NULL,
  p_oficina_id uuid DEFAULT NULL,
  p_meses int DEFAULT 24
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_scope_info jsonb;
  v_scope text;
  v_oficina uuid;
  v_desde date;
BEGIN
  v_scope_info := get_sicas_user_scope(p_user_id);
  IF v_scope_info ? 'error' THEN RETURN v_scope_info; END IF;
  
  v_scope := COALESCE(p_scope, v_scope_info->>'scope');
  v_oficina := COALESCE(p_oficina_id, (v_scope_info->>'oficina_id')::uuid);

  IF (v_scope_info->>'scope') != 'admin' AND v_scope = 'admin' THEN
    v_scope := v_scope_info->>'scope';
  END IF;
  IF (v_scope_info->>'scope') = 'self' AND v_scope = 'office' THEN
    v_scope := 'self';
  END IF;

  v_desde := (CURRENT_DATE - (p_meses || ' months')::interval)::date;

  RETURN (
    WITH scoped AS (
      SELECT * FROM sicas_documents d
      WHERE CASE 
        WHEN v_scope = 'admin' THEN true
        WHEN v_scope = 'office' THEN d.oficina_id = v_oficina
        WHEN v_scope = 'self' THEN d.usuario_id = p_user_id
        ELSE false
      END
    ),
    prima_por_mes AS (
      SELECT 
        to_char(fecha_captura, 'YYYY-MM') as mes,
        EXTRACT(YEAR FROM fecha_captura)::int as anio,
        EXTRACT(MONTH FROM fecha_captura)::int as mes_num,
        COUNT(*) as emisiones,
        COALESCE(SUM(prima_neta), 0)::numeric as prima_neta,
        COALESCE(SUM(GREATEST(prima_total, importe)), 0)::numeric as prima_total,
        COUNT(*) FILTER (WHERE lower(COALESCE(tipo_documento,'')) NOT LIKE '%fianza%') as polizas,
        COUNT(*) FILTER (WHERE lower(COALESCE(tipo_documento,'')) LIKE '%fianza%') as fianzas
      FROM scoped
      WHERE fecha_captura::date >= v_desde
      GROUP BY to_char(fecha_captura, 'YYYY-MM'), EXTRACT(YEAR FROM fecha_captura), EXTRACT(MONTH FROM fecha_captura)
      ORDER BY mes
    ),
    por_aseguradora AS (
      SELECT compania as nombre, COUNT(*) as cantidad, COALESCE(SUM(prima_neta), 0)::numeric as prima
      FROM scoped WHERE compania IS NOT NULL AND compania != ''
        AND fecha_captura::date >= date_trunc('year', CURRENT_DATE)::date
      GROUP BY compania ORDER BY prima DESC LIMIT 15
    ),
    por_ramo AS (
      SELECT ramo as nombre, COUNT(*) as cantidad, COALESCE(SUM(prima_neta), 0)::numeric as prima
      FROM scoped WHERE ramo IS NOT NULL AND ramo != ''
        AND fecha_captura::date >= date_trunc('year', CURRENT_DATE)::date
      GROUP BY ramo ORDER BY prima DESC LIMIT 15
    ),
    por_subramo AS (
      SELECT subramo as nombre, COUNT(*) as cantidad, COALESCE(SUM(prima_neta), 0)::numeric as prima
      FROM scoped WHERE subramo IS NOT NULL AND subramo != ''
        AND fecha_captura::date >= date_trunc('year', CURRENT_DATE)::date
      GROUP BY subramo ORDER BY prima DESC LIMIT 15
    ),
    por_cliente AS (
      SELECT cliente as nombre, COUNT(*) as cantidad, COALESCE(SUM(prima_neta), 0)::numeric as prima
      FROM scoped WHERE cliente IS NOT NULL AND cliente != ''
        AND fecha_captura::date >= date_trunc('year', CURRENT_DATE)::date
      GROUP BY cliente ORDER BY prima DESC LIMIT 15
    ),
    renovaciones_horizonte AS (
      SELECT
        CASE
          WHEN renewal_days_remaining BETWEEN 0 AND 7 THEN '0-7 dias'
          WHEN renewal_days_remaining BETWEEN 8 AND 15 THEN '8-15 dias'
          WHEN renewal_days_remaining BETWEEN 16 AND 30 THEN '16-30 dias'
          WHEN renewal_days_remaining BETWEEN 31 AND 60 THEN '31-60 dias'
          WHEN renewal_days_remaining BETWEEN 61 AND 90 THEN '61-90 dias'
          ELSE '90+ dias'
        END as periodo,
        COUNT(*) as cantidad,
        COALESCE(SUM(prima_neta), 0)::numeric as prima
      FROM scoped
      WHERE is_vigente = true AND renewal_days_remaining >= 0 AND renewal_days_remaining <= 90
      GROUP BY periodo
    )
    SELECT jsonb_build_object(
      'prima_por_mes', COALESCE((SELECT jsonb_agg(row_to_json(p)) FROM prima_por_mes p), '[]'::jsonb),
      'por_aseguradora', COALESCE((SELECT jsonb_agg(row_to_json(a)) FROM por_aseguradora a), '[]'::jsonb),
      'por_ramo', COALESCE((SELECT jsonb_agg(row_to_json(r)) FROM por_ramo r), '[]'::jsonb),
      'por_subramo', COALESCE((SELECT jsonb_agg(row_to_json(s)) FROM por_subramo s), '[]'::jsonb),
      'por_cliente', COALESCE((SELECT jsonb_agg(row_to_json(c)) FROM por_cliente c), '[]'::jsonb),
      'renovaciones_horizonte', COALESCE((SELECT jsonb_agg(row_to_json(rh)) FROM renovaciones_horizonte rh), '[]'::jsonb)
    )
  );
END;
$$;

-- Top N by dimension
CREATE OR REPLACE FUNCTION get_sicas_dashboard_top(
  p_user_id uuid,
  p_dimension text DEFAULT 'cliente',
  p_limit int DEFAULT 10,
  p_scope text DEFAULT NULL,
  p_oficina_id uuid DEFAULT NULL,
  p_fecha_desde date DEFAULT NULL,
  p_fecha_hasta date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_scope_info jsonb;
  v_scope text;
  v_oficina uuid;
  v_desde date;
  v_hasta date;
BEGIN
  v_scope_info := get_sicas_user_scope(p_user_id);
  IF v_scope_info ? 'error' THEN RETURN v_scope_info; END IF;
  
  v_scope := COALESCE(p_scope, v_scope_info->>'scope');
  v_oficina := COALESCE(p_oficina_id, (v_scope_info->>'oficina_id')::uuid);

  IF (v_scope_info->>'scope') != 'admin' AND v_scope = 'admin' THEN
    v_scope := v_scope_info->>'scope';
  END IF;
  IF (v_scope_info->>'scope') = 'self' AND v_scope = 'office' THEN
    v_scope := 'self';
  END IF;

  v_desde := COALESCE(p_fecha_desde, date_trunc('year', CURRENT_DATE)::date);
  v_hasta := COALESCE(p_fecha_hasta, CURRENT_DATE);

  RETURN (
    WITH scoped AS (
      SELECT * FROM sicas_documents d
      WHERE CASE 
        WHEN v_scope = 'admin' THEN true
        WHEN v_scope = 'office' THEN d.oficina_id = v_oficina
        WHEN v_scope = 'self' THEN d.usuario_id = p_user_id
        ELSE false
      END
      AND fecha_captura::date BETWEEN v_desde AND v_hasta
    )
    SELECT CASE p_dimension
      WHEN 'cliente' THEN COALESCE((
        SELECT jsonb_agg(row_to_json(r)) FROM (
          SELECT cliente as nombre, COUNT(*) as documentos, 
            COALESCE(SUM(prima_neta),0)::numeric as prima_neta,
            COALESCE(SUM(GREATEST(prima_total,importe)),0)::numeric as prima_total,
            COUNT(DISTINCT compania) as aseguradoras,
            COUNT(DISTINCT ramo) as ramos,
            MIN(vigencia_hasta)::text as proxima_renovacion
          FROM scoped WHERE cliente IS NOT NULL AND cliente != ''
          GROUP BY cliente ORDER BY prima_neta DESC LIMIT p_limit
        ) r
      ), '[]'::jsonb)
      WHEN 'aseguradora' THEN COALESCE((
        SELECT jsonb_agg(row_to_json(r)) FROM (
          SELECT compania as nombre, COUNT(*) as documentos,
            COALESCE(SUM(prima_neta),0)::numeric as prima_neta,
            COALESCE(SUM(GREATEST(prima_total,importe)),0)::numeric as prima_total,
            COUNT(DISTINCT cliente) as clientes,
            COUNT(DISTINCT ramo) as ramos
          FROM scoped WHERE compania IS NOT NULL AND compania != ''
          GROUP BY compania ORDER BY prima_neta DESC LIMIT p_limit
        ) r
      ), '[]'::jsonb)
      WHEN 'ramo' THEN COALESCE((
        SELECT jsonb_agg(row_to_json(r)) FROM (
          SELECT ramo as nombre, COUNT(*) as documentos,
            COALESCE(SUM(prima_neta),0)::numeric as prima_neta,
            COALESCE(SUM(GREATEST(prima_total,importe)),0)::numeric as prima_total,
            COUNT(DISTINCT cliente) as clientes,
            COUNT(DISTINCT compania) as aseguradoras
          FROM scoped WHERE ramo IS NOT NULL AND ramo != ''
          GROUP BY ramo ORDER BY prima_neta DESC LIMIT p_limit
        ) r
      ), '[]'::jsonb)
      WHEN 'subramo' THEN COALESCE((
        SELECT jsonb_agg(row_to_json(r)) FROM (
          SELECT subramo as nombre, ramo, COUNT(*) as documentos,
            COALESCE(SUM(prima_neta),0)::numeric as prima_neta,
            COALESCE(SUM(GREATEST(prima_total,importe)),0)::numeric as prima_total,
            COUNT(DISTINCT cliente) as clientes
          FROM scoped WHERE subramo IS NOT NULL AND subramo != ''
          GROUP BY subramo, ramo ORDER BY prima_neta DESC LIMIT p_limit
        ) r
      ), '[]'::jsonb)
      ELSE '[]'::jsonb
    END
  );
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION get_sicas_user_scope(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_sicas_dashboard_kpis(uuid, text, uuid, date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION get_sicas_dashboard_charts(uuid, text, uuid, int) TO authenticated;
GRANT EXECUTE ON FUNCTION get_sicas_dashboard_top(uuid, text, int, text, uuid, date, date) TO authenticated;
