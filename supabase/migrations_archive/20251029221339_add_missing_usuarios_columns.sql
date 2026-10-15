/*
  # Agregar columnas faltantes a usuarios

  1. Cambios
    - Agregar `dias_vacaciones_disponibles` para gestión de vacaciones
    - Agregar cualquier otra columna que pueda faltar
    
  2. Notas
    - dias_vacaciones_disponibles: días de vacaciones que el usuario tiene disponibles
    - Se usa en el módulo de vacaciones
*/

-- Agregar columna dias_vacaciones_disponibles
ALTER TABLE usuarios 
ADD COLUMN IF NOT EXISTS dias_vacaciones_disponibles integer DEFAULT 15;

-- Agregar columna dias_vacaciones_usados para tracking
ALTER TABLE usuarios 
ADD COLUMN IF NOT EXISTS dias_vacaciones_usados integer DEFAULT 0;

-- Agregar comentario descriptivo
COMMENT ON COLUMN usuarios.dias_vacaciones_disponibles IS 'Días de vacaciones disponibles para el usuario';
COMMENT ON COLUMN usuarios.dias_vacaciones_usados IS 'Días de vacaciones ya utilizados por el usuario';
