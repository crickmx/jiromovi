/*
  # Corregir Nombres de Columnas en Función Pública

  1. Cambios
    - telefono_laboral -> celular_laboral
    - foto_perfil_url -> imagen_perfil_url
    - Mantener SECURITY INVOKER y permisos públicos
*/

-- Recrear la función con los nombres de columnas correctos
CREATE OR REPLACE FUNCTION get_public_web_page_by_slug(p_slug text)
RETURNS json
LANGUAGE plpgsql
SECURITY INVOKER
STABLE
AS $$
DECLARE
  v_result json;
BEGIN
  -- Buscar el usuario y construir el JSON completo
  SELECT json_build_object(
    'user', json_build_object(
      'id', u.id,
      'name', u.nombre_completo,
      'email', u.email_laboral,
      'phone', u.celular_laboral,
      'photo_url', u.imagen_perfil_url,
      'logo_url', COALESCE(u.mi_logotipo_url, o.logo_url, 
        'https://ui-avatars.com/api/?name=' || replace(o.nombre, ' ', '+') || '&size=200&background=2563eb&color=fff&bold=true&font-size=0.5'),
      'office', json_build_object(
        'name', o.nombre,
        'logo_url', COALESCE(o.logo_url, 
          'https://ui-avatars.com/api/?name=' || replace(o.nombre, ' ', '+') || '&size=200&background=2563eb&color=fff&bold=true&font-size=0.5')
      )
    ),
    'config', json_build_object(
      'primary_color', COALESCE(uwp.primary_color, '#2563eb'),
      'secondary_color', COALESCE(uwp.secondary_color, '#10b981'),
      'custom_text', COALESCE(uwp.custom_text, ''),
      'is_published', COALESCE(uwp.is_published, false)
    ),
    'insurers', COALESCE(
      (
        SELECT json_agg(
          json_build_object(
            'id', wpi.id,
            'name', wpi.name,
            'logo_url', wpi.logo_url,
            'website_url', wpi.website_url
          )
          ORDER BY wpi.display_order
        )
        FROM user_web_page_insurers uwpi
        JOIN web_page_insurers wpi ON wpi.id = uwpi.insurer_id
        WHERE uwpi.user_web_page_id = uwp.id
          AND wpi.is_active = true
      ),
      '[]'::json
    ),
    'categories', COALESCE(
      (
        SELECT json_agg(
          json_build_object(
            'id', wpc.id,
            'name', wpc.name,
            'slug', wpc.slug,
            'icon_url', wpc.icon_url,
            'lucide_icon', wpc.lucide_icon,
            'card_title', wpc.card_title,
            'card_description', wpc.card_description
          )
          ORDER BY wpc.display_order
        )
        FROM user_web_page_categories uwpc
        JOIN web_page_categories wpc ON wpc.id = uwpc.category_id
        WHERE uwpc.user_web_page_id = uwp.id
          AND wpc.is_active = true
      ),
      '[]'::json
    )
  ) INTO v_result
  FROM usuarios u
  LEFT JOIN oficinas o ON o.id = u.oficina_id
  LEFT JOIN user_web_pages uwp ON uwp.user_id = u.id
  WHERE u.web_slug = p_slug
    AND u.estado = 'activo'
    AND COALESCE(uwp.is_published, false) = true;

  RETURN v_result;
END;
$$;

-- Garantizar permisos públicos
GRANT EXECUTE ON FUNCTION get_public_web_page_by_slug(text) TO anon;
GRANT EXECUTE ON FUNCTION get_public_web_page_by_slug(text) TO authenticated;

-- Comentario
COMMENT ON FUNCTION get_public_web_page_by_slug IS 'Obtiene los datos de la página pública de un asesor por su slug. Acceso público sin autenticación.';
