/*
  # Corregir columnas updated_at faltantes

  ## Descripción
  Agrega la columna updated_at a las tablas que tienen triggers pero les falta la columna.

  ## Cambios
  - Agrega columna updated_at a tabla oficinas
  - Inicializa con created_at para registros existentes

  ## Seguridad
  - No hay cambios en RLS
*/

-- Agregar updated_at a oficinas
ALTER TABLE oficinas 
ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now() NOT NULL;

-- Inicializar con created_at para registros existentes
UPDATE oficinas 
SET updated_at = created_at 
WHERE updated_at IS NULL;
