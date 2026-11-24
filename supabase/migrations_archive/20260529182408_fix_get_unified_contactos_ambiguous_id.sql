/*
  # Fix get_unified_contactos - resolve ambiguous column reference

  The function had "WHERE id = v_caller" which is ambiguous because 'id' is also
  a return column. Fixed by using table alias "u.id = v_caller".
*/

DROP FUNCTION IF EXISTS get_unified_contactos(uuid, text, text, boolean, integer, integer);

CREATE OR REPLACE FUNCTION get_unified_contactos(
  p_user_id        uuid    DEFAULT NULL,
  p_search         text    DEFAULT NULL,
  p_estatus        text    DEFAULT NULL,
  p_has_seguwallet boolean DEFAULT NULL,
  p_limit          integer DEFAULT 200,
  p_offset         integer DEFAULT 0
)
RETURNS TABLE(
  id                           uuid,
  source                       text,
  nombre_completo              text,
  email                        text,
  celular                      text,
  whatsapp                     text,
  tipo_contacto                text,
  estatus                      text,
  fuente_origen                text,
  creado_por                   uuid,
  fecha_creacion               timestamptz,
  actualizado_en               timestamptz,
  seguwallet_customer_id       uuid,
  seguwallet_status            text,
  seguwallet_profile_completed boolean,
  seguwallet_last_login        timestamptz,
  seguwallet_agent_id          uuid,
  sicas_count                  integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_caller     uuid;
  v_user_role  text;
  v_oficina_id uuid;
BEGIN
  -- Resolve caller: explicit param first, then auth.uid()
  v_caller := COALESCE(p_user_id, auth.uid());

  IF v_caller IS NULL THEN
    RETURN;
  END IF;

  -- Use explicit table alias to avoid ambiguity with the 'id' return column
  SELECT u.rol, u.oficina_id
  INTO v_user_role, v_oficina_id
  FROM usuarios u
  WHERE u.id = v_caller
    AND (u.is_deleted = false OR u.is_deleted IS NULL)
  LIMIT 1;

  IF v_user_role IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH crm_with_sw AS (
    SELECT
      c.id                                   AS r_id,
      'crm'::text                            AS r_source,
      c.nombre_completo                      AS r_nombre_completo,
      c.email                                AS r_email,
      c.celular                              AS r_celular,
      c.whatsapp                             AS r_whatsapp,
      c.tipo_contacto                        AS r_tipo_contacto,
      c.estatus                              AS r_estatus,
      c.fuente_origen                        AS r_fuente_origen,
      c.creado_por                           AS r_creado_por,
      c.fecha_creacion                       AS r_fecha_creacion,
      c.actualizado_en                       AS r_actualizado_en,
      sw.id                                  AS r_sw_id,
      sw.status                              AS r_sw_status,
      sw.profile_completed                   AS r_sw_profile_completed,
      sw.last_login_at                       AS r_sw_last_login,
      sw.agent_user_id                       AS r_sw_agent_id,
      COALESCE((
        SELECT COUNT(*)::int
        FROM seguwallet_customer_sicas_clients scsc
        WHERE scsc.customer_id = sw.id
      ), 0)                                  AS r_sicas_count
    FROM crm_contactos c
    LEFT JOIN seguwallet_customers sw
      ON sw.crm_contact_id = c.id
     AND sw.deleted_at IS NULL
    WHERE
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
        OR c.email           ILIKE '%' || p_search || '%'
        OR c.celular         ILIKE '%' || p_search || '%'
      )
      AND (p_estatus IS NULL OR c.estatus = p_estatus)
      AND (
        p_has_seguwallet IS NULL
        OR (p_has_seguwallet = true  AND sw.id IS NOT NULL)
        OR (p_has_seguwallet = false AND sw.id IS NULL)
      )
  ),
  sw_without_crm AS (
    SELECT
      sw.id                                        AS r_id,
      'seguwallet'::text                           AS r_source,
      sw.full_name                                 AS r_nombre_completo,
      sw.email                                     AS r_email,
      sw.phone                                     AS r_celular,
      sw.whatsapp                                  AS r_whatsapp,
      'Persona'::text                              AS r_tipo_contacto,
      'Cliente'::text                              AS r_estatus,
      'Seguwallet'::text                           AS r_fuente_origen,
      COALESCE(sw.agent_user_id, v_caller)         AS r_creado_por,
      sw.created_at                                AS r_fecha_creacion,
      sw.updated_at                                AS r_actualizado_en,
      sw.id                                        AS r_sw_id,
      sw.status                                    AS r_sw_status,
      sw.profile_completed                         AS r_sw_profile_completed,
      sw.last_login_at                             AS r_sw_last_login,
      sw.agent_user_id                             AS r_sw_agent_id,
      COALESCE((
        SELECT COUNT(*)::int
        FROM seguwallet_customer_sicas_clients scsc
        WHERE scsc.customer_id = sw.id
      ), 0)                                        AS r_sicas_count
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
        OR sw.email     ILIKE '%' || p_search || '%'
        OR sw.phone     ILIKE '%' || p_search || '%'
      )
      AND (p_estatus IS NULL OR p_estatus = 'Cliente')
      AND (p_has_seguwallet IS NULL OR p_has_seguwallet = true)
  )
  SELECT
    r_id, r_source, r_nombre_completo, r_email, r_celular, r_whatsapp,
    r_tipo_contacto, r_estatus, r_fuente_origen, r_creado_por,
    r_fecha_creacion, r_actualizado_en,
    r_sw_id, r_sw_status, r_sw_profile_completed, r_sw_last_login, r_sw_agent_id,
    r_sicas_count
  FROM crm_with_sw
  UNION ALL
  SELECT
    r_id, r_source, r_nombre_completo, r_email, r_celular, r_whatsapp,
    r_tipo_contacto, r_estatus, r_fuente_origen, r_creado_por,
    r_fecha_creacion, r_actualizado_en,
    r_sw_id, r_sw_status, r_sw_profile_completed, r_sw_last_login, r_sw_agent_id,
    r_sicas_count
  FROM sw_without_crm
  ORDER BY r_fecha_creacion DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION get_unified_contactos(uuid, text, text, boolean, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION get_unified_contactos(uuid, text, text, boolean, integer, integer) TO anon;
GRANT EXECUTE ON FUNCTION get_unified_contactos(uuid, text, text, boolean, integer, integer) TO service_role;
