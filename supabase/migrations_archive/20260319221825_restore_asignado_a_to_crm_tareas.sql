/*
  # Restaurar columna asignado_a en crm_tareas

  1. Cambios en Schema
    - Agregar columna `asignado_a` de vuelta (nullable, FK a usuarios)
    - Esta columna es necesaria para tableros compartidos
    - Las tareas personales (board_id IS NULL) no usan asignado_a
    - Las tareas de tableros (board_id IS NOT NULL) pueden usar asignado_a

  2. Índices
    - Índice para asignado_a para mejorar performance de queries

  3. Notas
    - Backward compatible: tareas existentes sin asignado_a siguen funcionando
    - Solo tareas de tableros compartidos usan este campo
*/

-- ============================================
-- PASO 1: AGREGAR COLUMNA asignado_a
-- ============================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'crm_tareas' AND column_name = 'asignado_a'
  ) THEN
    ALTER TABLE crm_tareas
    ADD COLUMN asignado_a uuid REFERENCES usuarios(id) ON DELETE SET NULL;

    COMMENT ON COLUMN crm_tareas.asignado_a IS 'Usuario responsable de la tarea (solo para tableros compartidos)';
  END IF;
END $$;

-- ============================================
-- PASO 2: CREAR ÍNDICE
-- ============================================

CREATE INDEX IF NOT EXISTS idx_crm_tareas_asignado_a
ON crm_tareas(asignado_a)
WHERE asignado_a IS NOT NULL;

-- ============================================
-- PASO 3: AGREGAR COLUMNA responsable
-- ============================================

-- También agregar columna responsable para compatibilidad con el código existente
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'crm_tareas' AND column_name = 'responsable'
  ) THEN
    ALTER TABLE crm_tareas
    ADD COLUMN responsable jsonb;

    COMMENT ON COLUMN crm_tareas.responsable IS 'Información del usuario responsable (desnormalizado para performance)';
  END IF;
END $$;
