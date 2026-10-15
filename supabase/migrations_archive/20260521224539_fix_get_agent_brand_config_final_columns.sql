/*
  # Fix get_agent_brand_config final column corrections

  1. Changes
    - Remove unused `correo_laboral` reference (not needed for brand config)
    - Verified columns: nombre, apellidos, oficina_id, nombre_publico, mi_logotipo_url, imagen_perfil_url
    - Office columns: nombre, logo_url, accent_color

  2. Notes
    - This is the final fix ensuring all column names match the actual schema
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
  v_brand jsonb;
BEGIN
  SELECT nombre, apellidos, oficina_id, nombre_publico,
    mi_logotipo_url, imagen_perfil_url
  INTO v_user
  FROM usuarios
  WHERE id = p_agent_id;

  IF v_user.oficina_id IS NOT NULL THEN
    SELECT nombre, logo_url, accent_color INTO v_office
    FROM oficinas WHERE id = v_user.oficina_id;
  END IF;

  v_brand := jsonb_build_object(
    'agent_name',       COALESCE(v_user.nombre_publico, v_user.nombre || ' ' || COALESCE(v_user.apellidos, '')),
    'office_name',      COALESCE(v_office.nombre, ''),
    'primary_color',    COALESCE(v_office.accent_color, '#2563eb'),
    'secondary_color',  '#1e40af',
    'logo_url',         COALESCE(v_user.mi_logotipo_url, v_user.imagen_perfil_url, v_office.logo_url, '/logojiro.png'),
    'footer_text',      'Formulario enviado a través de MOVI Digital.'
  );

  RETURN v_brand;
END;
$$;
