/*
  # Eliminar Restricción UNIQUE de Username
  
  ## Problema
  La columna `username` en la tabla `usuarios` tiene una restricción UNIQUE
  que causa errores al crear usuarios sin username o con usernames duplicados.
  
  ## Solución
  - Eliminar la restricción UNIQUE de la columna username
  - Hacer que username sea opcional (puede ser NULL o vacío)
  - El login ahora se hace con email_laboral, no con username
  
  ## Cambios
  1. DROP CONSTRAINT usuarios_username_key
  2. Permitir NULL en username
  
  ## Impacto
  - Los usuarios pueden tener el mismo username o username vacío
  - El login sigue funcionando con email_laboral
  - No afecta a usuarios existentes
*/

-- Eliminar la restricción UNIQUE de username
ALTER TABLE usuarios 
DROP CONSTRAINT IF EXISTS usuarios_username_key;

-- Asegurar que username puede ser NULL
ALTER TABLE usuarios 
ALTER COLUMN username DROP NOT NULL;

-- Actualizar usuarios existentes que tengan username vacío
UPDATE usuarios 
SET username = NULL 
WHERE username = '' OR username IS NULL;

-- Log de confirmación
DO $$
BEGIN
  RAISE NOTICE '✅ Restricción UNIQUE de username eliminada correctamente';
  RAISE NOTICE '✅ Username ahora es opcional';
  RAISE NOTICE '✅ Login funcionará con email_laboral únicamente';
END $$;
