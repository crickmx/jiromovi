/*
  # Enhance get_agent_brand_config with full brand data

  1. Changes
    - Add agent_slug (web_slug) for Home button link
    - Add profile_image_url separate from logo
    - Add secondary_color from user_web_pages or office
    - Add agent_whatsapp for success page contact button

  2. Notes
    - Color priority: user_web_pages > office accent_color > default
    - Logo priority: mi_logotipo_url > office logo > default
    - Profile priority: imagen_perfil_url > null (frontend shows initials)
*/

CREATE OR REPLACE FUNCTION get_agent_brand_config(p_agent_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user RECORD;
  v_office RECORD;
  v_web RECORD;
  v_brand jsonb;
  v_primary text;
  v_secondary text;
BEGIN
  SELECT nombre, apellidos, oficina_id, nombre_publico,
    mi_logotipo_url, imagen_perfil_url, web_slug, celular_laboral
  INTO v_user
  FROM usuarios
  WHERE id = p_agent_id;

  IF v_user.oficina_id IS NOT NULL THEN
    SELECT nombre, logo_url, accent_color INTO v_office
    FROM oficinas WHERE id = v_user.oficina_id;
  END IF;

  SELECT primary_color, secondary_color INTO v_web
  FROM user_web_pages WHERE user_id = p_agent_id LIMIT 1;

  -- Color priority: web_pages > office > default
  v_primary := COALESCE(v_web.primary_color, v_office.accent_color, '#2563eb');
  v_secondary := COALESCE(v_web.secondary_color, '#1e40af');

  v_brand := jsonb_build_object(
    'agent_name',         COALESCE(v_user.nombre_publico, v_user.nombre || ' ' || COALESCE(v_user.apellidos, '')),
    'office_name',        COALESCE(v_office.nombre, ''),
    'primary_color',      v_primary,
    'secondary_color',    v_secondary,
    'logo_url',           COALESCE(v_user.mi_logotipo_url, v_office.logo_url, '/logojiro.png'),
    'profile_image_url',  v_user.imagen_perfil_url,
    'agent_slug',         v_user.web_slug,
    'agent_whatsapp',     v_user.celular_laboral,
    'footer_text',        'Formulario enviado a través de MOVI Digital.'
  );

  RETURN v_brand;
END;
$$;
