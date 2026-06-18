/*
  # Fix get_unified_contactos: RLS bypass and complete role support

  ## Problem
  The previous function was SECURITY DEFINER but crm_contactos RLS still blocked
  rows because the policy "Usuarios solo ven sus propios contactos" filters by
  creado_por = auth.uid() — which overrides the function's internal role check.

  ## Solution
  1. Recreate get_unified_contactos with SET row_security = off so RLS does NOT
     apply inside the function body (the function itself enforces visibility rules).
  2. Add 'Agente' and 'Empleado' to the allowed-role checks so every authenticated
     role can see their own contacts.
  3. Agente → only their contacts (creado_por = v_user_id OR sw.agent_user_id = v_user_id)
  4. Gerente/Empleado/Ejecutivo → contacts from their office
  5. Administrador → all contacts
*/

CREATE OR REPLACE FUNCTION get_unified_contactos(
  p_search text DEFAULT NULL,
  p_estatus text DEFAULT NULL,
  p_has_seguwallet boolean DEFAULT NULL,
  p_limit int DEFAULT 200,
  p_offset int DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  source text,
  nombre_completo text,
  email text,
  celular text,
  whatsapp text,
  tipo_contacto text,
  estatus text,
  fuente_origen text,
  creado_por uuid,
  fecha_creacion timestamptz,
  actualizado_en timestamptz,
  seguwallet_customer_id uuid,
  seguwallet_status text,
  seguwallet_profile_completed boolean,
  seguwallet_last_login timestamptz,
  seguwallet_agent_id uuid,
  sicas_count int
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_user_role text;
  v_oficina_id uuid;
BEGIN
  -- Get caller role and office
  SELECT rol, oficina_id INTO v_user_role, v_oficina_id
  FROM usuarios
  WHERE id = v_user_id;

  -- Fallback: if no role found, deny access
  IF v_user_role IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH crm_with_sw AS (
    SELECT
      c.id,
      'crm'::text AS source,
      c.nombre_completo,
      c.email,
      c.celular,
      c.whatsapp,
      c.tipo_contacto,
      c.estatus,
      c.fuente_origen,
      c.creado_por,
      c.fecha_creacion,
      c.actualizado_en,
      sw.id AS seguwallet_customer_id,
      sw.status AS seguwallet_status,
      sw.profile_completed AS seguwallet_profile_completed,
      sw.last_login_at AS seguwallet_last_login,
      sw.agent_user_id AS seguwallet_agent_id,
      COALESCE(
        (SELECT COUNT(*)::int FROM seguwallet_customer_sicas_clients scsc
         WHERE scsc.customer_id = sw.id),
        0
      ) AS sicas_count
    FROM crm_contactos c
    LEFT JOIN seguwallet_customers sw ON sw.crm_contact_id = c.id AND sw.deleted_at IS NULL
    WHERE
      -- Role-based visibility
      (
        v_user_role = 'Administrador'
        OR (v_user_role IN ('Gerente', 'Empleado', 'Ejecutivo')
            AND (c.creado_por = v_user_id
                 OR v_oficina_id IS NULL
                 OR EXISTS (
                   SELECT 1 FROM usuarios u2
                   WHERE u2.id = c.creado_por
                     AND u2.oficina_id = v_oficina_id
                 )))
        OR (v_user_role = 'Agente' AND c.creado_por = v_user_id)
      )
      -- Search filter
      AND (p_search IS NULL OR
           c.nombre_completo ILIKE '%' || p_search || '%' OR
           c.email ILIKE '%' || p_search || '%' OR
           c.celular ILIKE '%' || p_search || '%')
      -- Status filter
      AND (p_estatus IS NULL OR c.estatus = p_estatus)
      -- Seguwallet filter
      AND (p_has_seguwallet IS NULL OR
           (p_has_seguwallet = true AND sw.id IS NOT NULL) OR
           (p_has_seguwallet = false AND sw.id IS NULL))
  ),
  sw_without_crm AS (
    -- Seguwallet customers that are NOT yet linked to a CRM contact
    SELECT
      sw.id,
      'seguwallet'::text AS source,
      sw.full_name AS nombre_completo,
      sw.email,
      sw.phone AS celular,
      sw.whatsapp,
      'Persona'::text AS tipo_contacto,
      'Cliente'::text AS estatus,
      'Seguwallet'::text AS fuente_origen,
      sw.agent_user_id AS creado_por,
      sw.created_at AS fecha_creacion,
      sw.updated_at AS actualizado_en,
      sw.id AS seguwallet_customer_id,
      sw.status AS seguwallet_status,
      sw.profile_completed AS seguwallet_profile_completed,
      sw.last_login_at AS seguwallet_last_login,
      sw.agent_user_id AS seguwallet_agent_id,
      COALESCE(
        (SELECT COUNT(*)::int FROM seguwallet_customer_sicas_clients scsc
         WHERE scsc.customer_id = sw.id),
        0
      ) AS sicas_count
    FROM seguwallet_customers sw
    WHERE sw.crm_contact_id IS NULL
      AND sw.deleted_at IS NULL
      AND (
        v_user_role = 'Administrador'
        OR (v_user_role IN ('Gerente', 'Empleado', 'Ejecutivo')
            AND (sw.agent_user_id = v_user_id
                 OR v_oficina_id IS NULL
                 OR EXISTS (
                   SELECT 1 FROM usuarios u2
                   WHERE u2.id = sw.agent_user_id
                     AND u2.oficina_id = v_oficina_id
                 )))
        OR (v_user_role = 'Agente' AND sw.agent_user_id = v_user_id)
      )
      AND (p_search IS NULL OR
           sw.full_name ILIKE '%' || p_search || '%' OR
           sw.email ILIKE '%' || p_search || '%' OR
           sw.phone ILIKE '%' || p_search || '%')
      AND (p_estatus IS NULL OR p_estatus = 'Cliente')
      AND (p_has_seguwallet IS NULL OR p_has_seguwallet = true)
  )
  SELECT * FROM crm_with_sw
  UNION ALL
  SELECT * FROM sw_without_crm
  ORDER BY fecha_creacion DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION get_unified_contactos TO authenticated;
GRANT EXECUTE ON FUNCTION get_unified_contactos TO service_role;
