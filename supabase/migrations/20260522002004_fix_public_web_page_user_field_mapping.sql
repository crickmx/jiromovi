/*
  # Fix public web page RPC user field name mapping

  1. Problem
    - The `get_public_web_page_by_slug` function returns raw DB column names 
      (nombre, apellidos, nombre_publico, mi_logotipo_url, imagen_perfil_url, oficina_id)
    - The frontend expects mapped field names (name, email, phone, logo_url, photo_url, office)
    - This causes "undefined | Asesor de Seguros" in page title and missing images

  2. Fix
    - Map DB column names to the expected interface field names
    - Use COALESCE(nombre_publico, nombre || ' ' || apellidos) for the 'name' field
    - Include office object with name and logo by joining oficinas table
    - Keep all form_templates logic unchanged

  3. Fields mapped
    - nombre/apellidos/nombre_publico -> name
    - email_laboral -> email
    - celular_laboral -> phone
    - mi_logotipo_url -> logo_url
    - imagen_perfil_url -> photo_url
    - oficina_id -> office { name, logo_url }
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
  v_office_record record;
  v_result json;
  v_categories json;
  v_insurers json;
  v_form_links json;
  v_form_templates json;
  v_has_featured boolean;
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

  -- Build user display name: prefer nombre_publico, fallback to nombre + apellidos
  v_user_name := COALESCE(
    NULLIF(TRIM(v_user_record.nombre_publico), ''),
    TRIM(COALESCE(v_user_record.nombre, '') || ' ' || COALESCE(v_user_record.apellidos, ''))
  );

  -- Get office info
  IF v_user_record.oficina_id IS NOT NULL THEN
    SELECT nombre, logo_url
    INTO v_office_record
    FROM oficinas
    WHERE id = v_user_record.oficina_id
    LIMIT 1;
  END IF;

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

  -- Build result with properly mapped field names matching PublicWebPageData interface
  v_result := json_build_object(
    'user', json_build_object(
      'id', v_user_record.id,
      'name', v_user_name,
      'email', v_user_record.email_laboral,
      'phone', v_user_record.celular_laboral,
      'photo_url', v_user_record.imagen_perfil_url,
      'logo_url', v_user_record.mi_logotipo_url,
      'office', CASE 
        WHEN v_office_record.nombre IS NOT NULL THEN
          json_build_object(
            'name', v_office_record.nombre,
            'logo_url', v_office_record.logo_url
          )
        ELSE NULL
      END
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
