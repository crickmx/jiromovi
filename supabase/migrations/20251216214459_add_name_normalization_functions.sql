/*
  # Funciones de Normalización y Matching de Nombres

  1. Funciones Creadas
    - `normalize_person_name()` - Normaliza nombres de personas para matching
    - `name_similarity()` - Calcula similitud entre dos nombres (0-100)

  2. Propósito
    - Permitir matching consistente de vendedores por nombre
    - Soportar matching automático con threshold de similitud
    - Eliminar variaciones en acentos, espacios, mayúsculas, títulos

  3. Uso
    - En imports: normalizar VendNombre del Excel
    - En matching: comparar con usuarios.nombre_completo_norm
    - En fuzzy matching: usar name_similarity() >= 92
*/

-- Función para normalizar nombres de personas
CREATE OR REPLACE FUNCTION normalize_person_name(name_input text)
RETURNS text AS $$
DECLARE
  normalized text;
BEGIN
  IF name_input IS NULL OR trim(name_input) = '' THEN
    RETURN '';
  END IF;

  -- Convertir a minúsculas y quitar espacios al inicio/final
  normalized := lower(trim(name_input));

  -- Remover acentos y diacríticos
  normalized := translate(normalized,
    'áéíóúàèìòùâêîôûäëïöüñç',
    'aeiouaeiouaeiouaeiounç');

  -- Remover títulos profesionales comunes
  normalized := regexp_replace(normalized, '\b(lic|ing|dr|dra|mtro|mtra|c\.?p\.?|arq|prof)\b\.?', '', 'gi');

  -- Remover símbolos y caracteres especiales (mantener solo letras, números y espacios)
  normalized := regexp_replace(normalized, '[^a-z0-9\s]', '', 'g');

  -- Normalizar espacios múltiples a uno solo
  normalized := regexp_replace(normalized, '\s+', ' ', 'g');
  normalized := trim(normalized);

  RETURN normalized;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Función para calcular similitud entre dos nombres (0-100)
-- Usa matching de tokens: cuántos tokens en común tienen
CREATE OR REPLACE FUNCTION name_similarity(name1 text, name2 text)
RETURNS int AS $$
DECLARE
  norm1 text;
  norm2 text;
  tokens1 text[];
  tokens2 text[];
  common_tokens int := 0;
  total_tokens int;
  score float;
  i int;
BEGIN
  -- Normalizar ambos nombres
  norm1 := normalize_person_name(name1);
  norm2 := normalize_person_name(name2);

  -- Si son iguales después de normalizar, retornar 100
  IF norm1 = norm2 THEN
    RETURN 100;
  END IF;

  -- Si alguno está vacío, retornar 0
  IF norm1 = '' OR norm2 = '' THEN
    RETURN 0;
  END IF;

  -- Dividir en tokens (palabras)
  tokens1 := string_to_array(norm1, ' ');
  tokens2 := string_to_array(norm2, ' ');

  -- Contar tokens en común
  FOR i IN 1..array_length(tokens1, 1) LOOP
    IF tokens1[i] = ANY(tokens2) THEN
      common_tokens := common_tokens + 1;
    END IF;
  END LOOP;

  -- Calcular total de tokens únicos
  total_tokens := greatest(array_length(tokens1, 1), array_length(tokens2, 1));

  IF total_tokens = 0 THEN
    RETURN 0;
  END IF;

  -- Calcular score como porcentaje
  score := (common_tokens::float / total_tokens::float) * 100;

  RETURN floor(score)::int;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Agregar columna normalizada a usuarios si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'usuarios' AND column_name = 'nombre_completo_norm'
  ) THEN
    ALTER TABLE usuarios ADD COLUMN nombre_completo_norm text;

    -- Crear índice para búsquedas
    CREATE INDEX IF NOT EXISTS idx_usuarios_nombre_completo_norm
      ON usuarios(nombre_completo_norm);
  END IF;
END $$;

-- Poblar la columna normalizada para usuarios existentes
UPDATE usuarios
SET nombre_completo_norm = normalize_person_name(nombre_completo)
WHERE nombre_completo IS NOT NULL
AND (nombre_completo_norm IS NULL OR nombre_completo_norm = '');

-- Trigger para mantener nombre_completo_norm sincronizado
CREATE OR REPLACE FUNCTION sync_usuario_nombre_norm()
RETURNS TRIGGER AS $$
BEGIN
  NEW.nombre_completo_norm := normalize_person_name(NEW.nombre_completo);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sync_usuario_nombre_norm ON usuarios;
CREATE TRIGGER trigger_sync_usuario_nombre_norm
  BEFORE INSERT OR UPDATE OF nombre_completo ON usuarios
  FOR EACH ROW
  EXECUTE FUNCTION sync_usuario_nombre_norm();

-- Comentarios
COMMENT ON FUNCTION normalize_person_name IS 'Normaliza un nombre de persona: lowercase, sin acentos, sin títulos, sin símbolos';
COMMENT ON FUNCTION name_similarity IS 'Calcula similitud entre dos nombres (0-100) basado en tokens en común';
COMMENT ON COLUMN usuarios.nombre_completo_norm IS 'Nombre completo normalizado para matching (auto-mantenido por trigger)';
