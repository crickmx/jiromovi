/*
  # Agregar columna para_todos a comunicados_visibilidad
  
  ## Descripción
  Agrega la columna `para_todos` a la tabla `comunicados_visibilidad`
  para permitir que los administradores creen comunicados visibles
  para todos los usuarios sin necesidad de especificar roles u oficinas.
  
  ## Cambios
  1. Nueva Columna
     - `para_todos` (boolean, default false)
     - Indica si el comunicado es visible para todos los usuarios
  
  ## Uso
  - Si para_todos = true → Comunicado visible para todos
  - Si para_todos = false → Comunicado visible según rol/oficina/usuario
*/

-- Agregar columna para_todos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'comunicados_visibilidad'
    AND column_name = 'para_todos'
  ) THEN
    ALTER TABLE comunicados_visibilidad
    ADD COLUMN para_todos BOOLEAN DEFAULT false;
    
    CREATE INDEX IF NOT EXISTS idx_comunicados_visibilidad_para_todos
    ON comunicados_visibilidad(para_todos)
    WHERE para_todos = true;
  END IF;
END $$;

-- Log
DO $$
BEGIN
  RAISE NOTICE '✅ Columna para_todos agregada a comunicados_visibilidad';
  RAISE NOTICE '✅ Índice creado para para_todos = true';
END $$;
