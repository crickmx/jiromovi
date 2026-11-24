/*
  # Fix: Corregir URLs duplicadas en notificaciones de comunicados

  ## Problema
  Las notificaciones de comunicados tienen URLs con dominio duplicado:
  - Incorrecto: https://app.movi.digital/dashboard/https://app.movi.digital/comunicados/...
  - Correcto: /comunicados/...

  ## Cambios
  1. Actualizar notificaciones existentes para usar rutas relativas
  2. Eliminar dominios completos de las URLs
  3. Remover el prefijo /dashboard/ si existe

  ## Seguridad
  - Solo actualiza notificaciones del módulo Comunicados
  - Preserva el resto de los datos de la notificación
*/

-- Paso 1: Limpiar URLs con dominio completo y /dashboard/
UPDATE notificaciones
SET accion_url = REGEXP_REPLACE(
  REGEXP_REPLACE(accion_url, '^.*/dashboard/', '/'),
  '^https?://[^/]+',
  ''
)
WHERE modulo = 'Comunicados'
  AND accion_url IS NOT NULL
  AND (
    accion_url LIKE '%/dashboard/%'
    OR accion_url LIKE 'http%'
  );

-- Paso 2: Verificar y corregir URLs que quedaron con doble slash
UPDATE notificaciones
SET accion_url = REGEXP_REPLACE(accion_url, '/+', '/', 'g')
WHERE modulo = 'Comunicados'
  AND accion_url LIKE '%//%';

-- Paso 3: Asegurar que todas las URLs de comunicados empiecen con /
UPDATE notificaciones
SET accion_url = '/' || accion_url
WHERE modulo = 'Comunicados'
  AND accion_url IS NOT NULL
  AND accion_url !~ '^/'
  AND accion_url LIKE '%comunicados%';

-- Log de cambios
DO $$
DECLARE
  v_updated_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_updated_count
  FROM notificaciones
  WHERE modulo = 'Comunicados'
    AND accion_url LIKE '/comunicados/%';

  RAISE NOTICE '✅ URLs de notificaciones de comunicados corregidas';
  RAISE NOTICE 'Total de notificaciones con URLs correctas: %', v_updated_count;
END $$;
