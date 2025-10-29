/*
  # Agregar columna nombre_completo a usuarios

  1. Cambios
    - Agregar columna generada `nombre_completo` que concatena nombre y apellidos
    - Esta columna se actualiza automáticamente cuando nombre o apellidos cambian
    
  2. Beneficios
    - Evita concatenación repetitiva en queries
    - Mejora rendimiento de búsquedas
    - Garantiza formato consistente
*/

-- Agregar columna generada nombre_completo
ALTER TABLE usuarios 
ADD COLUMN IF NOT EXISTS nombre_completo text 
GENERATED ALWAYS AS (nombre || ' ' || apellidos) STORED;

-- Crear índice para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_usuarios_nombre_completo ON usuarios(nombre_completo);
