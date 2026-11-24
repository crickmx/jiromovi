/*
  # Update get_public_web_page_by_slug to include featured fields

  1. Changes
    - Adds `featured_on_website` and `featured_order` to the form_links JSON output
    - Orders form_links by featured_order (nulls last), then created_at

  2. Purpose
    - Allows the public page to use agent-configured featured selections when available
    - Falls back to keyword-based defaults when no manual configuration exists
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
  v_office record;
  v_web_page_id uuid;
  v_result json;
  v_categories json;
  v_insurers json;
  v_form_links json;
  v_user_name text;
BEGIN
  -- Find user by web_slug
  SELECT id, nombre, apellidos, nombre_publico, email_laboral,
         celular_laboral, mi_logotipo_url, imagen_perfil_url, oficina_id
  INTO v_user_record
  FROM usuarios
  WHERE web_slug = p_slug
    AND activo = true
    AND (deleted_at IS NULL)
  LIMIT 1;

  IF v_user_record.id IS NULL THEN
    RETURN NULL;
  END IF;

  v_user_id := v_user_record.id;

  -- Build display name
  v_user_name := COALESCE(
    NULLIF(TRIM(v_user_record.nombre_publico), ''),
    TRIM(COALESCE(v_user_record.nombre, '') || ' ' || COALESCE(v_user_record.apellidos, ''))
  );

  -- Get office info
  IF v_user_record.oficina_id IS NOT NULL THEN
    SELECT nombre, logo_url
    INTO v_office
    FROM oficinas
    WHERE id = v_user_record.oficina_id
    LIMIT 1;
  END IF;

  -- Get web page config
  SELECT id, primary_color, secondary_color, custom_text, is_published
  INTO v_config
  FROM user_web_pages
  WHERE user_id = v_user_id
  LIMIT 1;

  -- If no config or not published, return NULL
  IF v_config IS NULL OR v_config.is_published = false THEN
    RETURN NULL;
  END IF;

  v_web_page_id := v_config.id;

  -- Get categories via user_web_page_id
  SELECT COALESCE(json_agg(
    json_build_object(
      'id', wpc.id,
      'name', wpc.name,
      'slug', wpc.slug,
      'icon_url', wpc.icon_url,
      'lucide_icon', wpc.lucide_icon,
      'card_title', wpc.card_title,
      'card_description', wpc.card_description
    ) ORDER BY wpc.display_order
  ), '[]'::json)
  INTO v_categories
  FROM user_web_page_categories uwpc
  JOIN web_page_categories wpc ON wpc.id = uwpc.category_id
  WHERE uwpc.user_web_page_id = v_web_page_id
    AND wpc.is_active = true;

  -- Get insurers via user_web_page_id
  SELECT COALESCE(json_agg(
    json_build_object(
      'id', wpi.id,
      'name', wpi.name,
      'logo_url', wpi.logo_url,
      'website_url', wpi.website_url
    ) ORDER BY wpi.display_order
  ), '[]'::json)
  INTO v_insurers
  FROM user_web_page_insurers uwpi
  JOIN web_page_insurers wpi ON wpi.id = uwpi.insurer_id
  WHERE uwpi.user_web_page_id = v_web_page_id
    AND wpi.is_active = true;

  -- Get active shared quote form links with featured info
  SELECT COALESCE(json_agg(
    json_build_object(
      'slug', sqfl.slug,
      'form_title', sqfl.form_title,
      'form_type', sqfl.form_type,
      'form_slug', sqfl.form_slug,
      'quote_form_template_id', sqfl.quote_form_template_id,
      'featured_on_website', COALESCE(sqfl.featured_on_website, false),
      'featured_order', sqfl.featured_order
    ) ORDER BY sqfl.featured_order NULLS LAST, sqfl.created_at
  ), '[]'::json)
  INTO v_form_links
  FROM shared_quote_form_links sqfl
  WHERE sqfl.agent_id = v_user_id
    AND sqfl.status = 'active';

  -- Build result matching PublicWebPageData interface
  v_result := json_build_object(
    'user', json_build_object(
      'id', v_user_record.id,
      'name', v_user_name,
      'email', v_user_record.email_laboral,
      'phone', v_user_record.celular_laboral,
      'photo_url', v_user_record.imagen_perfil_url,
      'logo_url', v_user_record.mi_logotipo_url,
      'office', CASE WHEN v_office IS NOT NULL THEN
        json_build_object(
          'name', v_office.nombre,
          'logo_url', v_office.logo_url
        )
      ELSE NULL END
    ),
    'config', json_build_object(
      'primary_color', v_config.primary_color,
      'secondary_color', v_config.secondary_color,
      'custom_text', COALESCE(v_config.custom_text, ''),
      'is_published', v_config.is_published
    ),
    'categories', v_categories,
    'insurers', v_insurers,
    'form_links', v_form_links
  );

  RETURN v_result;
END;
$$;
