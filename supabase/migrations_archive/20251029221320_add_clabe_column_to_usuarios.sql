/*
  # Agregar columna clabe a usuarios

  1. Cambios
    - Agregar columna `clabe` como alias/duplicado de clabe_interbancaria
    - Esto mantiene compatibilidad con el código frontend
    - Se mantiene clabe_interbancaria por compatibilidad con código existente
    
  2. Notas
    - Campo opcional (nullable)
    - Se usa en formularios de pago y perfil de usuario
    - Ambas columnas pueden coexistir por ahora para compatibilidad
*/

-- Agregar columna clabe
ALTER TABLE usuarios 
ADD COLUMN IF NOT EXISTS clabe text DEFAULT '';

-- Copiar datos existentes de clabe_interbancaria a clabe si existen
UPDATE usuarios 
SET clabe = clabe_interbancaria 
WHERE clabe_interbancaria IS NOT NULL AND clabe_interbancaria != '';
