/*
  # Agregar fallback de logotipo y logo de JIRO en página pública

  1. Cambios
    - Agregar lógica de fallback para logo: mi_logotipo_url -> oficina logo -> logo JIRO
    - Incluir logo JIRO estático como fallback final
    
  2. Lógica de Fallback
    - Si usuario tiene mi_logotipo_url, usar ese
    - Si no, usar logo de oficina
    - Si no, usar logo de JIRO (/logojiro.png)
*/

CREATE OR REPLACE FUNCTION get_public_web_page_by_slug(p_slug text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result json;
BEGIN
  SELECT json_build_object(
    'user', json_build_object(
      'id', u.id,
      'name', u.nombre_completo,
      'email', u.email_laboral,
      'phone', u.celular_laboral,
      'photo_url', u.imagen_perfil_url,
      'logo_url', COALESCE(u.mi_logotipo_url, o.logo_url, '/logojiro.png'),
      'office', json_build_object(
        'name', o.nombre,
        'logo_url', o.logo_url
      )
    ),
    'config', json_build_object(
      'primary_color', uwp.primary_color,
      'secondary_color', uwp.secondary_color,
      'custom_text', uwp.custom_text,
      'is_published', uwp.is_published
    ),
    'insurers', (
      SELECT json_agg(json_build_object(
        'id', wpi.id,
        'name', wpi.name,
        'logo_url', wpi.logo_url,
        'website_url', wpi.website_url
      ) ORDER BY wpi.display_order)
      FROM user_web_page_insurers uwpi
      JOIN web_page_insurers wpi ON wpi.id = uwpi.insurer_id
      WHERE uwpi.user_web_page_id = uwp.id
      AND wpi.is_active = true
    ),
    'categories', (
      SELECT json_agg(json_build_object(
        'id', wpc.id,
        'name', wpc.name,
        'slug', wpc.slug,
        'icon_url', wpc.icon_url,
        'lucide_icon', wpc.lucide_icon,
        'card_title', wpc.card_title,
        'card_description', wpc.card_description
      ) ORDER BY wpc.display_order)
      FROM user_web_page_categories uwpc
      JOIN web_page_categories wpc ON wpc.id = uwpc.category_id
      WHERE uwpc.user_web_page_id = uwp.id
      AND wpc.is_active = true
    )
  ) INTO v_result
  FROM usuarios u
  LEFT JOIN oficinas o ON o.id = u.oficina_id
  LEFT JOIN user_web_pages uwp ON uwp.user_id = u.id
  WHERE u.web_slug = p_slug
  AND uwp.is_published = true
  AND u.estado = 'activo';

  RETURN v_result;
END;
$$;
