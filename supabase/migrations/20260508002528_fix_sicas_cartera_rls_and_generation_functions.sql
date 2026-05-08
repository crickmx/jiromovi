/*
  # Fix SICAS Cartera Module RLS and Generation Functions

  1. Problem
    - RLS on sicas_customer_profiles, sicas_agent_alerts, sicas_cross_sell_opportunities
      only allows users to see their own records (auth.uid() = usuario_id)
    - Admins and gerentes cannot see office or system-wide data
    - generate_sicas_agent_alerts uses d.usuario_id for document queries (rarely populated)
    - refresh_sicas_customer_profiles uses d.usuario_id (same bug)

  2. Solution
    - Update RLS to allow:
      - Administrador/Ejecutivo: see all records
      - Gerente/Empleado: see records in their office
      - Agente (and others): see only their own records
    - Fix generation functions to use d.vend_id instead of d.usuario_id

  3. Security
    - All tables remain RLS-enabled
    - Uses helper function to check user role without recursion
    - Only SELECT policies are broadened; INSERT/UPDATE remain owner-only
*/

-- ============================================================
-- Helper: get user role without recursion
-- ============================================================
CREATE OR REPLACE FUNCTION get_user_role_for_rls(p_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT rol FROM usuarios WHERE id = p_user_id AND deleted_at IS NULL;
$$;

CREATE OR REPLACE FUNCTION get_user_oficina_for_rls(p_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT oficina_id FROM usuarios WHERE id = p_user_id AND deleted_at IS NULL;
$$;

-- ============================================================
-- Fix RLS: sicas_customer_profiles
-- ============================================================
DROP POLICY IF EXISTS "Agents see own customer profiles" ON sicas_customer_profiles;

CREATE POLICY "Users see scoped customer profiles"
  ON sicas_customer_profiles FOR SELECT
  TO authenticated
  USING (
    CASE get_user_role_for_rls(auth.uid())
      WHEN 'Administrador' THEN true
      WHEN 'Ejecutivo' THEN true
      WHEN 'Gerente' THEN oficina_id = get_user_oficina_for_rls(auth.uid())
      WHEN 'Empleado' THEN oficina_id = get_user_oficina_for_rls(auth.uid())
      ELSE auth.uid() = usuario_id
    END
  );

-- ============================================================
-- Fix RLS: sicas_agent_alerts
-- ============================================================
DROP POLICY IF EXISTS "Agents see own alerts" ON sicas_agent_alerts;

CREATE POLICY "Users see scoped alerts"
  ON sicas_agent_alerts FOR SELECT
  TO authenticated
  USING (
    CASE get_user_role_for_rls(auth.uid())
      WHEN 'Administrador' THEN true
      WHEN 'Ejecutivo' THEN true
      WHEN 'Gerente' THEN oficina_id = get_user_oficina_for_rls(auth.uid())
      WHEN 'Empleado' THEN oficina_id = get_user_oficina_for_rls(auth.uid())
      ELSE auth.uid() = usuario_id
    END
  );

-- ============================================================
-- Fix RLS: sicas_cross_sell_opportunities
-- ============================================================
DROP POLICY IF EXISTS "Agents see own opportunities" ON sicas_cross_sell_opportunities;

CREATE POLICY "Users see scoped opportunities"
  ON sicas_cross_sell_opportunities FOR SELECT
  TO authenticated
  USING (
    CASE get_user_role_for_rls(auth.uid())
      WHEN 'Administrador' THEN true
      WHEN 'Ejecutivo' THEN true
      WHEN 'Gerente' THEN oficina_id = get_user_oficina_for_rls(auth.uid())
      WHEN 'Empleado' THEN oficina_id = get_user_oficina_for_rls(auth.uid())
      ELSE auth.uid() = usuario_id
    END
  );

-- ============================================================
-- Fix RLS: sicas_renewal_followups (same pattern)
-- ============================================================
DROP POLICY IF EXISTS "Agents see own renewal followups" ON sicas_renewal_followups;

CREATE POLICY "Users see scoped renewal followups"
  ON sicas_renewal_followups FOR SELECT
  TO authenticated
  USING (
    CASE get_user_role_for_rls(auth.uid())
      WHEN 'Administrador' THEN true
      WHEN 'Ejecutivo' THEN true
      WHEN 'Gerente' THEN EXISTS (
        SELECT 1 FROM sicas_customer_profiles cp
        WHERE cp.id = sicas_renewal_followups.customer_profile_id
          AND cp.oficina_id = get_user_oficina_for_rls(auth.uid())
      )
      WHEN 'Empleado' THEN EXISTS (
        SELECT 1 FROM sicas_customer_profiles cp
        WHERE cp.id = sicas_renewal_followups.customer_profile_id
          AND cp.oficina_id = get_user_oficina_for_rls(auth.uid())
      )
      ELSE auth.uid() = usuario_id
    END
  );

-- ============================================================
-- Fix: refresh_sicas_customer_profiles - use vend_id instead of usuario_id
-- ============================================================
CREATE OR REPLACE FUNCTION refresh_sicas_customer_profiles(p_usuario_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_vendor_id text;
  v_oficina_id uuid;
  v_count integer := 0;
BEGIN
  -- Get user's vendor mapping using the same helper as dashboard
  v_vendor_id := get_sicas_user_vend_id(p_usuario_id);

  IF v_vendor_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No vendor mapping found');
  END IF;

  -- Get office
  SELECT oficina_id INTO v_oficina_id FROM usuarios WHERE id = p_usuario_id;

  -- Upsert customer profiles from documents (using vend_id, not usuario_id)
  INSERT INTO sicas_customer_profiles (
    usuario_id, sicas_vendor_id, oficina_id, client_name, normalized_name, 
    total_policies_active, total_premium_active, ramos_activos, aseguradoras_activas,
    next_renewal_date, last_emission_date, last_activity_at, portfolio_status
  )
  SELECT
    p_usuario_id,
    v_vendor_id,
    v_oficina_id,
    d.cliente,
    upper(trim(regexp_replace(d.cliente, '\s+', ' ', 'g'))),
    count(*) FILTER (WHERE d.is_vigente = true),
    coalesce(sum(d.prima_neta) FILTER (WHERE d.is_vigente = true), 0),
    array_agg(DISTINCT d.ramo) FILTER (WHERE d.ramo IS NOT NULL AND d.is_vigente = true),
    array_agg(DISTINCT d.compania) FILTER (WHERE d.compania IS NOT NULL AND d.is_vigente = true),
    min(d.vigencia_hasta) FILTER (WHERE d.is_vigente = true AND d.vigencia_hasta > now()),
    max(d.fecha_captura),
    max(d.synced_at),
    CASE
      WHEN count(*) FILTER (WHERE d.is_vigente = true AND d.vigencia_hasta BETWEEN now() AND now() + interval '30 days') > 0 THEN 'renewing'
      WHEN count(*) FILTER (WHERE d.is_vigente = true) > 0 THEN 'active'
      WHEN count(*) FILTER (WHERE d.is_vigente = false AND d.vigencia_hasta > now() - interval '90 days') > 0 THEN 'expired'
      ELSE 'lost'
    END
  FROM sicas_documents d
  WHERE d.vend_id = v_vendor_id
    AND d.cliente IS NOT NULL
    AND trim(d.cliente) != ''
  GROUP BY d.cliente
  ON CONFLICT (usuario_id, normalized_name) WHERE rfc IS NULL
  DO UPDATE SET
    total_policies_active = EXCLUDED.total_policies_active,
    total_premium_active = EXCLUDED.total_premium_active,
    ramos_activos = EXCLUDED.ramos_activos,
    aseguradoras_activas = EXCLUDED.aseguradoras_activas,
    next_renewal_date = EXCLUDED.next_renewal_date,
    last_emission_date = EXCLUDED.last_emission_date,
    last_activity_at = EXCLUDED.last_activity_at,
    portfolio_status = EXCLUDED.portfolio_status,
    updated_at = now();

  GET DIAGNOSTICS v_count = ROW_COUNT;

  -- Mark high-value clients (top 20% by premium)
  WITH ranked AS (
    SELECT id, total_premium_active,
      ntile(5) OVER (ORDER BY total_premium_active DESC) as quintile
    FROM sicas_customer_profiles
    WHERE usuario_id = p_usuario_id AND total_policies_active > 0
  )
  UPDATE sicas_customer_profiles cp
  SET is_high_value = (r.quintile = 1)
  FROM ranked r
  WHERE cp.id = r.id;

  RETURN jsonb_build_object('success', true, 'profiles_updated', v_count);
END;
$$;

-- ============================================================
-- Fix: generate_sicas_agent_alerts - use vend_id instead of usuario_id
-- ============================================================
CREATE OR REPLACE FUNCTION generate_sicas_agent_alerts(p_usuario_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_alerts_created integer := 0;
  v_vendor_id text;
  v_oficina_id uuid;
BEGIN
  -- Use same helper as dashboard
  v_vendor_id := get_sicas_user_vend_id(p_usuario_id);

  IF v_vendor_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No vendor mapping');
  END IF;

  SELECT oficina_id INTO v_oficina_id FROM usuarios WHERE id = p_usuario_id;

  -- Clear old unresolved alerts older than 90 days
  DELETE FROM sicas_agent_alerts
  WHERE usuario_id = p_usuario_id
    AND status = 'new'
    AND created_at < now() - interval '90 days';

  -- Alert: Renewals within 15 days (HIGH priority)
  INSERT INTO sicas_agent_alerts (usuario_id, sicas_vendor_id, oficina_id, alert_type, priority, title, description, client_name, document_id, policy_number, due_date, recommended_action, related_data)
  SELECT
    p_usuario_id, v_vendor_id, v_oficina_id, 'renewal_upcoming', 'high',
    'Renovacion urgente: ' || d.cliente,
    'La poliza ' || coalesce(d.poliza, d.id_docto) || ' de ' || d.compania || ' vence en ' || 
      extract(day from d.vigencia_hasta - now())::integer || ' dias.',
    d.cliente, d.id_docto, d.poliza, d.vigencia_hasta::date,
    'Contactar al cliente para asegurar la renovacion.',
    jsonb_build_object('ramo', d.ramo, 'aseguradora', d.compania, 'prima_neta', d.prima_neta)
  FROM sicas_documents d
  WHERE d.vend_id = v_vendor_id
    AND d.is_vigente = true
    AND d.vigencia_hasta BETWEEN now() AND now() + interval '15 days'
    AND NOT EXISTS (
      SELECT 1 FROM sicas_agent_alerts a
      WHERE a.usuario_id = p_usuario_id
        AND a.document_id = d.id_docto
        AND a.alert_type = 'renewal_upcoming'
        AND a.created_at > now() - interval '30 days'
    );
  GET DIAGNOSTICS v_alerts_created = ROW_COUNT;

  -- Alert: Renewals 15-30 days (MEDIUM priority)
  INSERT INTO sicas_agent_alerts (usuario_id, sicas_vendor_id, oficina_id, alert_type, priority, title, description, client_name, document_id, policy_number, due_date, recommended_action, related_data)
  SELECT
    p_usuario_id, v_vendor_id, v_oficina_id, 'renewal_upcoming', 'medium',
    'Renovacion proxima: ' || d.cliente,
    'La poliza ' || coalesce(d.poliza, d.id_docto) || ' vence el ' || to_char(d.vigencia_hasta, 'DD/MM/YYYY') || '.',
    d.cliente, d.id_docto, d.poliza, d.vigencia_hasta::date,
    'Programar contacto con el cliente.',
    jsonb_build_object('ramo', d.ramo, 'aseguradora', d.compania, 'prima_neta', d.prima_neta)
  FROM sicas_documents d
  WHERE d.vend_id = v_vendor_id
    AND d.is_vigente = true
    AND d.vigencia_hasta BETWEEN now() + interval '15 days' AND now() + interval '30 days'
    AND NOT EXISTS (
      SELECT 1 FROM sicas_agent_alerts a
      WHERE a.usuario_id = p_usuario_id
        AND a.document_id = d.id_docto
        AND a.alert_type = 'renewal_upcoming'
        AND a.created_at > now() - interval '30 days'
    );

  -- Alert: Expired policies recoverable (< 90 days)
  INSERT INTO sicas_agent_alerts (usuario_id, sicas_vendor_id, oficina_id, alert_type, priority, title, description, client_name, document_id, policy_number, due_date, recommended_action, related_data)
  SELECT
    p_usuario_id, v_vendor_id, v_oficina_id, 'recoverable_policy', 'high',
    'Poliza vencida recuperable: ' || d.cliente,
    'La poliza ' || coalesce(d.poliza, d.id_docto) || ' vencio hace ' || 
      extract(day from now() - d.vigencia_hasta)::integer || ' dias. Aun se puede recuperar.',
    d.cliente, d.id_docto, d.poliza, d.vigencia_hasta::date,
    'Contactar al cliente para reactivar la poliza.',
    jsonb_build_object('ramo', d.ramo, 'aseguradora', d.compania, 'prima_neta', d.prima_neta)
  FROM sicas_documents d
  WHERE d.vend_id = v_vendor_id
    AND d.is_vigente = false
    AND d.vigencia_hasta BETWEEN now() - interval '90 days' AND now()
    AND NOT EXISTS (
      SELECT 1 FROM sicas_agent_alerts a
      WHERE a.usuario_id = p_usuario_id
        AND a.document_id = d.id_docto
        AND a.alert_type = 'recoverable_policy'
        AND a.created_at > now() - interval '30 days'
    );

  -- Alert: High-value renewals (top premium policies renewing soon)
  INSERT INTO sicas_agent_alerts (usuario_id, sicas_vendor_id, oficina_id, alert_type, priority, title, description, client_name, document_id, policy_number, due_date, recommended_action, related_data)
  SELECT
    p_usuario_id, v_vendor_id, v_oficina_id, 'high_value_renewal', 'high',
    'Renovacion de alta prima: ' || d.cliente,
    'Poliza con prima de $' || to_char(d.prima_neta, 'FM999,999,999') || ' vence el ' || to_char(d.vigencia_hasta, 'DD/MM/YYYY') || '.',
    d.cliente, d.id_docto, d.poliza, d.vigencia_hasta::date,
    'Dar seguimiento prioritario a esta renovacion de alta prima.',
    jsonb_build_object('ramo', d.ramo, 'aseguradora', d.compania, 'prima_neta', d.prima_neta)
  FROM sicas_documents d
  WHERE d.vend_id = v_vendor_id
    AND d.is_vigente = true
    AND d.vigencia_hasta BETWEEN now() AND now() + interval '60 days'
    AND d.prima_neta > (
      SELECT percentile_cont(0.8) WITHIN GROUP (ORDER BY prima_neta)
      FROM sicas_documents WHERE vend_id = v_vendor_id AND is_vigente = true AND prima_neta > 0
    )
    AND NOT EXISTS (
      SELECT 1 FROM sicas_agent_alerts a
      WHERE a.usuario_id = p_usuario_id
        AND a.document_id = d.id_docto
        AND a.alert_type = 'high_value_renewal'
        AND a.created_at > now() - interval '30 days'
    );

  RETURN jsonb_build_object('success', true, 'alerts_created', v_alerts_created);
END;
$$;
