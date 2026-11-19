-- 20261119000007_get_agent_brand_config_validacion.sql
--
-- Cierra el hallazgo de auditoría del 19 nov 2026: get_agent_brand_config era ejecutable por
-- 'anon' y devolvía nombre, datos de marca y CELULAR LABORAL de cualquier agente con solo
-- conocer su UUID (enumerable: circula en páginas públicas y enlaces de cotización).
--
-- Se añade la validación que ya usa su función hermana get_agent_brand_for_seguwallet
-- (AND activo = true + retorno por defecto con las MISMAS claves, para no romper el
-- formulario público de cotización que la consume).
--
-- De paso corrige un bug PREEXISTENTE: la función usaba un RECORD (v_office) que quedaba
-- sin asignar cuando el agente no tiene oficina, y reventaba con
--   55000: record "v_office" is not assigned yet
-- Afectaba a 1 usuario real de 235 activos. Se sustituye por escalares.

CREATE OR REPLACE FUNCTION public.get_agent_brand_config(p_agent_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
v_user RECORD;
v_office_nombre text;
v_office_logo text;
v_office_accent text;
v_web RECORD;
v_brand jsonb;
v_primary text;
v_secondary text;
BEGIN
SELECT nombre, apellidos, oficina_id, nombre_publico,
mi_logotipo_url, imagen_perfil_url, web_slug, celular_laboral
INTO v_user
FROM usuarios
WHERE id = p_agent_id
  AND activo = true;
IF NOT FOUND THEN
  RETURN jsonb_build_object(
    'agent_name', 'Tu Agente', 'office_name', '', 'primary_color', '#2563eb',
    'secondary_color', '#1e40af', 'logo_url', '/logojiro.png',
    'profile_image_url', null, 'agent_slug', null, 'agent_whatsapp', null,
    'footer_text', 'Formulario enviado a través de MOVI Digital.');
END IF;
  SELECT nombre, logo_url, accent_color
    INTO v_office_nombre, v_office_logo, v_office_accent
    FROM oficinas WHERE id = v_user.oficina_id;
  -- Si no hay filas, los escalares quedan NULL: COALESCE los cubre y ya no
  -- revienta con 55000 'record v_office is not assigned yet' (bug preexistente).
SELECT primary_color, secondary_color INTO v_web
FROM user_web_pages WHERE user_id = p_agent_id LIMIT 1;
v_primary := COALESCE(v_web.primary_color, v_office_accent, '#2563eb');
v_secondary := COALESCE(v_web.secondary_color, '#1e40af');
v_brand := jsonb_build_object(
'agent_name',         COALESCE(v_user.nombre_publico, v_user.nombre || ' ' || COALESCE(v_user.apellidos, '')),
'office_name',        COALESCE(v_office_nombre, ''),
'primary_color',      v_primary,
'secondary_color',    v_secondary,
'logo_url',           COALESCE(v_user.mi_logotipo_url, v_office_logo, '/logojiro.png'),
'profile_image_url',  v_user.imagen_perfil_url,
'agent_slug',         v_user.web_slug,
'agent_whatsapp',     v_user.celular_laboral,
'footer_text',        'Formulario enviado a través de MOVI Digital.'
);
RETURN v_brand;
END;
$function$
