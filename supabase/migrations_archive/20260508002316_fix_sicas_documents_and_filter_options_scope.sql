/*
  # Fix SICAS Documents and Filter Options Scope for Agentes and Empleados

  1. Problem
    - `get_sicas_documents` uses `d.usuario_id = p_user_id` for Agente scope, but `usuario_id` is rarely populated
    - `get_sicas_filter_options` has the same bug AND excludes Empleado from office-level checks
    - This means Agentes see no data and Empleados get incorrectly scoped to self

  2. Solution
    - Both functions now use `get_sicas_user_vend_id(p_user_id)` for self/Agente scope (matching KPI functions)
    - Both functions now include Empleado in office-level checks alongside Gerente and Ejecutivo
    - Consistent with `get_sicas_dashboard_kpis`, `get_sicas_dashboard_charts`, `get_sicas_dashboard_top`

  3. Role scoping summary
    - Administrador: sees all documents
    - Gerente, Empleado, Ejecutivo: sees their office documents (d.oficina_id = user's oficina_id)
    - Agente (and any other role): sees only their mapped vendor (d.vend_id = resolved vend_id)

  4. Security
    - Both remain SECURITY DEFINER
    - Access patterns unchanged for admin and office roles
    - Agente scope now correctly restricted to their mapped SICAS vendor
*/

-- ============================================================================
-- Fix get_sicas_documents: use vend_id for self scope, include Empleado in office
-- ============================================================================
CREATE OR REPLACE FUNCTION get_sicas_documents(
  p_user_id uuid,
  p_scope text DEFAULT 'all',
  p_oficina_id uuid DEFAULT NULL,
  p_vendedor_id text DEFAULT NULL,
  p_page int DEFAULT 1,
  p_page_size int DEFAULT 50,
  p_search text DEFAULT NULL,
  p_cliente text DEFAULT NULL,
  p_aseguradora text DEFAULT NULL,
  p_ramo text DEFAULT NULL,
  p_subramo text DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_tipo text DEFAULT NULL,
  p_moneda text DEFAULT NULL,
  p_fecha_desde text DEFAULT NULL,
  p_fecha_hasta text DEFAULT NULL,
  p_solo_renovaciones boolean DEFAULT false,
  p_dias_renovacion int DEFAULT 90,
  p_order_by text DEFAULT 'fecha_captura',
  p_order_asc boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET statement_timeout = '30s'
AS $$
DECLARE
  v_rol text;
  v_oficina_id uuid;
  v_vend_id text;
  v_scope text;
  v_result jsonb;
  v_data jsonb;
  v_count bigint;
  v_offset int;
  v_safe_search text;
BEGIN
  -- Get user role and office
  SELECT rol, oficina_id INTO v_rol, v_oficina_id
  FROM usuarios WHERE id = p_user_id;

  IF v_rol IS NULL THEN
    RETURN jsonb_build_object('data', '[]'::jsonb, 'count', 0);
  END IF;

  -- Determine scope (same logic as KPI functions)
  IF v_rol IN ('Administrador', 'Ejecutivo') THEN
    v_scope := 'admin';
  ELSIF v_rol IN ('Gerente', 'Empleado') THEN
    v_scope := 'office';
  ELSE
    v_scope := 'self';
  END IF;

  -- For self scope, resolve the SICAS vendor ID
  IF v_scope = 'self' THEN
    v_vend_id := get_sicas_user_vend_id(p_user_id);
  END IF;

  v_offset := (p_page - 1) * p_page_size;
  v_safe_search := regexp_replace(COALESCE(p_search, ''), '[%_]', '', 'g');

  -- Build and execute dynamic query
  WITH filtered_docs AS (
    SELECT
      d.id, d.id_docto, d.vend_id, d.vend_nombre, d.desp_id, d.desp_nombre,
      d.usuario_id, d.oficina_id, d.oficina_nombre,
      d.ramo, d.subramo, d.compania, d.aseguradora_nombre,
      d.poliza, d.cliente, d.fecha_captura, d.fecha_emision,
      d.vigencia_desde, d.vigencia_hasta,
      d.importe, d.prima_neta, d.prima_total, d.derechos, d.impuestos, d.recargos,
      d.moneda, d.tipo_documento, d.subtipo_documento, d.agente_nombre,
      d.status_codigo, d.status_texto, d.status_cobro,
      d.is_poliza, d.is_fianza, d.is_vigente, d.is_cancelada,
      d.is_renewable, d.renewal_days_remaining,
      d.source_keycode, d.synced_at
    FROM sicas_documents d
    WHERE
      -- Scope/permission filtering
      CASE
        WHEN v_scope = 'admin' THEN true
        WHEN v_scope = 'office' THEN d.oficina_id = v_oficina_id
        ELSE d.vend_id = v_vend_id
      END
      -- Optional office filter (for admin drilling into specific office)
      AND (p_oficina_id IS NULL OR d.oficina_id = p_oficina_id)
      -- Optional vendor filter
      AND (p_vendedor_id IS NULL OR d.vend_id = p_vendedor_id)
      -- Search
      AND (v_safe_search = '' OR (
        d.cliente ILIKE '%' || v_safe_search || '%'
        OR d.poliza ILIKE '%' || v_safe_search || '%'
        OR d.compania ILIKE '%' || v_safe_search || '%'
        OR d.ramo ILIKE '%' || v_safe_search || '%'
        OR d.vend_nombre ILIKE '%' || v_safe_search || '%'
      ))
      -- Specific filters
      AND (p_cliente IS NULL OR d.cliente ILIKE '%' || regexp_replace(p_cliente, '[%_]', '', 'g') || '%')
      AND (p_aseguradora IS NULL OR d.compania = p_aseguradora)
      AND (p_ramo IS NULL OR d.ramo = p_ramo)
      AND (p_subramo IS NULL OR d.subramo = p_subramo)
      AND (p_moneda IS NULL OR d.moneda = p_moneda)
      -- Status filter
      AND (
        p_status IS NULL
        OR (p_status = 'vigente' AND d.is_vigente = true)
        OR (p_status = 'cancelada' AND d.is_cancelada = true)
        OR (p_status NOT IN ('vigente', 'cancelada') AND d.status_texto = p_status)
      )
      -- Type filter
      AND (
        p_tipo IS NULL
        OR (p_tipo = 'polizas' AND d.is_poliza = true)
        OR (p_tipo = 'fianzas' AND d.is_fianza = true)
      )
      -- Date range
      AND (p_fecha_desde IS NULL OR d.fecha_captura >= p_fecha_desde::timestamptz)
      AND (p_fecha_hasta IS NULL OR d.fecha_captura <= (p_fecha_hasta || 'T23:59:59')::timestamptz)
      -- Renewals
      AND (
        NOT p_solo_renovaciones
        OR (d.is_vigente = true AND d.renewal_days_remaining >= 0 AND d.renewal_days_remaining <= p_dias_renovacion)
      )
  )
  SELECT
    jsonb_agg(row_to_json(paged.*) ORDER BY
      CASE WHEN p_order_by = 'fecha_captura' AND NOT p_order_asc THEN paged.fecha_captura END DESC NULLS LAST,
      CASE WHEN p_order_by = 'fecha_captura' AND p_order_asc THEN paged.fecha_captura END ASC NULLS LAST,
      CASE WHEN p_order_by = 'prima_total' AND NOT p_order_asc THEN paged.prima_total END DESC NULLS LAST,
      CASE WHEN p_order_by = 'prima_total' AND p_order_asc THEN paged.prima_total END ASC NULLS LAST,
      CASE WHEN p_order_by = 'cliente' AND NOT p_order_asc THEN paged.cliente END DESC NULLS LAST,
      CASE WHEN p_order_by = 'cliente' AND p_order_asc THEN paged.cliente END ASC NULLS LAST,
      CASE WHEN p_order_by NOT IN ('fecha_captura','prima_total','cliente') AND NOT p_order_asc THEN paged.fecha_captura END DESC NULLS LAST,
      CASE WHEN p_order_by NOT IN ('fecha_captura','prima_total','cliente') AND p_order_asc THEN paged.fecha_captura END ASC NULLS LAST
    ),
    (SELECT count(*) FROM filtered_docs)
  INTO v_data, v_count
  FROM (
    SELECT * FROM filtered_docs
    ORDER BY
      CASE WHEN p_order_by = 'fecha_captura' AND NOT p_order_asc THEN fecha_captura END DESC NULLS LAST,
      CASE WHEN p_order_by = 'fecha_captura' AND p_order_asc THEN fecha_captura END ASC NULLS LAST,
      CASE WHEN p_order_by = 'prima_total' AND NOT p_order_asc THEN prima_total END DESC NULLS LAST,
      CASE WHEN p_order_by = 'prima_total' AND p_order_asc THEN prima_total END ASC NULLS LAST,
      CASE WHEN p_order_by = 'cliente' AND NOT p_order_asc THEN cliente END DESC NULLS LAST,
      CASE WHEN p_order_by = 'cliente' AND p_order_asc THEN cliente END ASC NULLS LAST,
      CASE WHEN p_order_by NOT IN ('fecha_captura','prima_total','cliente') AND NOT p_order_asc THEN fecha_captura END DESC NULLS LAST,
      CASE WHEN p_order_by NOT IN ('fecha_captura','prima_total','cliente') AND p_order_asc THEN fecha_captura END ASC NULLS LAST
    LIMIT p_page_size OFFSET v_offset
  ) paged;

  RETURN jsonb_build_object(
    'data', COALESCE(v_data, '[]'::jsonb),
    'count', COALESCE(v_count, 0)
  );
END;
$$;

-- ============================================================================
-- Fix get_sicas_filter_options: use vend_id for self scope, include Empleado in office
-- ============================================================================
CREATE OR REPLACE FUNCTION get_sicas_filter_options(
  p_user_id uuid,
  p_scope text DEFAULT 'all',
  p_oficina_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET statement_timeout = '30s'
AS $$
DECLARE
  v_rol text;
  v_oficina_id uuid;
  v_vend_id text;
  v_scope text;
  v_aseguradoras jsonb;
  v_ramos jsonb;
  v_subramos jsonb;
  v_monedas jsonb;
  v_vendedores jsonb;
BEGIN
  -- Get user role and office
  SELECT rol, oficina_id INTO v_rol, v_oficina_id
  FROM usuarios WHERE id = p_user_id;

  IF v_rol IS NULL THEN
    RETURN jsonb_build_object(
      'aseguradoras', '[]'::jsonb,
      'ramos', '[]'::jsonb,
      'subramos', '[]'::jsonb,
      'monedas', '[]'::jsonb,
      'vendedores', '[]'::jsonb
    );
  END IF;

  -- Determine scope (same logic as KPI functions)
  IF v_rol IN ('Administrador', 'Ejecutivo') THEN
    v_scope := 'admin';
  ELSIF v_rol IN ('Gerente', 'Empleado') THEN
    v_scope := 'office';
  ELSE
    v_scope := 'self';
  END IF;

  -- For self scope, resolve the SICAS vendor ID
  IF v_scope = 'self' THEN
    v_vend_id := get_sicas_user_vend_id(p_user_id);
  END IF;

  SELECT COALESCE(jsonb_agg(DISTINCT d.compania ORDER BY d.compania), '[]'::jsonb)
  INTO v_aseguradoras
  FROM sicas_documents d
  WHERE d.compania IS NOT NULL
    AND CASE
      WHEN v_scope = 'admin' THEN (p_oficina_id IS NULL OR d.oficina_id = p_oficina_id)
      WHEN v_scope = 'office' THEN d.oficina_id = v_oficina_id
      ELSE d.vend_id = v_vend_id
    END;

  SELECT COALESCE(jsonb_agg(DISTINCT d.ramo ORDER BY d.ramo), '[]'::jsonb)
  INTO v_ramos
  FROM sicas_documents d
  WHERE d.ramo IS NOT NULL
    AND CASE
      WHEN v_scope = 'admin' THEN (p_oficina_id IS NULL OR d.oficina_id = p_oficina_id)
      WHEN v_scope = 'office' THEN d.oficina_id = v_oficina_id
      ELSE d.vend_id = v_vend_id
    END;

  SELECT COALESCE(jsonb_agg(DISTINCT d.subramo ORDER BY d.subramo), '[]'::jsonb)
  INTO v_subramos
  FROM sicas_documents d
  WHERE d.subramo IS NOT NULL
    AND CASE
      WHEN v_scope = 'admin' THEN (p_oficina_id IS NULL OR d.oficina_id = p_oficina_id)
      WHEN v_scope = 'office' THEN d.oficina_id = v_oficina_id
      ELSE d.vend_id = v_vend_id
    END;

  SELECT COALESCE(jsonb_agg(DISTINCT d.moneda ORDER BY d.moneda), '[]'::jsonb)
  INTO v_monedas
  FROM sicas_documents d
  WHERE d.moneda IS NOT NULL
    AND CASE
      WHEN v_scope = 'admin' THEN (p_oficina_id IS NULL OR d.oficina_id = p_oficina_id)
      WHEN v_scope = 'office' THEN d.oficina_id = v_oficina_id
      ELSE d.vend_id = v_vend_id
    END;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('id', v.vend_id, 'nombre', v.vend_nombre) ORDER BY v.vend_nombre), '[]'::jsonb)
  INTO v_vendedores
  FROM (
    SELECT DISTINCT d.vend_id, d.vend_nombre
    FROM sicas_documents d
    WHERE d.vend_id IS NOT NULL AND d.vend_nombre IS NOT NULL
      AND CASE
        WHEN v_scope = 'admin' THEN (p_oficina_id IS NULL OR d.oficina_id = p_oficina_id)
        WHEN v_scope = 'office' THEN d.oficina_id = v_oficina_id
        ELSE d.vend_id = v_vend_id
      END
  ) v;

  RETURN jsonb_build_object(
    'aseguradoras', v_aseguradoras,
    'ramos', v_ramos,
    'subramos', v_subramos,
    'monedas', v_monedas,
    'vendedores', v_vendedores
  );
END;
$$;
