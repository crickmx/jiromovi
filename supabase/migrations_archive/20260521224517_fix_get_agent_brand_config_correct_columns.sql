/*
  # Fix get_agent_brand_config correct column names

  1. Changes
    - Fix `apellido_paterno`/`apellido_materno` → `apellidos`
    - Fix `color_acento` → `accent_color`
    - Fix `foto_perfil` → `mi_logotipo_url` with fallback to `imagen_perfil_url`
    - Logo priority: mi_logotipo_url > imagen_perfil_url > office logo_url > default

  2. Notes
    - Ensures the public quote form displays agent's actual brand colors and logo
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
    correo_laboral, mi_logotipo_url, imagen_perfil_url
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
