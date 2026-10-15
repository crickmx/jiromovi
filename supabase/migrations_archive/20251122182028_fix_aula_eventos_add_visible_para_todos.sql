/*
  # Agregar columna visible_para_todos a aula_eventos

  1. Cambios
    - Agregar columna `visible_para_todos` (boolean, default false)
    - Renombrar columna `actualizado_en` a `modificado_en` si existe
    
  2. Datos
    - Todos los eventos existentes se marcan como visible_para_todos = false
*/

-- Agregar columna visible_para_todos si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'aula_eventos' AND column_name = 'visible_para_todos'
  ) THEN
    ALTER TABLE aula_eventos ADD COLUMN visible_para_todos boolean DEFAULT false NOT NULL;
  END IF;
END $$;

-- Renombrar actualizado_en a modificado_en si existe
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'aula_eventos' AND column_name = 'actualizado_en'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'aula_eventos' AND column_name = 'modificado_en'
  ) THEN
    ALTER TABLE aula_eventos RENAME COLUMN actualizado_en TO modificado_en;
  END IF;
END $$;

-- Actualizar trigger para usar modificado_en
DROP TRIGGER IF EXISTS trigger_actualizar_modificado_en_aula_eventos ON aula_eventos;

CREATE OR REPLACE FUNCTION actualizar_modificado_en_aula_eventos()
RETURNS TRIGGER AS $$
BEGIN
  NEW.modificado_en = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_actualizar_modificado_en_aula_eventos
  BEFORE UPDATE ON aula_eventos
  FOR EACH ROW
  EXECUTE FUNCTION actualizar_modificado_en_aula_eventos();
