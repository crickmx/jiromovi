/*
  # Fix Avatar URL to use static file

  1. Problema
    - Los usuarios sin avatar personalizado deben mostrar /display-avatar.png
    - No deben mostrar iniciales generadas dinámicamente

  2. Solución
    - Usar la URL estática del archivo display-avatar.png desde el dominio de producción
    - Cuando imagen_perfil_url es '/display-avatar.png', usar URL absoluta del CDN

  3. Cambios
    - Actualizar función get_public_web_page_by_slug
    - Usar https://agentedeseguros.online/display-avatar.png como fallback
*/

CREATE OR REPLACE FUNCTION get_public_web_page_by_slug(p_slug text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_result json;
  v_base_url text := 'https://qhwvuuyjhcennqccgvse.supabase.co/storage/v1/object/public';
  v_app_url text := 'https://agentedeseguros.online';
BEGIN
  -- Construir el resultado completo
  SELECT json_build_object(
    'user', json_build_object(
      'id', u.id,
      'name', u.nombre_completo,
      'email', u.email_laboral,
      'phone', u.celular_laboral,
      'photo_url', 
        CASE 
          -- Si es la ruta relativa del avatar genérico, usar URL de producción
          WHEN u.imagen_perfil_url = '/display-avatar.png' THEN
            v_app_url || '/display-avatar.png'
          -- Si es una ruta relativa del storage de Supabase
          WHEN u.imagen_perfil_url LIKE '/avatars/%' THEN
            v_base_url || u.imagen_perfil_url
          WHEN u.imagen_perfil_url LIKE '/publicidad/%' THEN
            v_base_url || u.imagen_perfil_url
          -- Si es una ruta relativa cualquiera, usar URL de producción
          WHEN u.imagen_perfil_url LIKE '/%' THEN
            v_app_url || u.imagen_perfil_url
          -- Si ya es una URL absoluta, dejarla como está
          ELSE u.imagen_perfil_url
        END,
      'logo_url', 
        CASE
          -- Logo personal del usuario
          WHEN u.mi_logotipo_url IS NOT NULL THEN
            CASE
              WHEN u.mi_logotipo_url LIKE '/%' THEN v_app_url || u.mi_logotipo_url
              ELSE u.mi_logotipo_url
            END
          -- Logo de la oficina
          WHEN o.logo_url IS NOT NULL THEN
            CASE
              WHEN o.logo_url LIKE '/%' THEN v_app_url || o.logo_url
              ELSE o.logo_url
            END
          -- Fallback al logo de Jiro
          ELSE v_app_url || '/logojiro.png'
        END,
      'office', json_build_object(
        'name', o.nombre,
        'logo_url', 
          CASE
            WHEN o.logo_url IS NOT NULL THEN
              CASE
                WHEN o.logo_url LIKE '/%' THEN v_app_url || o.logo_url
                ELSE o.logo_url
              END
            ELSE v_app_url || '/logojiro.png'
          END
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
            'logo_url', 
              CASE
                WHEN wpi.logo_url LIKE '/%' THEN v_app_url || wpi.logo_url
                ELSE wpi.logo_url
              END,
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
COMMENT ON FUNCTION get_public_web_page_by_slug IS 'Obtiene los datos de la página pública de un asesor por su slug. Convierte rutas relativas a URLs absolutas del dominio de producción. SECURITY DEFINER para bypass de RLS.';