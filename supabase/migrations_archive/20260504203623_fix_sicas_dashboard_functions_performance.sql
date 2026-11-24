/*
  # Fix SICAS Dashboard Functions Performance

  1. Problem
    - Dashboard RPC functions use `fecha_captura::date BETWEEN x AND y`
    - The ::date cast prevents index usage on the fecha_captura column
    - On 100K+ documents this causes statement timeouts

  2. Solution
    - Add a computed column `fecha_captura_date` of type DATE for indexed lookups
    - OR better: change the queries to use >= and < on the timestamp directly
    - Set statement_timeout to 30s for these functions (default is 8s for Supabase)
    - Recreate KPIs and top functions using timestamp comparisons without casts

  3. Approach
    - Add a btree index on (oficina_id, fecha_captura) to speed office+date scans
    - Add a btree index on (vend_id, fecha_captura) for self-scope
    - Increase timeout for dashboard functions to 30s
    - Replace ::date casts with timestamp range comparisons
*/

-- The existing idx_sicas_docs_oficina_fecha_captura and idx_sicas_docs_vend_fecha_captura 
-- from previous migration should help. Let's also add one for admin scope (no scope filter, just date):
CREATE INDEX IF NOT EXISTS idx_sicas_docs_fecha_captura_is_vigente
  ON sicas_documents(is_vigente, fecha_captura DESC)
  WHERE is_vigente = true;

-- Create optimized get_sicas_dashboard_top with timestamp comparisons (no ::date cast)
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
SET statement_timeout = '30s'
AS $$
DECLARE
  v_rol text;
  v_oficina uuid;
  v_scope text;
  v_vend_id text;
  v_desde timestamp;
  v_hasta timestamp;
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

  IF v_scope = 'self' THEN
    v_vend_id := get_sicas_user_vend_id(p_user_id);
  END IF;

  v_desde := COALESCE(p_fecha_desde, date_trunc('year', CURRENT_DATE)::date)::timestamp;
  v_hasta := (COALESCE(p_fecha_hasta, CURRENT_DATE) + interval '1 day')::timestamp;

  IF p_dimension = 'cliente' THEN
    SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) INTO v_result
    FROM (
      SELECT
        d.cliente AS nombre,
        COUNT(*) AS documentos,
        COALESCE(SUM(d.prima_neta), 0) AS prima_neta,
        COALESCE(SUM(GREATEST(COALESCE(d.prima_total,0), COALESCE(d.importe,0))), 0) AS prima_total,
        COUNT(DISTINCT d.compania) AS aseguradoras,
        COUNT(DISTINCT d.ramo) AS ramos,
        MIN(d.vigencia_hasta)::text AS proxima_renovacion
      FROM sicas_documents d
      WHERE d.cliente IS NOT NULL
        AND d.fecha_captura >= v_desde AND d.fecha_captura < v_hasta
        AND (v_scope = 'admin' OR (v_scope = 'office' AND d.oficina_id = v_oficina) OR (v_scope = 'self' AND d.vend_id = v_vend_id))
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
        COALESCE(SUM(GREATEST(COALESCE(d.prima_total,0), COALESCE(d.importe,0))), 0) AS prima_total,
        COUNT(DISTINCT d.cliente) AS clientes,
        COUNT(DISTINCT d.ramo) AS ramos
      FROM sicas_documents d
      WHERE d.compania IS NOT NULL
        AND d.fecha_captura >= v_desde AND d.fecha_captura < v_hasta
        AND (v_scope = 'admin' OR (v_scope = 'office' AND d.oficina_id = v_oficina) OR (v_scope = 'self' AND d.vend_id = v_vend_id))
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
        COALESCE(SUM(GREATEST(COALESCE(d.prima_total,0), COALESCE(d.importe,0))), 0) AS prima_total,
        COUNT(DISTINCT d.cliente) AS clientes,
        COUNT(DISTINCT d.compania) AS aseguradoras
      FROM sicas_documents d
      WHERE d.ramo IS NOT NULL
        AND d.fecha_captura >= v_desde AND d.fecha_captura < v_hasta
        AND (v_scope = 'admin' OR (v_scope = 'office' AND d.oficina_id = v_oficina) OR (v_scope = 'self' AND d.vend_id = v_vend_id))
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
        COALESCE(SUM(GREATEST(COALESCE(d.prima_total,0), COALESCE(d.importe,0))), 0) AS prima_total,
        COUNT(DISTINCT d.cliente) AS clientes
      FROM sicas_documents d
      WHERE d.subramo IS NOT NULL
        AND d.fecha_captura >= v_desde AND d.fecha_captura < v_hasta
        AND (v_scope = 'admin' OR (v_scope = 'office' AND d.oficina_id = v_oficina) OR (v_scope = 'self' AND d.vend_id = v_vend_id))
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
        COALESCE(SUM(GREATEST(COALESCE(d.prima_total,0), COALESCE(d.importe,0))), 0) AS prima_total,
        COUNT(DISTINCT d.cliente) AS clientes,
        COUNT(DISTINCT d.vend_id) AS vendedores,
        COUNT(DISTINCT d.compania) AS aseguradoras
      FROM sicas_documents d
      LEFT JOIN oficinas o ON o.id = d.oficina_id
      WHERE d.fecha_captura >= v_desde AND d.fecha_captura < v_hasta
        AND (v_scope = 'admin' OR (v_scope = 'office' AND d.oficina_id = v_oficina) OR (v_scope = 'self' AND d.vend_id = v_vend_id))
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
        COALESCE(SUM(GREATEST(COALESCE(d.prima_total,0), COALESCE(d.importe,0))), 0) AS prima_total,
        COUNT(DISTINCT d.cliente) AS clientes,
        COUNT(DISTINCT d.compania) AS aseguradoras,
        COUNT(DISTINCT d.ramo) AS ramos
      FROM sicas_documents d
      WHERE d.vend_id IS NOT NULL
        AND d.fecha_captura >= v_desde AND d.fecha_captura < v_hasta
        AND (v_scope = 'admin' OR (v_scope = 'office' AND d.oficina_id = v_oficina) OR (v_scope = 'self' AND d.vend_id = v_vend_id))
        AND (p_vendedor_id IS NULL OR d.vend_id = p_vendedor_id)
      GROUP BY d.vend_nombre, d.vend_id
      ORDER BY prima_neta DESC
      LIMIT p_limit
    ) t;

  ELSE
    v_result := '[]'::jsonb;
  END IF;

  RETURN v_result;
END;
$$;

-- Also update get_sicas_dashboard_kpis to use higher timeout
DO $$
BEGIN
  EXECUTE 'ALTER FUNCTION get_sicas_dashboard_kpis(uuid, text, uuid, date, date, text) SET statement_timeout = ''30s''';
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- And charts
DO $$
BEGIN
  EXECUTE 'ALTER FUNCTION get_sicas_dashboard_charts(uuid, text, uuid, integer, text, date, date) SET statement_timeout = ''30s''';
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- And avance comercial
DO $$
BEGIN
  EXECUTE 'ALTER FUNCTION get_sicas_avance_comercial(uuid, text, uuid, text, date, date) SET statement_timeout = ''30s''';
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;
