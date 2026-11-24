/*
  # Fix get_unified_contactos - correct seguwallet_customers column names
  agent_id → agent_user_id, nombre_completo → full_name, last_login → last_login_at
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
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_caller      uuid;
  v_rol         text;
  v_oficina_id  uuid;
BEGIN
  v_caller := COALESCE(p_user_id, auth.uid());

  SELECT u.rol, u.oficina_id
    INTO v_rol, v_oficina_id
    FROM usuarios u
   WHERE u.id = v_caller
   LIMIT 1;

  RETURN QUERY
  WITH crm_with_sw AS (
    SELECT
      c.id                                                       AS cws_id,
      'crm'::text                                               AS cws_source,
      c.nombre_completo                                         AS cws_nombre_completo,
      c.email                                                   AS cws_email,
      c.celular                                                 AS cws_celular,
      c.whatsapp                                                AS cws_whatsapp,
      c.tipo_contacto                                           AS cws_tipo_contacto,
      c.estatus                                                 AS cws_estatus,
      c.fuente_origen                                           AS cws_fuente_origen,
      c.creado_por                                              AS cws_creado_por,
      c.fecha_creacion                                          AS cws_fecha_creacion,
      c.actualizado_en                                          AS cws_actualizado_en,
      sw.id                                                     AS cws_sw_id,
      sw.status                                                 AS cws_sw_status,
      sw.profile_completed                                      AS cws_sw_profile_completed,
      sw.last_login_at                                          AS cws_sw_last_login,
      sw.agent_user_id                                          AS cws_sw_agent_id,
      COALESCE((
        SELECT COUNT(*)::integer
          FROM seguwallet_customer_sicas_clients scsc
         WHERE scsc.seguwallet_customer_id = sw.id
      ), 0)                                                     AS cws_sicas_count
    FROM crm_contactos c
    LEFT JOIN seguwallet_customers sw ON sw.crm_contact_id = c.id
    WHERE
      (
        v_rol = 'Administrador'
        OR (
          v_rol IN ('Gerente','Empleado','Ejecutivo')
          AND (
            c.creado_por = v_caller
            OR EXISTS (
              SELECT 1 FROM usuarios u2
               WHERE u2.id = c.creado_por
                 AND u2.oficina_id = v_oficina_id
            )
          )
        )
        OR (
          v_rol = 'Agente'
          AND c.creado_por = v_caller
        )
        OR c.creado_por = v_caller
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
  sw_only AS (
    SELECT
      sw2.id                                                    AS so_id,
      'seguwallet'::text                                        AS so_source,
      COALESCE(sw2.full_name, sw2.email, 'Sin nombre')         AS so_nombre_completo,
      sw2.email                                                 AS so_email,
      sw2.phone                                                 AS so_celular,
      sw2.whatsapp                                              AS so_whatsapp,
      'Cliente Seguwallet'::text                               AS so_tipo_contacto,
      CASE WHEN sw2.status = 'active' THEN 'activo' ELSE 'inactivo' END AS so_estatus,
      'seguwallet'::text                                        AS so_fuente_origen,
      sw2.agent_user_id                                         AS so_creado_por,
      sw2.created_at                                            AS so_fecha_creacion,
      sw2.updated_at                                            AS so_actualizado_en,
      sw2.id                                                    AS so_sw_id,
      sw2.status                                                AS so_sw_status,
      sw2.profile_completed                                     AS so_sw_profile_completed,
      sw2.last_login_at                                         AS so_sw_last_login,
      sw2.agent_user_id                                         AS so_sw_agent_id,
      COALESCE((
        SELECT COUNT(*)::integer
          FROM seguwallet_customer_sicas_clients scsc2
         WHERE scsc2.seguwallet_customer_id = sw2.id
      ), 0)                                                     AS so_sicas_count
    FROM seguwallet_customers sw2
    WHERE sw2.crm_contact_id IS NULL
      AND sw2.deleted_at IS NULL
      AND (
        v_rol = 'Administrador'
        OR (
          v_rol IN ('Gerente','Empleado','Ejecutivo')
          AND sw2.agent_user_id IN (
            SELECT u3.id FROM usuarios u3 WHERE u3.oficina_id = v_oficina_id
          )
        )
        OR sw2.agent_user_id = v_caller
      )
      AND (
        p_search IS NULL
        OR COALESCE(sw2.full_name,'') ILIKE '%' || p_search || '%'
        OR sw2.email                  ILIKE '%' || p_search || '%'
        OR sw2.phone                  ILIKE '%' || p_search || '%'
      )
      AND (p_has_seguwallet IS NULL OR p_has_seguwallet = true)
  )
  SELECT
    cws_id,
    cws_source,
    cws_nombre_completo,
    cws_email,
    cws_celular,
    cws_whatsapp,
    cws_tipo_contacto,
    cws_estatus,
    cws_fuente_origen,
    cws_creado_por,
    cws_fecha_creacion,
    cws_actualizado_en,
    cws_sw_id,
    cws_sw_status,
    cws_sw_profile_completed,
    cws_sw_last_login,
    cws_sw_agent_id,
    cws_sicas_count
  FROM crm_with_sw

  UNION ALL

  SELECT
    so_id,
    so_source,
    so_nombre_completo,
    so_email,
    so_celular,
    so_whatsapp,
    so_tipo_contacto,
    so_estatus,
    so_fuente_origen,
    so_creado_por,
    so_fecha_creacion,
    so_actualizado_en,
    so_sw_id,
    so_sw_status,
    so_sw_profile_completed,
    so_sw_last_login,
    so_sw_agent_id,
    so_sicas_count
  FROM sw_only

  ORDER BY 11 DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION get_unified_contactos(uuid, text, text, boolean, integer, integer) TO authenticated;
