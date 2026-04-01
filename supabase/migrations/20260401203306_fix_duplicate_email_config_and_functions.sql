/*
  # Fix: Eliminar configuración duplicada de correo y actualizar funciones
  
  1. Problema
    - Hay 2 configuraciones de correo activas
    - maybeSingle() falla cuando hay múltiples registros
    - Los correos no se envían por este error
  
  2. Solución
    - Desactivar configuraciones duplicadas (mantener la más reciente)
    - Asegurar que solo haya una configuración activa a la vez
    - Agregar constraint único en la base de datos
*/

-- Desactivar todas las configuraciones excepto la más reciente
UPDATE correo_configuracion
SET activo = false
WHERE id NOT IN (
  SELECT id 
  FROM correo_configuracion 
  WHERE activo = true
  ORDER BY created_at DESC 
  LIMIT 1
);

-- Agregar constraint para asegurar solo una configuración activa
-- Primero eliminar si existe
ALTER TABLE correo_configuracion DROP CONSTRAINT IF EXISTS solo_una_configuracion_activa;

-- Crear exclusion constraint para asegurar solo un registro activo
CREATE UNIQUE INDEX IF NOT EXISTS idx_correo_configuracion_activo_unico 
ON correo_configuracion (activo) 
WHERE activo = true;

-- Comentario explicativo
COMMENT ON INDEX idx_correo_configuracion_activo_unico IS 
  'Asegura que solo puede haber una configuración de correo activa a la vez';
