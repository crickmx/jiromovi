/*
  # Agregar columna detalles a tabla areas

  ## Descripción
  Agrega la columna `detalles` a la tabla areas para almacenar información adicional
  sobre cada área. Migra datos existentes de la columna `descripcion` si existe.

  ## Cambios
  - Agrega columna `detalles` (text) a tabla areas
  - Copia datos de `descripcion` a `detalles` si existen

  ## Seguridad
  - No hay cambios en RLS
*/

-- Agregar columna detalles
ALTER TABLE areas 
ADD COLUMN IF NOT EXISTS detalles text;

-- Copiar datos de descripcion a detalles si existe
UPDATE areas 
SET detalles = descripcion 
WHERE detalles IS NULL AND descripcion IS NOT NULL;

COMMENT ON COLUMN areas.detalles IS 'Información detallada adicional sobre el área';
