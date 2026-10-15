/*
  # Fix Dashboard RPC Functions - Correct Column Names

  ## Summary
  Replaces all broken dashboard aggregation functions with corrected versions that use
  the actual database column names.

  ## Problems Fixed

  1. `sicas_mapeo_usuario_vendedor` does not exist → use `sicas_mapeo_vendedor_usuario`
     - Old join: `m.vendedor_clave = sd.vendedor_clave AND m.usuario_id = p_user_id`
     - New join: `m.id_sicas_vendedor = sd.vend_id AND m.movi_user_id = p_user_id`

  2. `estatus_poliza = 'VIGENTE'` column does not exist → use `is_vigente = true`

  3. `fecha_vencimiento` column does not exist → use `vigencia_hasta`

  4. `tickets.estatus` (text) does not exist → join `ticket_estatus` via `estatus_id`
     - Also: `assigned_to` → `assigned_to_user_id`
     - Also: `updated_at` → `ultima_modificacion`

  5. `commission_details.usuario_id` for agent scope → use `movi_user_id`

  6. `usuarios.activo = true` is ambiguous (boolean column exists but estado is the source
     of truth for active filtering) → use `estado = 'activo'`

  7. `get_home_latest_emissions` and `get_home_next_renewals` Agente scope used
     `usuario_id = p_user_id` which is rarely populated → use vendor mapping join

  ## Tables Modified
  - Replaces functions: get_dashboard_kpis, get_dashboard_renovaciones_breakdown,
    get_dashboard_tramites_resumen, get_dashboard_top_aseguradoras,
    get_home_production_comparison, get_home_next_renewals, get_home_latest_emissions,
    AgentesActivosWidget / UsuariosActivosWidget use `estado = 'activo'` directly (no RPC)
*/

-- ══════════════════════════════════════════════════════════════════════════════
-- Function: get_dashboard_kpis (FIXED)
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
    -- Agente/Empleado: use vendor mapping
    SELECT COALESCE(SUM(sd.prima_neta), 0) INTO v_current_prod
    FROM sicas_documents sd
    JOIN sicas_mapeo_vendedor_usuario m ON m.id_sicas_vendedor = sd.vend_id AND m.movi_user_id = p_user_id
    WHERE sd.fecha_emision >= v_current_month_start;

    SELECT COALESCE(SUM(sd.prima_neta), 0) INTO v_previous_prod
    FROM sicas_documents sd
    JOIN sicas_mapeo_vendedor_usuario m ON m.id_sicas_vendedor = sd.vend_id AND m.movi_user_id = p_user_id
    WHERE sd.fecha_emision >= v_previous_month_start
      AND sd.fecha_emision <= v_previous_month_end;
  END IF;

  IF v_previous_prod > 0 THEN
    v_prod_growth := ROUND(((v_current_prod - v_previous_prod) / v_previous_prod) * 100, 1);
  ELSIF v_current_prod > 0 THEN
    v_prod_growth := 100;
  END IF;

  -- Commissions current month (commission_details uses movi_user_id for agent)
  SELECT COALESCE(SUM(COALESCE(commission_neta, 0)), 0) INTO v_current_comisiones
  FROM commission_details
  WHERE movi_user_id = p_user_id
    AND created_at >= v_current_month_start;

  -- Tramites: join ticket_estatus to get status name; non-closed statuses
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

-- ══════════════════════════════════════════════════════════════════════════════
-- Function: get_dashboard_renovaciones_breakdown (FIXED)
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
      COUNT(*) FILTER (WHERE vigencia_hasta BETWEEN CURRENT_DATE AND CURRENT_DATE + 30),
      COUNT(*) FILTER (WHERE vigencia_hasta BETWEEN CURRENT_DATE + 31 AND CURRENT_DATE + 60),
      COUNT(*) FILTER (WHERE vigencia_hasta BETWEEN CURRENT_DATE + 61 AND CURRENT_DATE + 90),
      COALESCE(SUM(prima_neta) FILTER (WHERE vigencia_hasta BETWEEN CURRENT_DATE AND CURRENT_DATE + 30), 0)
    INTO v_30, v_60, v_90, v_total_prima_30
    FROM sicas_documents
    WHERE is_vigente = true
      AND vigencia_hasta BETWEEN CURRENT_DATE AND CURRENT_DATE + 90
      AND (p_rol = 'Administrador' OR oficina_id = p_oficina_id);
  ELSE
    SELECT
      COUNT(*) FILTER (WHERE sd.vigencia_hasta BETWEEN CURRENT_DATE AND CURRENT_DATE + 30),
      COUNT(*) FILTER (WHERE sd.vigencia_hasta BETWEEN CURRENT_DATE + 31 AND CURRENT_DATE + 60),
      COUNT(*) FILTER (WHERE sd.vigencia_hasta BETWEEN CURRENT_DATE + 61 AND CURRENT_DATE + 90),
      COALESCE(SUM(sd.prima_neta) FILTER (WHERE sd.vigencia_hasta BETWEEN CURRENT_DATE AND CURRENT_DATE + 30), 0)
    INTO v_30, v_60, v_90, v_total_prima_30
    FROM sicas_documents sd
    JOIN sicas_mapeo_vendedor_usuario m ON m.id_sicas_vendedor = sd.vend_id AND m.movi_user_id = p_user_id
    WHERE sd.is_vigente = true
      AND sd.vigencia_hasta BETWEEN CURRENT_DATE AND CURRENT_DATE + 90;
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
-- Function: get_dashboard_tramites_resumen (FIXED)
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
  -- Count by status (excluding closed)
  IF p_rol IN ('Administrador', 'Gerente') THEN
    SELECT jsonb_object_agg(te.nombre, cnt)
    INTO v_por_estatus
    FROM (
      SELECT t.estatus_id, COUNT(*) as cnt
      FROM tickets t
      JOIN ticket_estatus te2 ON te2.id = t.estatus_id
      WHERE te2.nombre != 'Cerrado'
        AND (p_rol = 'Administrador' OR EXISTS (
          SELECT 1 FROM usuarios u WHERE u.id = t.agente_id AND u.oficina_id = p_oficina_id
        ))
      GROUP BY t.estatus_id
    ) sub
    JOIN ticket_estatus te ON te.id = sub.estatus_id;
  ELSE
    SELECT jsonb_object_agg(te.nombre, cnt)
    INTO v_por_estatus
    FROM (
      SELECT t.estatus_id, COUNT(*) as cnt
      FROM tickets t
      JOIN ticket_estatus te2 ON te2.id = t.estatus_id
      WHERE te2.nombre != 'Cerrado'
        AND (t.agente_id = p_user_id OR t.agente_usuario_id = p_user_id OR t.assigned_to_user_id = p_user_id)
      GROUP BY t.estatus_id
    ) sub
    JOIN ticket_estatus te ON te.id = sub.estatus_id;
  END IF;

  -- Recent open tickets with status name
  IF p_rol IN ('Administrador', 'Gerente') THEN
    SELECT COALESCE(jsonb_agg(row_to_json(rec)::jsonb ORDER BY rec.ultima_modificacion DESC), '[]'::jsonb)
    INTO v_recientes
    FROM (
      SELECT t.id, t.folio, t.tipo_tramite as tipo, te.nombre as estatus, t.ultima_modificacion
      FROM tickets t
      JOIN ticket_estatus te ON te.id = t.estatus_id
      WHERE te.nombre != 'Cerrado'
        AND (p_rol = 'Administrador' OR EXISTS (
          SELECT 1 FROM usuarios u WHERE u.id = t.agente_id AND u.oficina_id = p_oficina_id
        ))
      ORDER BY t.ultima_modificacion DESC
      LIMIT p_limit
    ) rec;
  ELSE
    SELECT COALESCE(jsonb_agg(row_to_json(rec)::jsonb ORDER BY rec.ultima_modificacion DESC), '[]'::jsonb)
    INTO v_recientes
    FROM (
      SELECT t.id, t.folio, t.tipo_tramite as tipo, te.nombre as estatus, t.ultima_modificacion
      FROM tickets t
      JOIN ticket_estatus te ON te.id = t.estatus_id
      WHERE te.nombre != 'Cerrado'
        AND (t.agente_id = p_user_id OR t.agente_usuario_id = p_user_id OR t.assigned_to_user_id = p_user_id)
      ORDER BY t.ultima_modificacion DESC
      LIMIT p_limit
    ) rec;
  END IF;

  result := jsonb_build_object(
    'por_estatus', COALESCE(v_por_estatus, '{}'::jsonb),
    'recientes', COALESCE(v_recientes, '[]'::jsonb)
  );

  RETURN result;
END;
$$;

-- ══════════════════════════════════════════════════════════════════════════════
-- Function: get_dashboard_top_aseguradoras (FIXED)
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
        COALESCE(compania, aseguradora_nombre, 'Sin nombre') as nombre,
        COUNT(*) as polizas,
        ROUND(SUM(prima_neta)::numeric, 2) as prima_total
      FROM sicas_documents
      WHERE fecha_emision >= v_year_start
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
      WHERE sd.fecha_emision >= v_year_start
        AND (sd.compania IS NOT NULL OR sd.aseguradora_nombre IS NOT NULL)
      GROUP BY COALESCE(sd.compania, sd.aseguradora_nombre, 'Sin nombre')
      ORDER BY prima_total DESC
      LIMIT p_limit
    ) sub;
  END IF;

  RETURN result;
END;
$$;

-- ══════════════════════════════════════════════════════════════════════════════
-- Function: get_home_production_comparison (FIXED)
-- Uses vendor mapping for Agente scope instead of usuario_id
-- ══════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.get_home_production_comparison(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_rol text;
  user_oficina_id uuid;
  current_year int := EXTRACT(year FROM NOW())::int;
  prev_year int := current_year - 1;
  current_doy int := EXTRACT(doy FROM NOW())::int;
  result jsonb;
  curr_prima numeric := 0;
  curr_polizas int := 0;
  prev_prima numeric := 0;
  prev_polizas int := 0;
  meta_prima numeric := 0;
  meta_polizas int := 0;
BEGIN
  SELECT rol, oficina_id INTO user_rol, user_oficina_id
  FROM usuarios WHERE id = p_user_id;

  IF user_rol IS NULL THEN
    RETURN jsonb_build_object('error', 'User not found');
  END IF;

  IF user_rol = 'Administrador' THEN
    SELECT COALESCE(SUM(prima_neta), 0), COUNT(*)
    INTO curr_prima, curr_polizas
    FROM sicas_documents
    WHERE fecha_captura >= make_date(current_year, 1, 1) AND fecha_captura < NOW();

    SELECT COALESCE(SUM(prima_neta), 0), COUNT(*)
    INTO prev_prima, prev_polizas
    FROM sicas_documents
    WHERE fecha_captura >= make_date(prev_year, 1, 1)
      AND fecha_captura < (make_date(prev_year, 1, 1) + (current_doy || ' days')::interval);

  ELSIF user_rol IN ('Gerente', 'Empleado') THEN
    SELECT COALESCE(SUM(prima_neta), 0), COUNT(*)
    INTO curr_prima, curr_polizas
    FROM sicas_documents
    WHERE fecha_captura >= make_date(current_year, 1, 1)
      AND fecha_captura < NOW()
      AND oficina_id = user_oficina_id;

    SELECT COALESCE(SUM(prima_neta), 0), COUNT(*)
    INTO prev_prima, prev_polizas
    FROM sicas_documents
    WHERE fecha_captura >= make_date(prev_year, 1, 1)
      AND fecha_captura < (make_date(prev_year, 1, 1) + (current_doy || ' days')::interval)
      AND oficina_id = user_oficina_id;

  ELSE
    -- Agente: use vendor mapping
    SELECT COALESCE(SUM(sd.prima_neta), 0), COUNT(*)
    INTO curr_prima, curr_polizas
    FROM sicas_documents sd
    JOIN sicas_mapeo_vendedor_usuario m ON m.id_sicas_vendedor = sd.vend_id AND m.movi_user_id = p_user_id
    WHERE sd.fecha_captura >= make_date(current_year, 1, 1) AND sd.fecha_captura < NOW();

    SELECT COALESCE(SUM(sd.prima_neta), 0), COUNT(*)
    INTO prev_prima, prev_polizas
    FROM sicas_documents sd
    JOIN sicas_mapeo_vendedor_usuario m ON m.id_sicas_vendedor = sd.vend_id AND m.movi_user_id = p_user_id
    WHERE sd.fecha_captura >= make_date(prev_year, 1, 1)
      AND sd.fecha_captura < (make_date(prev_year, 1, 1) + (current_doy || ' days')::interval);
  END IF;

  meta_prima := prev_prima * 1.20;
  meta_polizas := CEIL(prev_polizas * 1.20);

  result := jsonb_build_object(
    'current_year', current_year,
    'prev_year', prev_year,
    'current_prima', ROUND(curr_prima, 2),
    'current_polizas', curr_polizas,
    'prev_prima', ROUND(prev_prima, 2),
    'prev_polizas', prev_polizas,
    'meta_prima', ROUND(meta_prima, 2),
    'meta_polizas', meta_polizas,
    'growth_prima_pct', CASE WHEN prev_prima > 0 THEN ROUND(((curr_prima - prev_prima) / prev_prima) * 100, 1) ELSE 0 END,
    'growth_polizas_pct', CASE WHEN prev_polizas > 0 THEN ROUND(((curr_polizas::numeric - prev_polizas) / prev_polizas) * 100, 1) ELSE 0 END,
    'avance_meta_prima_pct', CASE WHEN meta_prima > 0 THEN ROUND((curr_prima / meta_prima) * 100, 1) ELSE 0 END,
    'avance_meta_polizas_pct', CASE WHEN meta_polizas > 0 THEN ROUND((curr_polizas::numeric / meta_polizas) * 100, 1) ELSE 0 END
  );

  RETURN result;
END;
$$;

-- ══════════════════════════════════════════════════════════════════════════════
-- Function: get_home_next_renewals (FIXED)
-- Uses vendor mapping for Agente scope
-- ══════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.get_home_next_renewals(p_user_id uuid, p_limit int DEFAULT 5)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_rol text;
  user_oficina_id uuid;
  result jsonb;
BEGIN
  SELECT rol, oficina_id INTO user_rol, user_oficina_id
  FROM usuarios WHERE id = p_user_id;

  IF user_rol IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  IF user_rol IN ('Administrador', 'Gerente', 'Empleado') THEN
    SELECT COALESCE(jsonb_agg(row_to_json(r)), '[]'::jsonb)
    INTO result
    FROM (
      SELECT
        id, id_docto, poliza, cliente, compania, ramo, prima_neta, vigencia_hasta,
        GREATEST(0, EXTRACT(day FROM vigencia_hasta - NOW())::int) as dias_restantes,
        CASE
          WHEN vigencia_hasta <= NOW() + interval '7 days' THEN 'critico'
          WHEN vigencia_hasta <= NOW() + interval '15 days' THEN 'urgente'
          WHEN vigencia_hasta <= NOW() + interval '30 days' THEN 'proximo'
          ELSE 'normal'
        END as urgencia
      FROM sicas_documents
      WHERE vigencia_hasta > NOW()
        AND vigencia_hasta < NOW() + interval '90 days'
        AND is_vigente = true
        AND (
          user_rol = 'Administrador'
          OR oficina_id = user_oficina_id
        )
      ORDER BY vigencia_hasta ASC
      LIMIT p_limit
    ) r;
  ELSE
    -- Agente: use vendor mapping
    SELECT COALESCE(jsonb_agg(row_to_json(r)), '[]'::jsonb)
    INTO result
    FROM (
      SELECT
        sd.id, sd.id_docto, sd.poliza, sd.cliente, sd.compania, sd.ramo, sd.prima_neta, sd.vigencia_hasta,
        GREATEST(0, EXTRACT(day FROM sd.vigencia_hasta - NOW())::int) as dias_restantes,
        CASE
          WHEN sd.vigencia_hasta <= NOW() + interval '7 days' THEN 'critico'
          WHEN sd.vigencia_hasta <= NOW() + interval '15 days' THEN 'urgente'
          WHEN sd.vigencia_hasta <= NOW() + interval '30 days' THEN 'proximo'
          ELSE 'normal'
        END as urgencia
      FROM sicas_documents sd
      JOIN sicas_mapeo_vendedor_usuario m ON m.id_sicas_vendedor = sd.vend_id AND m.movi_user_id = p_user_id
      WHERE sd.vigencia_hasta > NOW()
        AND sd.vigencia_hasta < NOW() + interval '90 days'
        AND sd.is_vigente = true
      ORDER BY sd.vigencia_hasta ASC
      LIMIT p_limit
    ) r;
  END IF;

  RETURN result;
END;
$$;

-- ══════════════════════════════════════════════════════════════════════════════
-- Function: get_home_latest_emissions (FIXED)
-- Uses vendor mapping for Agente scope
-- ══════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.get_home_latest_emissions(p_user_id uuid, p_limit int DEFAULT 5)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_rol text;
  user_oficina_id uuid;
  result jsonb;
BEGIN
  SELECT rol, oficina_id INTO user_rol, user_oficina_id
  FROM usuarios WHERE id = p_user_id;

  IF user_rol IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  IF user_rol IN ('Administrador', 'Gerente', 'Empleado') THEN
    SELECT COALESCE(jsonb_agg(row_to_json(r)), '[]'::jsonb)
    INTO result
    FROM (
      SELECT id, id_docto, poliza, cliente, compania, ramo, prima_neta, fecha_captura, status_texto
      FROM sicas_documents
      WHERE fecha_captura IS NOT NULL
        AND (
          user_rol = 'Administrador'
          OR oficina_id = user_oficina_id
        )
      ORDER BY fecha_captura DESC
      LIMIT p_limit
    ) r;
  ELSE
    -- Agente: use vendor mapping
    SELECT COALESCE(jsonb_agg(row_to_json(r)), '[]'::jsonb)
    INTO result
    FROM (
      SELECT sd.id, sd.id_docto, sd.poliza, sd.cliente, sd.compania, sd.ramo, sd.prima_neta, sd.fecha_captura, sd.status_texto
      FROM sicas_documents sd
      JOIN sicas_mapeo_vendedor_usuario m ON m.id_sicas_vendedor = sd.vend_id AND m.mowi_user_id = p_user_id
      WHERE sd.fecha_captura IS NOT NULL
      ORDER BY sd.fecha_captura DESC
      LIMIT p_limit
    ) r;
  END IF;

  RETURN result;
END;
$$;

-- ══════════════════════════════════════════════════════════════════════════════
-- Re-grant execute permissions
-- ══════════════════════════════════════════════════════════════════════════════
GRANT EXECUTE ON FUNCTION get_dashboard_kpis(uuid, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_dashboard_renovaciones_breakdown(uuid, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_dashboard_tramites_resumen(uuid, text, uuid, int) TO authenticated;
GRANT EXECUTE ON FUNCTION get_dashboard_top_aseguradoras(uuid, text, uuid, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_home_production_comparison(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_home_next_renewals(uuid, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_home_latest_emissions(uuid, int) TO authenticated;
