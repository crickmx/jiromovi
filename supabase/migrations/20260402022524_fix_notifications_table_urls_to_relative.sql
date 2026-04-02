/*
  # Fix: Convertir URLs en tabla notifications a rutas relativas

  1. Problema
    - La tabla 'notifications' (campanita) tiene URLs absolutas en link_url
    - Esto causa errores de navegación en el frontend
    - La migración anterior solo actualizó 'notificaciones_globales'

  2. Solución
    - Actualizar todas las URLs en la tabla 'notifications'
    - Convertir URLs absolutas a rutas relativas
*/

-- Actualizar notifications (campanita) con URLs absolutas
UPDATE notifications
SET link_url = SUBSTRING(link_url FROM POSITION('/tramites' IN link_url))
WHERE link_url LIKE '%tramites%'
  AND (link_url LIKE 'http%');

UPDATE notifications
SET link_url = SUBSTRING(link_url FROM POSITION('/comisiones' IN link_url))
WHERE link_url LIKE '%comisiones%'
  AND (link_url LIKE 'http%');

UPDATE notifications
SET link_url = SUBSTRING(link_url FROM POSITION('/comunicados' IN link_url))
WHERE link_url LIKE '%comunicados%'
  AND (link_url LIKE 'http%');

UPDATE notifications
SET link_url = SUBSTRING(link_url FROM POSITION('/usuarios' IN link_url))
WHERE link_url LIKE '%usuarios%'
  AND (link_url LIKE 'http%');

UPDATE notifications
SET link_url = SUBSTRING(link_url FROM POSITION('/tickets' IN link_url))
WHERE link_url LIKE '%tickets%'
  AND (link_url LIKE 'http%');

UPDATE notifications
SET link_url = SUBSTRING(link_url FROM POSITION('/perfil' IN link_url))
WHERE link_url LIKE '%perfil%'
  AND (link_url LIKE 'http%');

UPDATE notifications
SET link_url = SUBSTRING(link_url FROM POSITION('/usuario' IN link_url))
WHERE link_url LIKE '%usuario%'
  AND (link_url LIKE 'http%');

UPDATE notifications
SET link_url = SUBSTRING(link_url FROM POSITION('/store' IN link_url))
WHERE link_url LIKE '%store%'
  AND (link_url LIKE 'http%');

UPDATE notifications
SET link_url = SUBSTRING(link_url FROM POSITION('/espacio-jiro' IN link_url))
WHERE link_url LIKE '%espacio-jiro%'
  AND (link_url LIKE 'http%');

-- Limpiar cualquier URL que aún tenga el dominio completo usando regex
UPDATE notifications
SET link_url = REGEXP_REPLACE(
  link_url,
  'https?://(app\.movi\.digital|moviapp\.com|movidigital\.com\.mx)',
  '',
  'g'
)
WHERE link_url LIKE 'http%';

-- Verificar resultado
DO $$
DECLARE
  v_count_absolute integer;
  v_count_relative integer;
  v_total integer;
BEGIN
  -- Total de notificaciones con link_url
  SELECT COUNT(*) INTO v_total
  FROM notifications
  WHERE link_url IS NOT NULL AND link_url != '';
  
  -- Contar URLs absolutas restantes
  SELECT COUNT(*) INTO v_count_absolute
  FROM notifications
  WHERE link_url LIKE 'http%';
  
  -- Contar URLs relativas
  SELECT COUNT(*) INTO v_count_relative
  FROM notifications
  WHERE link_url IS NOT NULL
    AND link_url NOT LIKE 'http%'
    AND link_url != '';
  
  RAISE NOTICE 'Total notificaciones con URL: %', v_total;
  RAISE NOTICE 'URLs absolutas restantes: %', v_count_absolute;
  RAISE NOTICE 'URLs relativas correctas: %', v_count_relative;
  
  IF v_count_absolute > 0 THEN
    RAISE WARNING 'Aún hay % notificaciones con URLs absolutas', v_count_absolute;
  ELSE
    RAISE NOTICE 'Todas las URLs han sido convertidas a rutas relativas';
  END IF;
END $$;
