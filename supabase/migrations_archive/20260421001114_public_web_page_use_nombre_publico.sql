/*
  # Public web page uses nombre_publico with fallback

  1. Changes
    - `get_public_web_page_by_slug(p_slug)` now returns `user.name` as
      `COALESCE(NULLIF(trim(u.nombre_publico), ''), u.nombre_completo)`.
      This lets users override their display name for the public website
      without modifying their real name/apellidos.

  2. Security
    - Function remains SECURITY DEFINER STABLE. No policy changes.
*/

CREATE OR REPLACE FUNCTION public.get_public_web_page_by_slug(p_slug text)
RETURNS json
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_result json;
  v_base_url text := 'https://qhwvuuyjhcennqccgvse.supabase.co/storage/v1/object/public';
  v_app_url text := 'https://agentedeseguros.website';
  v_default_avatar text := 'https://qhwvuuyjhcennqccgvse.supabase.co/storage/v1/object/public/avatars/default-avatar.png';
BEGIN
  SELECT json_build_object(
    'user', json_build_object(
      'id', u.id,
      'name', COALESCE(NULLIF(trim(u.nombre_publico), ''), u.nombre_completo),
      'email', u.email_laboral,
      'phone', u.celular_laboral,
      'photo_url',
        CASE
          WHEN u.imagen_perfil_url IN ('/display-avatar.png', '/display-avatar-usuarios.png') THEN v_default_avatar
          WHEN u.imagen_perfil_url LIKE '/avatars/%' THEN v_base_url || u.imagen_perfil_url
          WHEN u.imagen_perfil_url LIKE '/publicidad/%' THEN v_base_url || u.imagen_perfil_url
          WHEN u.imagen_perfil_url LIKE '/%' THEN v_app_url || u.imagen_perfil_url
          WHEN u.imagen_perfil_url IS NULL THEN v_default_avatar
          ELSE u.imagen_perfil_url
        END,
      'logo_url',
        CASE
          WHEN u.mi_logotipo_url IS NOT NULL THEN
            CASE WHEN u.mi_logotipo_url LIKE '/%' THEN v_app_url || u.mi_logotipo_url ELSE u.mi_logotipo_url END
          WHEN o.logo_url IS NOT NULL THEN
            CASE WHEN o.logo_url LIKE '/%' THEN v_app_url || o.logo_url ELSE o.logo_url END
          ELSE v_app_url || '/logojiro.png'
        END,
      'office', json_build_object(
        'name', o.nombre,
        'logo_url',
          CASE
            WHEN o.logo_url IS NOT NULL THEN
              CASE WHEN o.logo_url LIKE '/%' THEN v_app_url || o.logo_url ELSE o.logo_url END
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
              CASE WHEN wpi.logo_url LIKE '/%' THEN v_app_url || wpi.logo_url ELSE wpi.logo_url END,
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
$function$;
