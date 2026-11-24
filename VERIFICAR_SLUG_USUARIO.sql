-- ============================================
-- Verificar y Configurar Slug de Usuario
-- ============================================

-- 1. Ver todos los usuarios con sus slugs
SELECT
  id,
  nombre_completo,
  email_laboral,
  web_slug,
  estado,
  rol
FROM usuarios
WHERE estado = 'Activo'
ORDER BY nombre_completo;

-- 2. Verificar un usuario específico (reemplaza el email)
SELECT
  id,
  nombre_completo,
  email_laboral,
  web_slug,
  estado,
  celular_laboral
FROM usuarios
WHERE email_laboral = 'tu-email@example.com';

-- 3. Asignar slug a un usuario (reemplaza valores)
UPDATE usuarios
SET
  web_slug = 'nombre-slug',  -- Ej: 'movi', 'juan-perez', etc
  estado = 'Activo'
WHERE email_laboral = 'tu-email@example.com';

-- 4. Verificar que la página esté publicada
SELECT
  u.nombre_completo,
  u.web_slug,
  wpc.is_published,
  wpc.primary_color,
  wpc.secondary_color
FROM usuarios u
LEFT JOIN web_page_config wpc ON wpc.user_id = u.id
WHERE u.email_laboral = 'tu-email@example.com';

-- 5. Publicar la página si no está publicada
INSERT INTO web_page_config (
  user_id,
  is_published,
  primary_color,
  secondary_color
)
SELECT
  id,
  true,
  '#2563eb',  -- Azul por defecto
  '#10b981'   -- Verde por defecto
FROM usuarios
WHERE email_laboral = 'tu-email@example.com'
ON CONFLICT (user_id) DO UPDATE
SET is_published = true;

-- 6. Verificar que el slug no esté duplicado
SELECT
  web_slug,
  COUNT(*) as cantidad
FROM usuarios
WHERE web_slug IS NOT NULL
GROUP BY web_slug
HAVING COUNT(*) > 1;

-- 7. Ver ejemplo de slug disponible basado en el nombre
SELECT
  id,
  nombre_completo,
  LOWER(REPLACE(REPLACE(SPLIT_PART(nombre_completo, ' ', 1), 'á', 'a'), 'é', 'e')) as slug_sugerido
FROM usuarios
WHERE web_slug IS NULL
AND estado = 'Activo';
