/*
  # Convertir nombres y apellidos a MAYÚSCULAS

  1. Cambios
    - Eliminar columna generada nombre_completo con CASCADE
    - Recrear columna generada con UPPER()
    - Recrear triggers dependientes
    - Crear función y trigger para convertir nombre y apellidos a MAYÚSCULAS
    - Actualizar todos los usuarios existentes

  2. Notas
    - Se usa CASCADE para eliminar dependencias automáticamente
    - Se recrean los triggers que dependían de nombre_completo
    - Aplica a todos los roles de usuario
*/

-- Eliminar la columna generada existente con CASCADE
ALTER TABLE usuarios 
  DROP COLUMN IF EXISTS nombre_completo CASCADE;

-- Recrear columna generada con UPPER()
ALTER TABLE usuarios
  ADD COLUMN nombre_completo text 
  GENERATED ALWAYS AS (UPPER(TRIM(nombre || ' ' || apellidos))) STORED;

-- Recrear nombre_completo_norm (columna de normalización para búsquedas)
ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS nombre_completo_norm text 
  GENERATED ALWAYS AS (
    LOWER(
      TRIM(
        regexp_replace(
          unaccent(nombre || ' ' || apellidos),
          '[^a-zA-Z0-9\s]',
          '',
          'g'
        )
      )
    )
  ) STORED;

-- Crear función que convierte nombres y apellidos a mayúsculas
CREATE OR REPLACE FUNCTION uppercase_nombres_apellidos()
RETURNS TRIGGER AS $$
BEGIN
  -- Convertir nombre a MAYÚSCULAS si no es NULL
  IF NEW.nombre IS NOT NULL THEN
    NEW.nombre = UPPER(TRIM(NEW.nombre));
  END IF;

  -- Convertir apellidos a MAYÚSCULAS si no es NULL
  IF NEW.apellidos IS NOT NULL THEN
    NEW.apellidos = UPPER(TRIM(NEW.apellidos));
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear trigger BEFORE INSERT OR UPDATE
DROP TRIGGER IF EXISTS trigger_uppercase_nombres_apellidos ON usuarios;

CREATE TRIGGER trigger_uppercase_nombres_apellidos
  BEFORE INSERT OR UPDATE OF nombre, apellidos
  ON usuarios
  FOR EACH ROW
  EXECUTE FUNCTION uppercase_nombres_apellidos();

-- Actualizar todos los usuarios existentes
UPDATE usuarios
SET 
  nombre = UPPER(TRIM(nombre)),
  apellidos = UPPER(TRIM(apellidos))
WHERE 
  id IN (SELECT id FROM usuarios WHERE nombre IS NOT NULL OR apellidos IS NOT NULL);

-- Crear índice para búsquedas optimizadas
CREATE INDEX IF NOT EXISTS idx_usuarios_nombre_completo 
  ON usuarios(nombre_completo);

CREATE INDEX IF NOT EXISTS idx_usuarios_nombre_completo_norm 
  ON usuarios(nombre_completo_norm);

COMMENT ON COLUMN usuarios.nombre_completo IS 'Nombre completo en MAYÚSCULAS (generado automáticamente)';
COMMENT ON COLUMN usuarios.nombre_completo_norm IS 'Nombre completo normalizado para búsquedas (sin acentos, minúsculas)';
COMMENT ON FUNCTION uppercase_nombres_apellidos() IS 'Convierte automáticamente nombre y apellidos a MAYÚSCULAS';
COMMENT ON TRIGGER trigger_uppercase_nombres_apellidos ON usuarios IS 'Convierte nombre y apellidos a MAYÚSCULAS automáticamente';