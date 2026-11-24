/*
  # Agregar soporte para REST API KeyCodes en catálogos SICAS
  
  1. Cambios en la estructura
    - Agregar campo `rest_keycode` a `sicas_catalog_types` para mapear a códigos REST API
    - Agregar campo `soap_method` para indicar si usa ReadInfoData (SOAP) o Report/ReadData (REST)
    
  2. Notas
    - Los catálogos pueden usar SOAP (enum_name con ReadInfoData) o REST (rest_keycode con Report/ReadData)
    - El campo rest_keycode es opcional para mantener compatibilidad con catálogos que solo funcionan con SOAP
    - Según documentación oficial (API-Servicios_REST.pdf páginas 27-31), el método correcto es REST API
*/

-- Agregar campo para REST API KeyCode
ALTER TABLE public.sicas_catalog_types 
ADD COLUMN IF NOT EXISTS rest_keycode TEXT;

-- Agregar campo para indicar el método preferido
ALTER TABLE public.sicas_catalog_types 
ADD COLUMN IF NOT EXISTS sync_method TEXT DEFAULT 'rest' CHECK (sync_method IN ('soap', 'rest', 'both'));

-- Comentarios
COMMENT ON COLUMN public.sicas_catalog_types.rest_keycode IS 'KeyCode para usar con la REST API de SICAS (endpoint /Report/ReadData). Ejemplo: HWS03668_001';
COMMENT ON COLUMN public.sicas_catalog_types.sync_method IS 'Método de sincronización: rest (preferido), soap (legacy), both (ambos disponibles)';

-- Actualizar método de sincronización predeterminado a REST
UPDATE public.sicas_catalog_types SET sync_method = 'rest' WHERE sync_method IS NULL;

-- Agregar KeyCodes REST conocidos (estos son ejemplos, se deben actualizar con los códigos reales)
-- Por ahora dejamos NULL y se pueden agregar conforme se descubren los KeyCodes correctos
-- Formato esperado según documentación: HWS#####_###
UPDATE public.sicas_catalog_types SET 
  rest_keycode = NULL,
  sync_method = 'rest'
WHERE id IN (1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20);

-- Agregar índice para búsquedas por rest_keycode
CREATE INDEX IF NOT EXISTS idx_sicas_catalog_types_rest_keycode 
ON public.sicas_catalog_types(rest_keycode) 
WHERE rest_keycode IS NOT NULL;
