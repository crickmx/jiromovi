/*
  # Update public web page function to return all form templates

  1. Changes
    - `get_public_web_page_by_slug` now returns a `form_templates` array with ALL active templates
    - Each template includes a `is_featured` boolean and `featured_order` from user_web_featured_forms
    - Keeps backward-compatible `form_links` for existing shared links
    - Default featured types (auto_individual, vida_individual, gmm_individual, hogar_casa_habitacion, accidentes_personales_individual, empresa_paquete) used when user has no configuration

  2. Purpose
    - All users show all insurance types on their public page by default
    - Featured ones (3-6) are highlighted prominently
    - No manual link generation needed - templates are shown directly
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
  v_form_templates json;
  v_has_featured boolean;
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

  -- Get web page config
  SELECT *
  INTO v_config
  FROM user_web_pages
  WHERE user_id = v_user_id
  LIMIT 1;

  -- Check if user has configured any featured forms
  SELECT EXISTS(
    SELECT 1 FROM user_web_featured_forms WHERE user_id = v_user_id
  ) INTO v_has_featured;

  -- Get all active form templates with featured status
  SELECT COALESCE(json_agg(
    json_build_object(
      'id', qft.id,
      'form_type', qft.form_type,
      'title', qft.title,
      'category', qft.category,
      'icon', qft.icon,
      'slug', qft.slug,
      'is_featured', CASE
        WHEN v_has_featured THEN (uwff.id IS NOT NULL)
        ELSE (qft.form_type IN ('auto_individual', 'vida_individual', 'gmm_individual', 'hogar_casa_habitacion', 'accidentes_personales_individual', 'empresa_paquete'))
      END,
      'featured_order', CASE
        WHEN v_has_featured THEN COALESCE(uwff.featured_order, 999)
        ELSE CASE qft.form_type
          WHEN 'auto_individual' THEN 1
          WHEN 'vida_individual' THEN 2
          WHEN 'gmm_individual' THEN 3
          WHEN 'hogar_casa_habitacion' THEN 4
          WHEN 'accidentes_personales_individual' THEN 5
          WHEN 'empresa_paquete' THEN 6
          ELSE 999
        END
      END
    ) ORDER BY
      CASE
        WHEN v_has_featured THEN COALESCE(uwff.featured_order, 999)
        ELSE CASE qft.form_type
          WHEN 'auto_individual' THEN 1
          WHEN 'vida_individual' THEN 2
          WHEN 'gmm_individual' THEN 3
          WHEN 'hogar_casa_habitacion' THEN 4
          WHEN 'accidentes_personales_individual' THEN 5
          WHEN 'empresa_paquete' THEN 6
          ELSE 999
        END
      END,
      qft.category, qft.title
  ), '[]'::json)
  INTO v_form_templates
  FROM quote_form_templates qft
  LEFT JOIN user_web_featured_forms uwff
    ON uwff.form_template_id = qft.id AND uwff.user_id = v_user_id
  WHERE qft.is_active = true;

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
  WHERE uwpi.user_web_page_id = (SELECT id FROM user_web_pages WHERE user_id = v_user_id LIMIT 1);

  -- Get active shared quote form links (for backward compat)
  SELECT COALESCE(json_agg(
    json_build_object(
      'slug', sqfl.slug,
      'form_title', sqfl.form_title,
      'form_type', sqfl.form_type,
      'form_slug', sqfl.form_slug,
      'quote_form_template_id', sqfl.quote_form_template_id,
      'featured_on_website', sqfl.featured_on_website,
      'featured_order', sqfl.featured_order
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
        'primary_color', v_config.primary_color,
        'secondary_color', v_config.secondary_color,
        'custom_text', v_config.custom_text,
        'is_published', v_config.is_published
      )
    ELSE NULL END,
    'insurers', v_insurers,
    'form_links', v_form_links,
    'form_templates', v_form_templates
  );

  RETURN v_result;
END;
$$;
