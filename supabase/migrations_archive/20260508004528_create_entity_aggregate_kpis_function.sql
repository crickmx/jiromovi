/*
  # Create entity aggregate KPIs function

  1. Purpose
    - EntityDetailModal currently computes KPIs only from the visible page (20 docs)
    - This function returns aggregated totals for the FULL dataset matching an entity filter
    - Used by the modal to show accurate KPI cards

  2. Parameters
    - p_user_id: the requesting user (for scope resolution)
    - p_dimension: 'cliente', 'aseguradora', 'ramo', 'oficina', 'vendedor'
    - p_entity_name: the entity value to filter by
    - p_entity_id: optional ID (for oficina/vendedor)
    - p_fecha_desde / p_fecha_hasta: optional date range

  3. Returns
    - total_docs: total document count
    - prima_neta_total: sum of prima_neta across all matching docs
    - prima_vigente: sum of prima_neta for vigente docs only
    - unique_count: unique counter-dimension (aseguradoras for cliente, clientes for others)
    - polizas_vigentes: count of vigente docs
    - polizas_canceladas: count of cancelled docs
*/

CREATE OR REPLACE FUNCTION get_sicas_entity_aggregates(
  p_user_id uuid,
  p_dimension text,
  p_entity_name text,
  p_entity_id text DEFAULT NULL,
  p_fecha_desde text DEFAULT NULL,
  p_fecha_hasta text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET statement_timeout = '15s'
AS $$
DECLARE
  v_rol text;
  v_oficina_id uuid;
  v_vend_id text;
  v_scope text;
  v_result jsonb;
BEGIN
  SELECT rol, oficina_id INTO v_rol, v_oficina_id
  FROM usuarios WHERE id = p_user_id;

  IF v_rol IS NULL THEN
    RETURN jsonb_build_object('total_docs', 0, 'prima_neta_total', 0, 'prima_vigente', 0, 'unique_count', 0, 'polizas_vigentes', 0, 'polizas_canceladas', 0);
  END IF;

  IF v_rol IN ('Administrador', 'Ejecutivo') THEN
    v_scope := 'admin';
  ELSIF v_rol IN ('Gerente', 'Empleado') THEN
    v_scope := 'office';
  ELSE
    v_scope := 'self';
  END IF;

  IF v_scope = 'self' THEN
    v_vend_id := get_sicas_user_vend_id(p_user_id);
  END IF;

  SELECT jsonb_build_object(
    'total_docs', count(*),
    'prima_neta_total', coalesce(sum(d.prima_neta), 0),
    'prima_vigente', coalesce(sum(d.prima_neta) FILTER (WHERE d.is_vigente = true), 0),
    'polizas_vigentes', count(*) FILTER (WHERE d.is_vigente = true),
    'polizas_canceladas', count(*) FILTER (WHERE d.is_cancelada = true),
    'unique_count', CASE
      WHEN p_dimension = 'cliente' THEN (SELECT count(DISTINCT d2.compania) FROM sicas_documents d2
        WHERE d2.cliente ILIKE '%' || regexp_replace(p_entity_name, '[%_]', '', 'g') || '%'
        AND CASE WHEN v_scope = 'admin' THEN true WHEN v_scope = 'office' THEN d2.oficina_id = v_oficina_id ELSE d2.vend_id = v_vend_id END)
      ELSE (SELECT count(DISTINCT d2.cliente) FROM sicas_documents d2
        WHERE CASE
          WHEN p_dimension = 'aseguradora' THEN d2.compania = p_entity_name
          WHEN p_dimension = 'ramo' THEN d2.ramo = p_entity_name
          WHEN p_dimension = 'oficina' THEN d2.oficina_id = p_entity_id::uuid
          WHEN p_dimension = 'vendedor' THEN d2.vend_id = p_entity_id
          ELSE false
        END
        AND CASE WHEN v_scope = 'admin' THEN true WHEN v_scope = 'office' THEN d2.oficina_id = v_oficina_id ELSE d2.vend_id = v_vend_id END)
    END
  ) INTO v_result
  FROM sicas_documents d
  WHERE
    CASE
      WHEN v_scope = 'admin' THEN true
      WHEN v_scope = 'office' THEN d.oficina_id = v_oficina_id
      ELSE d.vend_id = v_vend_id
    END
    AND CASE
      WHEN p_dimension = 'cliente' THEN d.cliente ILIKE '%' || regexp_replace(p_entity_name, '[%_]', '', 'g') || '%'
      WHEN p_dimension = 'aseguradora' THEN d.compania = p_entity_name
      WHEN p_dimension = 'ramo' THEN d.ramo = p_entity_name
      WHEN p_dimension = 'oficina' THEN d.oficina_id = p_entity_id::uuid
      WHEN p_dimension = 'vendedor' THEN d.vend_id = p_entity_id
      ELSE false
    END
    AND (p_fecha_desde IS NULL OR d.fecha_captura >= p_fecha_desde::timestamptz)
    AND (p_fecha_hasta IS NULL OR d.fecha_captura <= (p_fecha_hasta || 'T23:59:59')::timestamptz);

  RETURN COALESCE(v_result, jsonb_build_object('total_docs', 0, 'prima_neta_total', 0, 'prima_vigente', 0, 'unique_count', 0, 'polizas_vigentes', 0, 'polizas_canceladas', 0));
END;
$$;
