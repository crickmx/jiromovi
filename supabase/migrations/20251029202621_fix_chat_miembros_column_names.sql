/*
  # Corregir Nombres de Columnas en chat_miembros
  
  ## Problema
  El código frontend usa nombres de columna diferentes:
  - Código usa: `rol_al_unirse` pero tabla tiene: `rol`
  - Código usa: `unido_at` pero tabla tiene: `joined_at`
  
  ## Solución
  Agregar columna `rol_al_unirse` y alias `unido_at` para compatibilidad
  
  ## Cambios
  1. Agregar columna rol_al_unirse
  2. Copiar datos de rol a rol_al_unirse
  3. Mantener ambas columnas por compatibilidad
*/

-- Agregar columna rol_al_unirse si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'chat_miembros' AND column_name = 'rol_al_unirse'
  ) THEN
    ALTER TABLE chat_miembros 
    ADD COLUMN rol_al_unirse text DEFAULT 'Empleado';
    
    -- Copiar datos existentes
    UPDATE chat_miembros 
    SET rol_al_unirse = COALESCE(rol, 'Empleado');
    
    RAISE NOTICE '✅ Columna rol_al_unirse agregada';
  END IF;
END $$;

-- Agregar columna unido_at si no existe (copia de joined_at)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'chat_miembros' AND column_name = 'unido_at'
  ) THEN
    ALTER TABLE chat_miembros 
    ADD COLUMN unido_at timestamptz DEFAULT now();
    
    -- Copiar datos existentes
    UPDATE chat_miembros 
    SET unido_at = COALESCE(joined_at, now());
    
    RAISE NOTICE '✅ Columna unido_at agregada';
  END IF;
END $$;

-- Crear trigger para mantener sincronizadas las columnas
CREATE OR REPLACE FUNCTION sync_chat_miembros_columns()
RETURNS TRIGGER AS $$
BEGIN
  -- Sincronizar rol y rol_al_unirse
  IF NEW.rol_al_unirse IS NOT NULL THEN
    NEW.rol := NEW.rol_al_unirse;
  ELSIF NEW.rol IS NOT NULL THEN
    NEW.rol_al_unirse := NEW.rol;
  END IF;
  
  -- Sincronizar joined_at y unido_at
  IF NEW.unido_at IS NOT NULL THEN
    NEW.joined_at := NEW.unido_at;
  ELSIF NEW.joined_at IS NOT NULL THEN
    NEW.unido_at := NEW.joined_at;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sync_chat_miembros_trigger ON chat_miembros;
CREATE TRIGGER sync_chat_miembros_trigger
BEFORE INSERT OR UPDATE ON chat_miembros
FOR EACH ROW
EXECUTE FUNCTION sync_chat_miembros_columns();

-- Log de confirmación
DO $$
BEGIN
  RAISE NOTICE '✅ Columnas de chat_miembros sincronizadas';
  RAISE NOTICE '✅ Ahora puedes usar rol_al_unirse o rol';
  RAISE NOTICE '✅ Ahora puedes usar unido_at o joined_at';
END $$;
