/*
  # Agregar columna banco a usuarios

  1. Cambios
    - Agregar columna `banco` para almacenar el nombre del banco
    - La columna `cuenta_banco` ya existe para el número de cuenta
    - Esta separación permite mejor organización de datos bancarios
    
  2. Notas
    - Campo opcional (nullable)
    - Se usa en formularios de pago y perfil de usuario
*/

-- Agregar columna banco
ALTER TABLE usuarios 
ADD COLUMN IF NOT EXISTS banco text DEFAULT '';

-- Crear índice si es necesario para búsquedas
CREATE INDEX IF NOT EXISTS idx_usuarios_banco ON usuarios(banco) WHERE banco IS NOT NULL AND banco != '';
