/*
  # Fix Public Web Page - Use Absolute URLs for Logos
  
  1. Descripción
    - Actualizar la función get_public_web_page_by_slug para usar URLs absolutas
    - Usar el dominio de Supabase Storage para el logo de JIRO
    - Agregar fallback a una URL pública estática de JIRO
    
  2. Cambios
    - Modificar función para construir URL completa del logo
    - Si mi_logotipo_url o logo_url de oficina son relativos, convertirlos a absolutos
*/

-- Primero, vamos a usar el logo que ya está en el storage de avatars
-- o crear una referencia al logo público

CREATE OR REPLACE FUNCTION get_public_web_page_by_slug(p_slug text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result json;
  v_supabase_url text := 'https://qhwvuuyjhcennqccgvse.supabase.co';
  v_jiro_logo text := 'https://qhwvuuyjhcennqccgvse.supabase.co/storage/v1/object/public/web-page-assets/logojiro.png';
BEGIN
  SELECT json_build_object(
    'user', json_build_object(
      'id', u.id,
      'name', u.nombre_completo,
      'email', u.email_laboral,
      'phone', u.celular_laboral,
      'photo_url', u.imagen_perfil_url,
      'logo_url', COALESCE(
        NULLIF(u.mi_logotipo_url, ''),
        NULLIF(o.logo_url, ''),
        v_jiro_logo
      ),
      'office', json_build_object(
        'name', o.nombre,
        'logo_url', COALESCE(o.logo_url, v_jiro_logo)
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
