/*
  # Use Placeholder JIRO Logo
  
  1. Descripción
    - Usar un logo placeholder público hasta que se suba el logo real
    - Usar logo de ejemplo de UI Avatars como fallback temporal
    
  2. Cambios
    - Actualizar URL de fallback a una imagen pública disponible
*/

CREATE OR REPLACE FUNCTION get_public_web_page_by_slug(p_slug text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result json;
  v_supabase_url text := 'https://qhwvuuyjhcennqccgvse.supabase.co';
  -- Usar placeholder público mientras se sube el logo real
  v_jiro_logo text := 'https://ui-avatars.com/api/?name=JIRO&size=200&background=2563eb&color=fff&bold=true&font-size=0.5';
  v_user_logo text;
  v_office_logo text;
BEGIN
  SELECT 
    CASE 
      WHEN u.mi_logotipo_url IS NOT NULL AND u.mi_logotipo_url LIKE 'http%' THEN u.mi_logotipo_url
      ELSE NULL
    END,
    CASE 
      WHEN o.logo_url IS NOT NULL AND o.logo_url LIKE 'http%' THEN o.logo_url
      ELSE NULL
    END
  INTO v_user_logo, v_office_logo
  FROM usuarios u
  LEFT JOIN oficinas o ON o.id = u.oficina_id
  WHERE u.web_slug = p_slug
  AND u.estado = 'activo';

  SELECT json_build_object(
    'user', json_build_object(
      'id', u.id,
      'name', u.nombre_completo,
      'email', u.email_laboral,
      'phone', u.celular_laboral,
      'photo_url', u.imagen_perfil_url,
      'logo_url', COALESCE(v_user_logo, v_office_logo, v_jiro_logo),
      'office', json_build_object(
        'name', o.nombre,
        'logo_url', COALESCE(v_office_logo, v_jiro_logo)
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
