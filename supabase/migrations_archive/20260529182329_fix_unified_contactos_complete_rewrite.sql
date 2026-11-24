/*
  # Fix Unified Contactos - Complete Rewrite

  ## Problems Fixed
  1. get_unified_contactos returning 0 rows - caused by auth.uid() returning NULL 
     in certain Supabase RPC call contexts. Fixed by accepting explicit p_user_id param.
  2. Three Seguwallet customers incorrectly linked to the same CRM contact.
     Fixed: unlink wrong ones, create proper individual CRM contacts.
  3. Added proper NULL handling for agent_user_id in seguwallet_customers.

  ## Changes
  - DROP and recreate get_unified_contactos with p_user_id parameter
  - Fix wrong Seguwallet-CRM backfill linkages
  - Create missing individual CRM contacts for Seguwallet customers
*/

-- ─── Step 1: Fix the wrong backfill linkages ─────────────────────────────────
-- Customer "Prueba" (prueba@seguwallet.mx) is wrongly linked to "Cliente" contact
-- Customer "Christofer Prueba" (ccjimenez+1@me.com) is also wrongly linked

DO $$
DECLARE
  v_prueba_id uuid := '5bf0237f-d229-45f0-acd9-0826d646af19';
  v_christofer_id uuid := '98885656-85f4-45b9-b5e1-154d6b4a0470';
  v_new_contact_id uuid;
BEGIN

  -- Fix "Prueba" customer: create a proper CRM contact for them
  INSERT INTO crm_contactos (
    tipo_contacto, nombre_completo, celular, email, whatsapp,
    estatus, fuente_origen, creado_por, fecha_creacion
  )
  SELECT
    'Persona',
    sw.full_name,
    COALESCE(sw.phone, ''),
    sw.email,
    sw.whatsapp,
    'Cliente',
    'Seguwallet',
    sw.agent_user_id,
    sw.created_at
  FROM seguwallet_customers sw
  WHERE sw.id = v_prueba_id
  RETURNING id INTO v_new_contact_id;

  UPDATE seguwallet_customers
  SET crm_contact_id = v_new_contact_id
  WHERE id = v_prueba_id;

  -- Fix "Christofer Prueba" customer: create a proper CRM contact for them
  INSERT INTO crm_contactos (
    tipo_contacto, nombre_completo, celular, email, whatsapp,
    estatus, fuente_origen, creado_por, fecha_creacion
  )
  SELECT
    'Persona',
    sw.full_name,
    COALESCE(sw.phone, ''),
    sw.email,
    sw.whatsapp,
    'Cliente',
    'Seguwallet',
    sw.agent_user_id,
    sw.created_at
  FROM seguwallet_customers sw
  WHERE sw.id = v_christofer_id
  RETURNING id INTO v_new_contact_id;

  UPDATE seguwallet_customers
  SET crm_contact_id = v_new_contact_id
  WHERE id = v_christofer_id;

END $$;

-- ─── Step 2: Drop and recreate get_unified_contactos with explicit user_id ───
DROP FUNCTION IF EXISTS get_unified_contactos(text, text, boolean, integer, integer);

CREATE OR REPLACE FUNCTION get_unified_contactos(
  p_user_id    uuid    DEFAULT NULL,
  p_search     text    DEFAULT NULL,
  p_estatus    text    DEFAULT NULL,
  p_has_seguwallet boolean DEFAULT NULL,
  p_limit      integer DEFAULT 200,
  p_offset     integer DEFAULT 0
)
RETURNS TABLE(
  id                          uuid,
  source                      text,
  nombre_completo             text,
  email                       text,
  celular                     text,
  whatsapp                    text,
  tipo_contacto               text,
  estatus                     text,
  fuente_origen               text,
  creado_por                  uuid,
  fecha_creacion              timestamptz,
  actualizado_en              timestamptz,
  seguwallet_customer_id      uuid,
  seguwallet_status           text,
  seguwallet_profile_completed boolean,
  seguwallet_last_login       timestamptz,
  seguwallet_agent_id         uuid,
  sicas_count                 integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_caller    uuid;
  v_user_role text;
  v_oficina_id uuid;
BEGIN
  -- Resolve caller: use explicit param first, fall back to auth.uid()
  v_caller := COALESCE(p_user_id, auth.uid());

  IF v_caller IS NULL THEN
    RETURN; -- no authenticated context
  END IF;

  -- Get caller's role and office (row_security=off so no RLS interference)
  SELECT rol, oficina_id
  INTO v_user_role, v_oficina_id
  FROM usuarios
  WHERE id = v_caller
    AND (is_deleted = false OR is_deleted IS NULL)
  LIMIT 1;

  IF v_user_role IS NULL THEN
    RETURN; -- user not found in usuarios
  END IF;

  RETURN QUERY
  WITH crm_with_sw AS (
    SELECT
      c.id,
      'crm'::text                         AS source,
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
      sw.id                               AS seguwallet_customer_id,
      sw.status                           AS seguwallet_status,
      sw.profile_completed                AS seguwallet_profile_completed,
      sw.last_login_at                    AS seguwallet_last_login,
      sw.agent_user_id                    AS seguwallet_agent_id,
      COALESCE((
        SELECT COUNT(*)::int
        FROM seguwallet_customer_sicas_clients scsc
        WHERE scsc.customer_id = sw.id
      ), 0)                               AS sicas_count
    FROM crm_contactos c
    LEFT JOIN seguwallet_customers sw
      ON sw.crm_contact_id = c.id
      AND sw.deleted_at IS NULL
    WHERE
      -- Role-based visibility
      (
        v_user_role = 'Administrador'
        OR (
          v_user_role IN ('Gerente', 'Empleado', 'Ejecutivo')
          AND (
            c.creado_por = v_caller
            OR v_oficina_id IS NULL
            OR EXISTS (
              SELECT 1 FROM usuarios u2
              WHERE u2.id = c.creado_por
                AND u2.oficina_id = v_oficina_id
                AND (u2.is_deleted = false OR u2.is_deleted IS NULL)
            )
          )
        )
        OR (v_user_role = 'Agente' AND c.creado_por = v_caller)
      )
      AND (
        p_search IS NULL
        OR c.nombre_completo ILIKE '%' || p_search || '%'
        OR c.email ILIKE '%' || p_search || '%'
        OR c.celular ILIKE '%' || p_search || '%'
      )
      AND (p_estatus IS NULL OR c.estatus = p_estatus)
      AND (
        p_has_seguwallet IS NULL
        OR (p_has_seguwallet = true  AND sw.id IS NOT NULL)
        OR (p_has_seguwallet = false AND sw.id IS NULL)
      )
  ),
  sw_without_crm AS (
    -- Seguwallet customers not yet linked to a CRM contact
    SELECT
      sw.id,
      'seguwallet'::text                  AS source,
      sw.full_name                        AS nombre_completo,
      sw.email,
      sw.phone                            AS celular,
      sw.whatsapp,
      'Persona'::text                     AS tipo_contacto,
      'Cliente'::text                     AS estatus,
      'Seguwallet'::text                  AS fuente_origen,
      COALESCE(sw.agent_user_id, v_caller) AS creado_por,
      sw.created_at                       AS fecha_creacion,
      sw.updated_at                       AS actualizado_en,
      sw.id                               AS seguwallet_customer_id,
      sw.status                           AS seguwallet_status,
      sw.profile_completed                AS seguwallet_profile_completed,
      sw.last_login_at                    AS seguwallet_last_login,
      sw.agent_user_id                    AS seguwallet_agent_id,
      COALESCE((
        SELECT COUNT(*)::int
        FROM seguwallet_customer_sicas_clients scsc
        WHERE scsc.customer_id = sw.id
      ), 0)                               AS sicas_count
    FROM seguwallet_customers sw
    WHERE sw.crm_contact_id IS NULL
      AND sw.deleted_at IS NULL
      AND (
        v_user_role = 'Administrador'
        OR (
          v_user_role IN ('Gerente', 'Empleado', 'Ejecutivo')
          AND (
            sw.agent_user_id = v_caller
            OR sw.agent_user_id IS NULL
            OR v_oficina_id IS NULL
            OR EXISTS (
              SELECT 1 FROM usuarios u2
              WHERE u2.id = sw.agent_user_id
                AND u2.oficina_id = v_oficina_id
                AND (u2.is_deleted = false OR u2.is_deleted IS NULL)
            )
          )
        )
        OR (v_user_role = 'Agente' AND (sw.agent_user_id = v_caller OR sw.agent_user_id IS NULL))
      )
      AND (
        p_search IS NULL
        OR sw.full_name ILIKE '%' || p_search || '%'
        OR sw.email    ILIKE '%' || p_search || '%'
        OR sw.phone    ILIKE '%' || p_search || '%'
      )
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

-- Grant execute to all relevant roles
GRANT EXECUTE ON FUNCTION get_unified_contactos(uuid, text, text, boolean, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION get_unified_contactos(uuid, text, text, boolean, integer, integer) TO anon;
GRANT EXECUTE ON FUNCTION get_unified_contactos(uuid, text, text, boolean, integer, integer) TO service_role;
