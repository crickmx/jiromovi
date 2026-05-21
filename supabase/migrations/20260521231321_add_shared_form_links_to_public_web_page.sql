/*
  # Add shared form links to public web page function

  1. Changes
    - Updates `get_public_web_page_by_slug` to also return a `form_links` array
    - `form_links` contains active shared_quote_form_links for the agent
    - Each entry includes: slug, form_title, form_type, quote_form_template_id
    - Ordered by created_at ascending

  2. Purpose
    - Allows the public agent page to dynamically show insurance types
      based on the agent's active shared quote form links
    - Replaces static web_page_categories with real form availability
*/

CREATE OR REPLACE FUNCTION get_public_web_page_by_slug(p_slug text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_user_record record;
  v_config record;
  v_result json;
  v_categories json;
  v_insurers json;
  v_form_links json;
BEGIN
  -- Find user by slug
  SELECT id, nombre, apellidos, nombre_publico, email_laboral,
         celular_laboral, mi_logotipo_url, imagen_perfil_url, oficina_id
  INTO v_user_record
  FROM usuarios
  WHERE slug = p_slug
    AND activo = true
    AND (deleted_at IS NULL)
  LIMIT 1;

  IF v_user_record.id IS NULL THEN
    RETURN NULL;
  END IF;

  v_user_id := v_user_record.id;

  -- Get web page config
  SELECT *
  INTO v_config
  FROM user_web_pages
  WHERE user_id = v_user_id
  LIMIT 1;

  -- Get categories
  SELECT COALESCE(json_agg(
    json_build_object(
      'id', wpc.id,
      'name', wpc.name,
      'description', wpc.description,
      'lucide_icon', wpc.lucide_icon,
      'orden', uwpc.orden
    ) ORDER BY uwpc.orden
  ), '[]'::json)
  INTO v_categories
  FROM user_web_page_categories uwpc
  JOIN web_page_categories wpc ON wpc.id = uwpc.category_id
  WHERE uwpc.user_id = v_user_id
    AND uwpc.is_active = true;

  -- Get insurers
  SELECT COALESCE(json_agg(
    json_build_object(
      'id', wpi.id,
      'name', wpi.name,
      'logo_url', wpi.logo_url
    ) ORDER BY wpi.name
  ), '[]'::json)
  INTO v_insurers
  FROM user_web_page_insurers uwpi
  JOIN web_page_insurers wpi ON wpi.id = uwpi.insurer_id
  WHERE uwpi.user_id = v_user_id
    AND uwpi.is_active = true;

  -- Get active shared quote form links
  SELECT COALESCE(json_agg(
    json_build_object(
      'slug', sqfl.slug,
      'form_title', sqfl.form_title,
      'form_type', sqfl.form_type,
      'form_slug', sqfl.form_slug,
      'quote_form_template_id', sqfl.quote_form_template_id
    ) ORDER BY sqfl.created_at
  ), '[]'::json)
  INTO v_form_links
  FROM shared_quote_form_links sqfl
  WHERE sqfl.agent_id = v_user_id
    AND sqfl.status = 'active';

  -- Build result
  v_result := json_build_object(
    'user', json_build_object(
      'id', v_user_record.id,
      'nombre', v_user_record.nombre,
      'apellidos', v_user_record.apellidos,
      'nombre_publico', v_user_record.nombre_publico,
      'email_laboral', v_user_record.email_laboral,
      'celular_laboral', v_user_record.celular_laboral,
      'mi_logotipo_url', v_user_record.mi_logotipo_url,
      'imagen_perfil_url', v_user_record.imagen_perfil_url,
      'oficina_id', v_user_record.oficina_id
    ),
    'config', CASE WHEN v_config IS NOT NULL THEN
      json_build_object(
        'id', v_config.id,
        'tagline', v_config.tagline,
        'about_text', v_config.about_text,
        'primary_color', v_config.primary_color,
        'secondary_color', v_config.secondary_color,
        'show_whatsapp_button', v_config.show_whatsapp_button,
        'show_email_button', v_config.show_email_button,
        'show_phone_button', v_config.show_phone_button,
        'custom_css', v_config.custom_css,
        'is_published', v_config.is_published,
        'custom_domain', v_config.custom_domain
      )
    ELSE NULL END,
    'categories', v_categories,
    'insurers', v_insurers,
    'form_links', v_form_links
  );

  RETURN v_result;
END;
$$;
