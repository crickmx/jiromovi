/*
  # Agregar columna es_espacio_jiro a tabla oficinas

  ## Descripción
  Agrega la columna booleana `es_espacio_jiro` a la tabla oficinas para identificar
  qué oficinas son espacios Jiro disponibles para reservaciones.

  ## Cambios
  - Agrega columna `es_espacio_jiro` (boolean, default false) a tabla oficinas
  - Todas las oficinas existentes se marcarán como no-espacio-jiro por defecto

  ## Seguridad
  - No hay cambios en RLS, las políticas existentes aplican
*/

-- Agregar columna es_espacio_jiro a oficinas
ALTER TABLE oficinas 
ADD COLUMN IF NOT EXISTS es_espacio_jiro boolean DEFAULT false NOT NULL;

COMMENT ON COLUMN oficinas.es_espacio_jiro IS 'Indica si esta oficina es un Espacio Jiro disponible para reservas';
