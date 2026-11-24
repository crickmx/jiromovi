/*
  # Actualizar Registro de Actividades - Cambiar Avance por Estatus

  1. Cambios
    - Actualizar constraint de progress_percent para solo permitir 0, 50, 100
    - 0 = Iniciado
    - 50 = En Proceso
    - 100 = Terminado
    - Actualizar registros existentes con valores 25 o 75 a valores válidos

  2. Notas
    - Los valores 25 se mapean a 50 (En Proceso)
    - Los valores 75 se mapean a 50 (En Proceso)
*/

-- Actualizar registros existentes con valores intermedios
UPDATE tickets
SET progress_percent = 50
WHERE progress_percent IN (25, 75)
  AND tipo_tramite = 'registro_actividad';

-- Eliminar constraint existente
ALTER TABLE tickets DROP CONSTRAINT IF EXISTS tickets_progress_percent_check;

-- Crear nuevo constraint con solo 3 valores
ALTER TABLE tickets ADD CONSTRAINT tickets_progress_percent_check 
CHECK (progress_percent = ANY (ARRAY[0, 50, 100]));

COMMENT ON COLUMN tickets.progress_percent IS 
'Estatus del registro de actividad: 0=Iniciado, 50=En Proceso, 100=Terminado';
