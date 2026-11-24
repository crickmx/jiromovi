/*
  # Unificación Contactos CRM + Clientes Seguwallet

  ## Resumen
  Vincula los clientes Seguwallet existentes con los contactos CRM, creando una base
  unificada de contactos comerciales bajo "Comercial > Contactos".

  ## Cambios

  ### 1. Tabla `seguwallet_customers`
  - Agrega `crm_contact_id` (FK nullable a crm_contactos.id)

  ### 2. Función `get_unified_contactos`
  - Retorna vista unificada: contactos CRM + clientes Seguwallet sin CRM
  - Respeta visibilidad por rol

  ### 3. Funciones auxiliares
  - `link_seguwallet_to_crm_contact`: vincula/crea contacto CRM para un cliente Seguwallet
  - `migrate_all_seguwallet_to_crm`: migra todos los clientes Seguwallet existentes

  ## Seguridad
  - Funciones SECURITY DEFINER
  - Agentes solo ven sus propios contactos
*/

-- 1. Agregar crm_contact_id a seguwallet_customers
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'seguwallet_customers' AND column_name = 'crm_contact_id'
  ) THEN
    ALTER TABLE seguwallet_customers
    ADD COLUMN crm_contact_id uuid REFERENCES crm_contactos(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_seguwallet_customers_crm_contact_id
  ON seguwallet_customers(crm_contact_id);

-- 2. Función principal: vista unificada de contactos
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
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_user_role text;
BEGIN
  SELECT rol INTO v_user_role FROM usuarios WHERE id = v_user_id;

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
      (v_user_role IN ('Administrador', 'Gerente', 'Empleado', 'Ejecutivo')
       OR c.creado_por = v_user_id)
      AND (p_search IS NULL OR
           c.nombre_completo ILIKE '%' || p_search || '%' OR
           c.email ILIKE '%' || p_search || '%' OR
           c.celular ILIKE '%' || p_search || '%')
      AND (p_estatus IS NULL OR c.estatus = p_estatus)
      AND (p_has_seguwallet IS NULL OR
           (p_has_seguwallet = true AND sw.id IS NOT NULL) OR
           (p_has_seguwallet = false AND sw.id IS NULL))
  ),
  sw_without_crm AS (
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
      AND (v_user_role IN ('Administrador', 'Gerente', 'Empleado', 'Ejecutivo')
           OR sw.agent_user_id = v_user_id)
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

-- 3. Función para vincular/crear contacto CRM para un cliente Seguwallet
CREATE OR REPLACE FUNCTION link_seguwallet_to_crm_contact(
  p_customer_id uuid,
  p_crm_contact_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sw seguwallet_customers%ROWTYPE;
  v_contact_id uuid;
  v_existing_contact_id uuid;
BEGIN
  SELECT * INTO v_sw FROM seguwallet_customers WHERE id = p_customer_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Seguwallet customer not found';
  END IF;

  IF p_crm_contact_id IS NOT NULL THEN
    UPDATE seguwallet_customers SET crm_contact_id = p_crm_contact_id WHERE id = p_customer_id;
    RETURN p_crm_contact_id;
  END IF;

  IF v_sw.email IS NOT NULL AND v_sw.email != '' THEN
    SELECT id INTO v_existing_contact_id
    FROM crm_contactos
    WHERE email = v_sw.email
    LIMIT 1;
  END IF;

  IF v_existing_contact_id IS NULL AND v_sw.phone IS NOT NULL AND v_sw.phone != '' THEN
    SELECT id INTO v_existing_contact_id
    FROM crm_contactos
    WHERE celular = v_sw.phone
    LIMIT 1;
  END IF;

  IF v_existing_contact_id IS NOT NULL THEN
    UPDATE seguwallet_customers SET crm_contact_id = v_existing_contact_id WHERE id = p_customer_id;
    RETURN v_existing_contact_id;
  ELSE
    INSERT INTO crm_contactos (
      tipo_contacto, nombre_completo, celular, email, whatsapp,
      estatus, fuente_origen, creado_por, fecha_creacion
    ) VALUES (
      'Persona',
      v_sw.full_name,
      COALESCE(v_sw.phone, ''),
      v_sw.email,
      v_sw.whatsapp,
      'Cliente',
      'Seguwallet',
      v_sw.agent_user_id,
      v_sw.created_at
    )
    RETURNING id INTO v_contact_id;

    UPDATE seguwallet_customers SET crm_contact_id = v_contact_id WHERE id = p_customer_id;
    RETURN v_contact_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION link_seguwallet_to_crm_contact TO authenticated;
GRANT EXECUTE ON FUNCTION link_seguwallet_to_crm_contact TO service_role;

-- 4. Migrar todos los clientes Seguwallet existentes a contactos CRM
CREATE OR REPLACE FUNCTION migrate_all_seguwallet_to_crm()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int := 0;
  v_customer seguwallet_customers%ROWTYPE;
BEGIN
  FOR v_customer IN
    SELECT * FROM seguwallet_customers
    WHERE crm_contact_id IS NULL AND deleted_at IS NULL
  LOOP
    PERFORM link_seguwallet_to_crm_contact(v_customer.id);
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION migrate_all_seguwallet_to_crm TO service_role;
GRANT EXECUTE ON FUNCTION migrate_all_seguwallet_to_crm TO authenticated;

-- 5. Run migration for existing seguwallet customers immediately
SELECT migrate_all_seguwallet_to_crm();
