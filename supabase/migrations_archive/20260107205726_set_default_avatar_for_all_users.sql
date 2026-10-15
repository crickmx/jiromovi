/*
  # Establecer imagen de perfil genérica por defecto

  1. Cambios
    - Cambiar el valor por defecto de imagen_perfil_url a '/display-avatar.png'
    - Actualizar todos los usuarios existentes que no tengan imagen de perfil
    - Crear trigger para asignar avatar por defecto a nuevos usuarios

  2. Notas
    - La imagen genérica /display-avatar.png será el avatar por defecto
    - Se aplica retroactivamente a usuarios existentes sin avatar
    - Los nuevos usuarios tendrán esta imagen automáticamente
*/

-- Cambiar el valor por defecto de la columna imagen_perfil_url
ALTER TABLE usuarios 
  ALTER COLUMN imagen_perfil_url SET DEFAULT '/display-avatar.png';

-- Actualizar todos los usuarios existentes que tengan imagen_perfil_url vacía o null
UPDATE usuarios
SET imagen_perfil_url = '/display-avatar.png'
WHERE imagen_perfil_url IS NULL 
   OR imagen_perfil_url = '' 
   OR imagen_perfil_url = ' ';

-- Crear función para asegurar avatar por defecto en INSERT
CREATE OR REPLACE FUNCTION ensure_default_avatar()
RETURNS TRIGGER AS $$
BEGIN
  -- Si imagen_perfil_url es NULL, vacío o solo espacios, asignar avatar por defecto
  IF NEW.imagen_perfil_url IS NULL 
     OR TRIM(NEW.imagen_perfil_url) = '' THEN
    NEW.imagen_perfil_url = '/display-avatar.png';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear trigger para asegurar avatar por defecto
DROP TRIGGER IF EXISTS trigger_ensure_default_avatar ON usuarios;

CREATE TRIGGER trigger_ensure_default_avatar
  BEFORE INSERT OR UPDATE OF imagen_perfil_url
  ON usuarios
  FOR EACH ROW
  EXECUTE FUNCTION ensure_default_avatar();

COMMENT ON FUNCTION ensure_default_avatar() IS 'Asegura que todos los usuarios tengan una imagen de perfil (por defecto /display-avatar.png)';
COMMENT ON TRIGGER trigger_ensure_default_avatar ON usuarios IS 'Asigna avatar genérico si no hay imagen de perfil personalizada';