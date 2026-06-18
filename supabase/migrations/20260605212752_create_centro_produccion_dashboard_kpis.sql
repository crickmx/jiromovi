/*
  # Centro de Produccion Dashboard KPIs

  Creates get_cp_dashboard_kpis which returns production metrics by role:
  - YTD production with meta (+20%) and progress
  - Monthly production with growth
  - Cobranza pendiente (30 days)
  - Renewals 30/60/90
  - Commissions this month
  - Top 3 ramos
*/

CREATE OR REPLACE FUNCTION public.get_cp_dashboard_kpis(
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
  current_year int := EXTRACT(year FROM NOW())::int;
  prev_year int := current_year - 1;
  current_doy int := EXTRACT(doy FROM NOW())::int;
  v_month_start date := date_trunc('month', CURRENT_DATE)::date;
  v_prev_month_start date := (date_trunc('month', CURRENT_DATE) - interval '1 month')::date;
  v_prev_month_end date := (v_month_start - interval '1 day')::date;
  v_ytd_prima numeric := 0;
  v_ytd_polizas int := 0;
  v_prev_ytd_prima numeric := 0;
  v_meta_prima numeric := 0;
  v_avance_meta_pct numeric := 0;
  v_month_prima numeric := 0;
  v_prev_month_prima numeric := 0;
  v_month_growth numeric := 0;
  v_month_polizas int := 0;
  v_cobranza_count int := 0;
  v_cobranza_prima numeric := 0;
  v_renov_30 int := 0;
  v_renov_60 int := 0;
  v_renov_90 int := 0;
  v_comisiones_mes numeric := 0;
  v_top_ramos jsonb := '[]'::jsonb;
  is_admin boolean := p_rol = 'Administrador';
  is_gerente boolean := p_rol = 'Gerente';
BEGIN
  IF is_admin OR is_gerente THEN
    SELECT COALESCE(SUM(prima_neta), 0), COUNT(*)
    INTO v_ytd_prima, v_ytd_polizas
    FROM sicas_documents
    WHERE fecha_captura >= make_date(current_year, 1, 1)
      AND fecha_captura < NOW()
      AND (is_admin OR oficina_id = p_oficina_id);

    SELECT COALESCE(SUM(prima_neta), 0) INTO v_prev_ytd_prima
    FROM sicas_documents
    WHERE fecha_captura >= make_date(prev_year, 1, 1)
      AND fecha_captura < (make_date(prev_year, 1, 1) + (current_doy || ' days')::interval)
      AND (is_admin OR oficina_id = p_oficina_id);
  ELSE
    SELECT COALESCE(SUM(sd.prima_neta), 0), COUNT(*)
    INTO v_ytd_prima, v_ytd_polizas
    FROM sicas_documents sd
    JOIN sicas_mapeo_usuario_vendedor m ON m.vendedor_clave = sd.vendedor_clave AND m.usuario_id = p_user_id
    WHERE sd.fecha_captura >= make_date(current_year, 1, 1) AND sd.fecha_captura < NOW();

    SELECT COALESCE(SUM(sd.prima_neta), 0) INTO v_prev_ytd_prima
    FROM sicas_documents sd
    JOIN sicas_mapeo_usuario_vendedor m ON m.vendedor_clave = sd.vendedor_clave AND m.usuario_id = p_user_id
    WHERE sd.fecha_captura >= make_date(prev_year, 1, 1)
      AND sd.fecha_captura < (make_date(prev_year, 1, 1) + (current_doy || ' days')::interval);
  END IF;

  v_meta_prima := v_prev_ytd_prima * 1.20;
  IF v_meta_prima > 0 THEN
    v_avance_meta_pct := ROUND((v_ytd_prima / v_meta_prima) * 100, 1);
  END IF;

  IF is_admin OR is_gerente THEN
    SELECT COALESCE(SUM(prima_neta), 0), COUNT(*)
    INTO v_month_prima, v_month_polizas
    FROM sicas_documents
    WHERE fecha_emision >= v_month_start AND (is_admin OR oficina_id = p_oficina_id);

    SELECT COALESCE(SUM(prima_neta), 0) INTO v_prev_month_prima
    FROM sicas_documents
    WHERE fecha_emision >= v_prev_month_start AND fecha_emision <= v_prev_month_end
      AND (is_admin OR oficina_id = p_oficina_id);
  ELSE
    SELECT COALESCE(SUM(sd.prima_neta), 0), COUNT(*)
    INTO v_month_prima, v_month_polizas
    FROM sicas_documents sd
    JOIN sicas_mapeo_usuario_vendedor m ON m.vendedor_clave = sd.vendedor_clave AND m.usuario_id = p_user_id
    WHERE sd.fecha_emision >= v_month_start;

    SELECT COALESCE(SUM(sd.prima_neta), 0) INTO v_prev_month_prima
    FROM sicas_documents sd
    JOIN sicas_mapeo_usuario_vendedor m ON m.vendedor_clave = sd.vendedor_clave AND m.usuario_id = p_user_id
    WHERE sd.fecha_emision >= v_prev_month_start AND sd.fecha_emision <= v_prev_month_end;
  END IF;

  IF v_prev_month_prima > 0 THEN
    v_month_growth := ROUND(((v_month_prima - v_prev_month_prima) / v_prev_month_prima) * 100, 1);
  ELSIF v_month_prima > 0 THEN
    v_month_growth := 100;
  END IF;

  IF is_admin OR is_gerente THEN
    SELECT COUNT(*), COALESCE(SUM(prima_neta), 0)
    INTO v_cobranza_count, v_cobranza_prima
    FROM sicas_documents
    WHERE vigencia_hasta >= CURRENT_DATE AND vigencia_hasta <= (CURRENT_DATE + interval '30 days')
      AND estatus_cobro IS DISTINCT FROM 'Pagado'
      AND (is_admin OR oficina_id = p_oficina_id);
  ELSE
    SELECT COUNT(*), COALESCE(SUM(sd.prima_neta), 0)
    INTO v_cobranza_count, v_cobranza_prima
    FROM sicas_documents sd
    JOIN sicas_mapeo_usuario_vendedor m ON m.vendedor_clave = sd.vendedor_clave AND m.usuario_id = p_user_id
    WHERE sd.vigencia_hasta >= CURRENT_DATE AND sd.vigencia_hasta <= (CURRENT_DATE + interval '30 days')
      AND sd.estatus_cobro IS DISTINCT FROM 'Pagado';
  END IF;

  IF is_admin OR is_gerente THEN
    SELECT
      COUNT(*) FILTER (WHERE vigencia_hasta <= CURRENT_DATE + interval '30 days'),
      COUNT(*) FILTER (WHERE vigencia_hasta > CURRENT_DATE + interval '30 days' AND vigencia_hasta <= CURRENT_DATE + interval '60 days'),
      COUNT(*) FILTER (WHERE vigencia_hasta > CURRENT_DATE + interval '60 days' AND vigencia_hasta <= CURRENT_DATE + interval '90 days')
    INTO v_renov_30, v_renov_60, v_renov_90
    FROM sicas_documents
    WHERE vigencia_hasta >= CURRENT_DATE AND vigencia_hasta <= (CURRENT_DATE + interval '90 days')
      AND (is_admin OR oficina_id = p_oficina_id);
  ELSE
    SELECT
      COUNT(*) FILTER (WHERE sd.vigencia_hasta <= CURRENT_DATE + interval '30 days'),
      COUNT(*) FILTER (WHERE sd.vigencia_hasta > CURRENT_DATE + interval '30 days' AND sd.vigencia_hasta <= CURRENT_DATE + interval '60 days'),
      COUNT(*) FILTER (WHERE sd.vigencia_hasta > CURRENT_DATE + interval '60 days' AND sd.vigencia_hasta <= CURRENT_DATE + interval '90 days')
    INTO v_renov_30, v_renov_60, v_renov_90
    FROM sicas_documents sd
    JOIN sicas_mapeo_usuario_vendedor m ON m.vendedor_clave = sd.vendedor_clave AND m.usuario_id = p_user_id
    WHERE sd.vigencia_hasta >= CURRENT_DATE AND sd.vigencia_hasta <= (CURRENT_DATE + interval '90 days');
  END IF;

  SELECT COALESCE(SUM(comision_neta), 0) INTO v_comisiones_mes
  FROM commission_details WHERE usuario_id = p_user_id AND created_at >= v_month_start;

  IF is_admin OR is_gerente THEN
    SELECT COALESCE(jsonb_agg(r), '[]'::jsonb) INTO v_top_ramos
    FROM (
      SELECT ramo AS nombre, COUNT(*) AS polizas, ROUND(SUM(prima_neta), 0) AS prima
      FROM sicas_documents
      WHERE fecha_captura >= make_date(current_year, 1, 1) AND ramo IS NOT NULL AND ramo != ''
        AND (is_admin OR oficina_id = p_oficina_id)
      GROUP BY ramo ORDER BY SUM(prima_neta) DESC LIMIT 3
    ) r;
  ELSE
    SELECT COALESCE(jsonb_agg(r), '[]'::jsonb) INTO v_top_ramos
    FROM (
      SELECT sd.ramo AS nombre, COUNT(*) AS polizas, ROUND(SUM(sd.prima_neta), 0) AS prima
      FROM sicas_documents sd
      JOIN sicas_mapeo_usuario_vendedor m ON m.vendedor_clave = sd.vendedor_clave AND m.usuario_id = p_user_id
      WHERE sd.fecha_captura >= make_date(current_year, 1, 1) AND sd.ramo IS NOT NULL AND sd.ramo != ''
      GROUP BY sd.ramo ORDER BY SUM(sd.prima_neta) DESC LIMIT 3
    ) r;
  END IF;

  result := jsonb_build_object(
    'ytd_prima', ROUND(v_ytd_prima, 0),
    'ytd_polizas', v_ytd_polizas,
    'meta_prima', ROUND(v_meta_prima, 0),
    'avance_meta_pct', v_avance_meta_pct,
    'month_prima', ROUND(v_month_prima, 0),
    'month_polizas', v_month_polizas,
    'month_growth', v_month_growth,
    'prev_month_prima', ROUND(v_prev_month_prima, 0),
    'cobranza_count', v_cobranza_count,
    'cobranza_prima', ROUND(v_cobranza_prima, 0),
    'renov_30', v_renov_30,
    'renov_60', v_renov_60,
    'renov_90', v_renov_90,
    'comisiones_mes', ROUND(v_comisiones_mes, 0),
    'top_ramos', v_top_ramos,
    'current_year', current_year
  );

  RETURN result;
END;
$$;
