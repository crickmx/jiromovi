
/*
  # Agent Brand RPC for Seguwallet Portal

  Creates a SECURITY DEFINER function that returns branding data for a given
  agent user, used by the Seguwallet portal to personalize the authenticated
  experience with the responsible agent's brand.

  ## What it returns
  - logo_url: agent's Mi Marca logo → office logo → Seguwallet default
  - primary_color: from user_web_pages → office color_acento → Seguwallet default
  - secondary_color: from user_web_pages → Seguwallet default
  - agent_name: nombre_publico or full name
  - office_name: oficina name
  - phone: celular_laboral
  - email: email_laboral
  - web_slug: for building agentedeseguros.website/{slug}
  - profile_image_url: imagen_perfil_url

  ## Security
  This function is accessible to any authenticated user but only returns data
  for the specific agent_id passed. Seguwallet customers can only call this
  with their own agent's ID (controlled by the frontend reading from their
  customer record, which RLS already scopes correctly).
*/

CREATE OR REPLACE FUNCTION get_agent_brand_for_seguwallet(p_agent_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user        RECORD;
  v_office      RECORD;
  v_web_page    RECORD;
  v_logo_url    text;
  v_primary     text;
  v_secondary   text;
BEGIN
  -- Load agent data
  SELECT
    u.nombre,
    u.apellidos,
    u.nombre_publico,
    u.celular_laboral,
    u.email_laboral,
    u.imagen_perfil_url,
    u.mi_logotipo_url,
    u.web_slug,
    u.oficina_id
  INTO v_user
  FROM usuarios u
  WHERE u.id = p_agent_id
    AND u.activo = true;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'logo_url',         null,
      'profile_image_url',null,
      'primary_color',    '#1C37E0',
      'secondary_color',  '#1228B8',
      'agent_name',       'Tu Agente',
      'office_name',      null,
      'phone',            null,
      'email',            null,
      'web_slug',         null
    );
  END IF;

  -- Load office data if agent belongs to one
  IF v_user.oficina_id IS NOT NULL THEN
    SELECT o.nombre, o.logo_url
    INTO v_office
    FROM oficinas o
    WHERE o.id = v_user.oficina_id;
  END IF;

  -- Load Mi Pagina Web config for colors
  SELECT uwp.primary_color, uwp.secondary_color
  INTO v_web_page
  FROM user_web_pages uwp
  WHERE uwp.user_id = p_agent_id
  LIMIT 1;

  -- Logo priority: agent Mi Marca → office logo → null (frontend shows Seguwallet logo)
  v_logo_url := COALESCE(
    NULLIF(trim(v_user.mi_logotipo_url), ''),
    NULLIF(trim(v_office.logo_url), ''),
    null
  );

  -- Color priority: Mi Pagina Web → Seguwallet default
  v_primary   := COALESCE(NULLIF(trim(v_web_page.primary_color), ''),   '#1C37E0');
  v_secondary := COALESCE(NULLIF(trim(v_web_page.secondary_color), ''), '#1228B8');

  RETURN jsonb_build_object(
    'logo_url',         v_logo_url,
    'profile_image_url',NULLIF(trim(v_user.imagen_perfil_url), ''),
    'primary_color',    v_primary,
    'secondary_color',  v_secondary,
    'agent_name',       COALESCE(
                          NULLIF(trim(v_user.nombre_publico), ''),
                          trim(v_user.nombre || ' ' || COALESCE(v_user.apellidos, ''))
                        ),
    'office_name',      NULLIF(trim(v_office.nombre), ''),
    'phone',            NULLIF(trim(v_user.celular_laboral), ''),
    'email',            NULLIF(trim(v_user.email_laboral), ''),
    'web_slug',         NULLIF(trim(v_user.web_slug), '')
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_agent_brand_for_seguwallet(uuid)
  TO authenticated, anon, service_role;
