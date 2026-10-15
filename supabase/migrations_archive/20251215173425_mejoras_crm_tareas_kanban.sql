/*
  # Mejoras al módulo de Tareas CRM - Kanban

  1. Cambios en Schema
    - Agregar campo `estatus` (Pendiente, En Proceso, Completada)
    - Agregar campo `prioridad` (Alta, Media, Baja)
    - Remover campo `asignado_a` (las tareas son 100% personales)
    - Asegurar que `creado_por` es obligatorio
    - Hacer `contacto_id` opcional (no todas las tareas requieren contacto)

  2. Datos
    - Migrar datos existentes a los nuevos campos
    - Las tareas con completada=true → estatus='Completada'
    - Las tareas con completada=false → estatus='Pendiente'
    - Todas las tareas sin prioridad → prioridad='Media'

  3. Políticas RLS
    - Tareas 100% personales
    - Un usuario solo puede ver/editar/eliminar sus propias tareas
    - Basado en creado_por = auth.uid()

  4. Índices
    - Índice para estatus
    - Índice para prioridad
    - Índice combinado para filtros rápidos
*/

-- ============================================
-- PASO 1: AGREGAR NUEVOS CAMPOS
-- ============================================

-- Agregar campo estatus
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'crm_tareas' AND column_name = 'estatus'
  ) THEN
    ALTER TABLE crm_tareas
    ADD COLUMN estatus TEXT DEFAULT 'Pendiente' CHECK (estatus IN ('Pendiente', 'En Proceso', 'Completada'));
  END IF;
END $$;

-- Agregar campo prioridad
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'crm_tareas' AND column_name = 'prioridad'
  ) THEN
    ALTER TABLE crm_tareas
    ADD COLUMN prioridad TEXT DEFAULT 'Media' CHECK (prioridad IN ('Alta', 'Media', 'Baja'));
  END IF;
END $$;

-- ============================================
-- PASO 2: MIGRAR DATOS EXISTENTES
-- ============================================

-- Actualizar estatus basado en completada
UPDATE crm_tareas
SET estatus = CASE
  WHEN completada = true THEN 'Completada'
  ELSE 'Pendiente'
END
WHERE estatus IS NULL OR estatus = 'Pendiente';

-- Establecer prioridad por defecto
UPDATE crm_tareas
SET prioridad = 'Media'
WHERE prioridad IS NULL;

-- ============================================
-- PASO 3: MODIFICAR ESTRUCTURA
-- ============================================

-- Hacer contacto_id opcional
ALTER TABLE crm_tareas
ALTER COLUMN contacto_id DROP NOT NULL;

-- Hacer creado_por obligatorio si no lo es
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'crm_tareas'
    AND column_name = 'creado_por'
    AND is_nullable = 'YES'
  ) THEN
    UPDATE crm_tareas
    SET creado_por = (SELECT id FROM usuarios LIMIT 1)
    WHERE creado_por IS NULL;

    ALTER TABLE crm_tareas
    ALTER COLUMN creado_por SET NOT NULL;
  END IF;
END $$;

-- Eliminar columna asignado_a si existe (tareas 100% personales)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'crm_tareas' AND column_name = 'asignado_a'
  ) THEN
    ALTER TABLE crm_tareas DROP COLUMN asignado_a;
  END IF;
END $$;

-- ============================================
-- PASO 4: CREAR ÍNDICES PARA PERFORMANCE
-- ============================================

CREATE INDEX IF NOT EXISTS idx_crm_tareas_estatus
ON crm_tareas(estatus);

CREATE INDEX IF NOT EXISTS idx_crm_tareas_prioridad
ON crm_tareas(prioridad);

CREATE INDEX IF NOT EXISTS idx_crm_tareas_creado_por
ON crm_tareas(creado_por);

CREATE INDEX IF NOT EXISTS idx_crm_tareas_creado_estatus
ON crm_tareas(creado_por, estatus, fecha_vencimiento DESC);

-- ============================================
-- PASO 5: ACTUALIZAR POLÍTICAS RLS
-- ============================================

DROP POLICY IF EXISTS "Usuarios pueden ver solo sus tareas" ON crm_tareas;
DROP POLICY IF EXISTS "Usuarios pueden crear sus tareas" ON crm_tareas;
DROP POLICY IF EXISTS "Usuarios pueden actualizar sus tareas" ON crm_tareas;
DROP POLICY IF EXISTS "Usuarios pueden eliminar sus tareas" ON crm_tareas;

CREATE POLICY "Usuarios pueden ver solo sus tareas"
  ON crm_tareas FOR SELECT
  TO authenticated
  USING (creado_por = auth.uid());

CREATE POLICY "Usuarios pueden crear sus tareas"
  ON crm_tareas FOR INSERT
  TO authenticated
  WITH CHECK (creado_por = auth.uid());

CREATE POLICY "Usuarios pueden actualizar sus tareas"
  ON crm_tareas FOR UPDATE
  TO authenticated
  USING (creado_por = auth.uid())
  WITH CHECK (creado_por = auth.uid());

CREATE POLICY "Usuarios pueden eliminar sus tareas"
  ON crm_tareas FOR DELETE
  TO authenticated
  USING (creado_por = auth.uid());

-- ============================================
-- PASO 6: TRIGGER PARA AUTO-COMPLETAR
-- ============================================

CREATE OR REPLACE FUNCTION sync_tarea_completada()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.estatus = 'Completada' AND (OLD.estatus IS NULL OR OLD.estatus != 'Completada') THEN
    NEW.completada := true;
    NEW.fecha_completado := now();
  END IF;

  IF NEW.estatus != 'Completada' AND OLD.estatus = 'Completada' THEN
    NEW.completada := false;
    NEW.fecha_completado := NULL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sync_tarea_completada ON crm_tareas;
CREATE TRIGGER trigger_sync_tarea_completada
  BEFORE UPDATE ON crm_tareas
  FOR EACH ROW
  EXECUTE FUNCTION sync_tarea_completada();

-- ============================================
-- PASO 7: FUNCIÓN HELPER PARA TAREAS VENCIDAS
-- ============================================

CREATE OR REPLACE FUNCTION get_tareas_vencidas()
RETURNS TABLE (
  id UUID,
  descripcion TEXT,
  tipo_actividad TEXT,
  fecha_vencimiento TIMESTAMPTZ,
  prioridad TEXT,
  estatus TEXT,
  dias_vencidos INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.id,
    t.descripcion,
    t.tipo_actividad,
    t.fecha_vencimiento,
    t.prioridad,
    t.estatus,
    EXTRACT(DAY FROM (now() - t.fecha_vencimiento))::INTEGER as dias_vencidos
  FROM crm_tareas t
  WHERE t.creado_por = auth.uid()
    AND t.estatus != 'Completada'
    AND t.fecha_vencimiento < now()
  ORDER BY t.fecha_vencimiento ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
