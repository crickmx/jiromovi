/*
  # Fix: Convertir URLs Absolutas Existentes a Rutas Relativas

  1. Problema
    - Las notificaciones existentes tienen URLs absolutas guardadas
    - Esto causa problemas de navegación en el frontend

  2. Solución
    - Actualizar todas las URLs de notificaciones existentes
    - Convertir URLs absolutas a rutas relativas
*/

-- Actualizar notificaciones existentes que tienen URLs absolutas
UPDATE notificaciones_globales
SET accion_url = SUBSTRING(accion_url FROM POSITION('/tramites' IN accion_url))
WHERE accion_url LIKE '%app.movi.digital/tramites%'
   OR accion_url LIKE '%moviapp.com/tramites%'
   OR accion_url LIKE '%movidigital.com.mx/tramites%';

UPDATE notificaciones_globales
SET accion_url = SUBSTRING(accion_url FROM POSITION('/comisiones' IN accion_url))
WHERE accion_url LIKE '%app.movi.digital/comisiones%'
   OR accion_url LIKE '%moviapp.com/comisiones%'
   OR accion_url LIKE '%movidigital.com.mx/comisiones%';

UPDATE notificaciones_globales
SET accion_url = SUBSTRING(accion_url FROM POSITION('/comunicados' IN accion_url))
WHERE accion_url LIKE '%app.movi.digital/comunicados%'
   OR accion_url LIKE '%moviapp.com/comunicados%'
   OR accion_url LIKE '%movidigital.com.mx/comunicados%';

UPDATE notificaciones_globales
SET accion_url = SUBSTRING(accion_url FROM POSITION('/usuarios' IN accion_url))
WHERE accion_url LIKE '%app.movi.digital/usuarios%'
   OR accion_url LIKE '%moviapp.com/usuarios%'
   OR accion_url LIKE '%movidigital.com.mx/usuarios%';

UPDATE notificaciones_globales
SET accion_url = SUBSTRING(accion_url FROM POSITION('/tickets' IN accion_url))
WHERE accion_url LIKE '%app.movi.digital/tickets%'
   OR accion_url LIKE '%moviapp.com/tickets%'
   OR accion_url LIKE '%movidigital.com.mx/tickets%';

UPDATE notificaciones_globales
SET accion_url = SUBSTRING(accion_url FROM POSITION('/perfil' IN accion_url))
WHERE accion_url LIKE '%app.movi.digital/perfil%'
   OR accion_url LIKE '%moviapp.com/perfil%'
   OR accion_url LIKE '%movidigital.com.mx/perfil%';

UPDATE notificaciones_globales
SET accion_url = SUBSTRING(accion_url FROM POSITION('/store' IN accion_url))
WHERE accion_url LIKE '%app.movi.digital/store%'
   OR accion_url LIKE '%moviapp.com/store%'
   OR accion_url LIKE '%movidigital.com.mx/store%';

UPDATE notificaciones_globales
SET accion_url = SUBSTRING(accion_url FROM POSITION('/espacio-jiro' IN accion_url))
WHERE accion_url LIKE '%app.movi.digital/espacio-jiro%'
   OR accion_url LIKE '%moviapp.com/espacio-jiro%'
   OR accion_url LIKE '%movidigital.com.mx/espacio-jiro%';

-- Limpiar cualquier URL que aún tenga el dominio completo
UPDATE notificaciones_globales
SET accion_url = REGEXP_REPLACE(
  accion_url,
  'https?://(app\.movi\.digital|moviapp\.com|movidigital\.com\.mx)',
  '',
  'g'
)
WHERE accion_url LIKE 'http%';

-- Verificar resultado
DO $$
DECLARE
  v_count_absolute integer;
  v_count_relative integer;
BEGIN
  -- Contar URLs absolutas restantes
  SELECT COUNT(*) INTO v_count_absolute
  FROM notificaciones_globales
  WHERE accion_url LIKE 'http%';
  
  -- Contar URLs relativas
  SELECT COUNT(*) INTO v_count_relative
  FROM notificaciones_globales
  WHERE accion_url IS NOT NULL
    AND accion_url NOT LIKE 'http%'
    AND accion_url != '';
  
  RAISE NOTICE 'URLs absolutas restantes: %', v_count_absolute;
  RAISE NOTICE 'URLs relativas correctas: %', v_count_relative;
  
  IF v_count_absolute > 0 THEN
    RAISE WARNING 'Aún hay % notificaciones con URLs absolutas', v_count_absolute;
  END IF;
END $$;
