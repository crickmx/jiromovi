/*
  # Fix detect_sicas_cross_sell to use get_sicas_user_vend_id helper

  1. Problem
    - detect_sicas_cross_sell manually queries sicas_mapeo_vendedor_usuario
    - Other functions use get_sicas_user_vend_id() which also checks usuarios.id_sicas and name matching
    - This causes inconsistency: alerts find vendor IDs that cross-sell doesn't

  2. Fix
    - Use get_sicas_user_vend_id() helper function consistently
    - Also fix the auto_sin_gmm query WHERE clause (missing parentheses around OR condition)
*/

CREATE OR REPLACE FUNCTION detect_sicas_cross_sell(p_usuario_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_created integer := 0;
  v_vendor_id text;
  v_oficina_id uuid;
BEGIN
  -- Use the same helper as all other SICAS functions
  v_vendor_id := get_sicas_user_vend_id(p_usuario_id);

  SELECT oficina_id INTO v_oficina_id FROM usuarios WHERE id = p_usuario_id;

  IF v_vendor_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No vendor mapping');
  END IF;

  -- Clear old dismissed/converted opportunities older than 90 days
  DELETE FROM sicas_cross_sell_opportunities
  WHERE usuario_id = p_usuario_id
    AND status IN ('dismissed', 'converted')
    AND updated_at < now() - interval '90 days';

  -- Rule: Auto sin GMM
  INSERT INTO sicas_cross_sell_opportunities (
    usuario_id, sicas_vendor_id, oficina_id, customer_profile_id, client_name,
    opportunity_type, current_products, suggested_product, priority, description,
    recommended_message, premium_current
  )
  SELECT
    p_usuario_id, v_vendor_id, v_oficina_id, cp.id, cp.client_name,
    'auto_sin_gmm', cp.ramos_activos, 'Gastos Medicos Mayores', 'medium',
    'Cliente con Auto activo sin GMM. Puede ser candidato para proteccion familiar.',
    'Hola ' || split_part(cp.client_name, ' ', 1) || ', te escribo porque vi que tienes tu seguro de Auto con nosotros. Me gustaria platicarte sobre opciones de Gastos Medicos Mayores para complementar tu proteccion.',
    cp.total_premium_active
  FROM sicas_customer_profiles cp
  WHERE cp.usuario_id = p_usuario_id
    AND cp.total_policies_active > 0
    AND ('AUTOS' = ANY(cp.ramos_activos) OR 'AUTOMOVILES' = ANY(cp.ramos_activos))
    AND NOT ('GMM' = ANY(cp.ramos_activos) OR 'GASTOS MEDICOS' = ANY(cp.ramos_activos) OR 'GASTOS MEDICOS MAYORES' = ANY(cp.ramos_activos))
    AND NOT EXISTS (
      SELECT 1 FROM sicas_cross_sell_opportunities o
      WHERE o.usuario_id = p_usuario_id AND o.customer_profile_id = cp.id AND o.opportunity_type = 'auto_sin_gmm'
        AND o.status NOT IN ('dismissed', 'converted')
    );
  GET DIAGNOSTICS v_created = ROW_COUNT;

  -- Rule: Single policy client
  INSERT INTO sicas_cross_sell_opportunities (
    usuario_id, sicas_vendor_id, oficina_id, customer_profile_id, client_name,
    opportunity_type, current_products, suggested_product, priority, description,
    recommended_message, premium_current
  )
  SELECT
    p_usuario_id, v_vendor_id, v_oficina_id, cp.id, cp.client_name,
    'single_policy', cp.ramos_activos, 'Venta cruzada', 'low',
    'Cliente con una sola poliza. Puede ser candidato a venta cruzada.',
    'Hola ' || split_part(cp.client_name, ' ', 1) || ', me gustaria platicarte sobre opciones adicionales de proteccion que podrian complementar tu seguro actual.',
    cp.total_premium_active
  FROM sicas_customer_profiles cp
  WHERE cp.usuario_id = p_usuario_id
    AND cp.total_policies_active = 1
    AND NOT EXISTS (
      SELECT 1 FROM sicas_cross_sell_opportunities o
      WHERE o.usuario_id = p_usuario_id AND o.customer_profile_id = cp.id AND o.opportunity_type = 'single_policy'
        AND o.status NOT IN ('dismissed', 'converted')
    );

  -- Rule: High-value client
  INSERT INTO sicas_cross_sell_opportunities (
    usuario_id, sicas_vendor_id, oficina_id, customer_profile_id, client_name,
    opportunity_type, current_products, suggested_product, priority, description,
    recommended_message, premium_current
  )
  SELECT
    p_usuario_id, v_vendor_id, v_oficina_id, cp.id, cp.client_name,
    'high_value_client', cp.ramos_activos, 'Seguimiento prioritario', 'high',
    'Cliente de alta prima. Conviene darle seguimiento prioritario.',
    'Hola ' || split_part(cp.client_name, ' ', 1) || ', como tu asesor me gustaria revisar contigo tus coberturas actuales para asegurarme de que tengas la mejor proteccion posible.',
    cp.total_premium_active
  FROM sicas_customer_profiles cp
  WHERE cp.usuario_id = p_usuario_id
    AND cp.is_high_value = true
    AND cp.total_policies_active >= 2
    AND NOT EXISTS (
      SELECT 1 FROM sicas_cross_sell_opportunities o
      WHERE o.usuario_id = p_usuario_id AND o.customer_profile_id = cp.id AND o.opportunity_type = 'high_value_client'
        AND o.status NOT IN ('dismissed', 'converted')
    );

  -- Rule: Recoverable policy
  INSERT INTO sicas_cross_sell_opportunities (
    usuario_id, sicas_vendor_id, oficina_id, customer_profile_id, client_name,
    opportunity_type, current_products, suggested_product, priority, description,
    recommended_message, premium_current
  )
  SELECT
    p_usuario_id, v_vendor_id, v_oficina_id, cp.id, cp.client_name,
    'recoverable_policy', cp.ramos_activos, 'Reactivacion', 'high',
    'Cliente con poliza vencida recuperable. Conviene contactarlo para reactivacion.',
    'Hola ' || split_part(cp.client_name, ' ', 1) || ', te escribo porque note que tu poliza vencio recientemente. Me gustaria ayudarte a renovarla para que sigas protegido.',
    cp.total_premium_active
  FROM sicas_customer_profiles cp
  WHERE cp.usuario_id = p_usuario_id
    AND cp.portfolio_status = 'expired'
    AND cp.total_policies_expired > 0
    AND NOT EXISTS (
      SELECT 1 FROM sicas_cross_sell_opportunities o
      WHERE o.usuario_id = p_usuario_id AND o.customer_profile_id = cp.id AND o.opportunity_type = 'recoverable_policy'
        AND o.status NOT IN ('dismissed', 'converted')
    );

  RETURN jsonb_build_object('success', true, 'opportunities_created', v_created);
END;
$$;
