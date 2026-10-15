/*
  # Unificar Sistema de Mapeo Usuario MOVI ↔ Usuario SICAS
  
  1. Problema Identificado
    - vendor_mappings permite múltiples mapeos por usuario MOVI
    - sicas_mapeo_vendedor_usuario no tiene UNIQUE en movi_user_id
    - Sistemas de comisiones y producción tienen mapeos separados
    
  2. Solución
    - Agregar campo nombre_sicas a usuarios (fuente única de verdad)
    - Agregar UNIQUE constraint en sicas_mapeo_vendedor_usuario.movi_user_id
    - Limpiar duplicados en vendor_mappings
    - Agregar constraint para 1 solo mapeo activo por usuario en vendor_mappings
    - Sincronizar datos entre tablas
    
  3. Seguridad
    - Mantener integridad referencial
    - No perder datos históricos
    - Conservar auditoría completa
*/

-- =============================================
-- PASO 1: Agregar nombre_sicas a usuarios
-- =============================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'usuarios' AND column_name = 'nombre_sicas'
  ) THEN
    ALTER TABLE usuarios ADD COLUMN nombre_sicas TEXT;
    COMMENT ON COLUMN usuarios.nombre_sicas IS 'Nombre del usuario en SICAS - Fuente única de verdad para mapeo';
  END IF;
END $$;

-- Índice para búsquedas
CREATE INDEX IF NOT EXISTS idx_usuarios_nombre_sicas 
  ON usuarios(nombre_sicas) 
  WHERE nombre_sicas IS NOT NULL;

-- =============================================
-- PASO 2: Sincronizar nombre_sicas desde mapeos existentes
-- =============================================

-- Desde sicas_mapeo_vendedor_usuario
UPDATE usuarios u
SET nombre_sicas = sv.nombre
FROM sicas_mapeo_vendedor_usuario smu
JOIN sicas_vendedores sv ON sv.id_sicas = smu.id_sicas_vendedor
WHERE u.id = smu.movi_user_id
  AND u.nombre_sicas IS NULL;

-- =============================================
-- PASO 3: Limpiar duplicados en vendor_mappings
-- =============================================

-- Desactivar mapeos duplicados, dejando solo el más reciente por usuario
WITH ranked_mappings AS (
  SELECT 
    id,
    movi_user_id,
    ROW_NUMBER() OVER (
      PARTITION BY movi_user_id 
      ORDER BY created_at DESC
    ) as rn
  FROM vendor_mappings
  WHERE status = 'active'
)
UPDATE vendor_mappings vm
SET 
  status = 'inactive',
  notes = COALESCE(notes || ' | ', '') || 'Desactivado automáticamente: mapeo duplicado'
FROM ranked_mappings rm
WHERE vm.id = rm.id
  AND rm.rn > 1;

-- =============================================
-- PASO 4: Agregar constraint UNIQUE en sicas_mapeo_vendedor_usuario
-- =============================================

-- Primero verificar si hay duplicados
DO $$
DECLARE
  duplicate_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO duplicate_count
  FROM (
    SELECT movi_user_id
    FROM sicas_mapeo_vendedor_usuario
    GROUP BY movi_user_id
    HAVING COUNT(*) > 1
  ) dupes;
  
  IF duplicate_count > 0 THEN
    RAISE EXCEPTION 'Existen % usuarios con múltiples mapeos SICAS. Debe resolverse manualmente antes de aplicar constraint UNIQUE.', duplicate_count;
  END IF;
END $$;

-- Agregar constraint UNIQUE en movi_user_id
ALTER TABLE sicas_mapeo_vendedor_usuario
  DROP CONSTRAINT IF EXISTS sicas_mapeo_vendedor_usuario_movi_user_id_key;

ALTER TABLE sicas_mapeo_vendedor_usuario
  ADD CONSTRAINT sicas_mapeo_vendedor_usuario_movi_user_id_key 
  UNIQUE (movi_user_id);

COMMENT ON CONSTRAINT sicas_mapeo_vendedor_usuario_movi_user_id_key 
  ON sicas_mapeo_vendedor_usuario 
  IS 'Garantiza relación 1:1 - cada usuario MOVI solo puede tener 1 vendedor SICAS';

-- =============================================
-- PASO 5: Agregar constraint en vendor_mappings
-- =============================================

-- Crear índice UNIQUE parcial para mapeos activos
DROP INDEX IF EXISTS idx_vendor_mappings_unique_active_user;

CREATE UNIQUE INDEX idx_vendor_mappings_unique_active_user
  ON vendor_mappings(movi_user_id)
  WHERE status = 'active';

COMMENT ON INDEX idx_vendor_mappings_unique_active_user 
  IS 'Garantiza que cada usuario MOVI solo puede tener 1 mapeo activo de vendedor';

-- =============================================
-- PASO 6: Función helper para obtener nombre SICAS
-- =============================================

CREATE OR REPLACE FUNCTION get_user_nombre_sicas(p_user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_nombre_sicas TEXT;
BEGIN
  -- Primero intentar desde usuarios (fuente de verdad)
  SELECT nombre_sicas INTO v_nombre_sicas
  FROM usuarios
  WHERE id = p_user_id;
  
  IF v_nombre_sicas IS NOT NULL THEN
    RETURN v_nombre_sicas;
  END IF;
  
  -- Si no existe, buscar en sicas_mapeo_vendedor_usuario
  SELECT sv.nombre INTO v_nombre_sicas
  FROM sicas_mapeo_vendedor_usuario smu
  JOIN sicas_vendedores sv ON sv.id_sicas = smu.id_sicas_vendedor
  WHERE smu.movi_user_id = p_user_id;
  
  RETURN v_nombre_sicas;
END;
$$;

COMMENT ON FUNCTION get_user_nombre_sicas IS 'Obtiene el nombre SICAS de un usuario desde la fuente unificada';

-- =============================================
-- PASO 7: Función para sincronizar nombre_sicas
-- =============================================

CREATE OR REPLACE FUNCTION sync_nombre_sicas_on_mapping()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Cuando se crea o actualiza un mapeo, sincronizar nombre_sicas en usuarios
  IF TG_TABLE_NAME = 'sicas_mapeo_vendedor_usuario' THEN
    UPDATE usuarios
    SET nombre_sicas = (
      SELECT nombre 
      FROM sicas_vendedores 
      WHERE id_sicas = NEW.id_sicas_vendedor
    )
    WHERE id = NEW.movi_user_id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger para sincronización automática
DROP TRIGGER IF EXISTS trigger_sync_nombre_sicas ON sicas_mapeo_vendedor_usuario;

CREATE TRIGGER trigger_sync_nombre_sicas
  AFTER INSERT OR UPDATE ON sicas_mapeo_vendedor_usuario
  FOR EACH ROW
  EXECUTE FUNCTION sync_nombre_sicas_on_mapping();

-- =============================================
-- PASO 8: Vista unificada de mapeos
-- =============================================

CREATE OR REPLACE VIEW vista_mapeo_usuarios_unificado AS
SELECT 
  u.id as usuario_id,
  u.nombre_completo as nombre_movi,
  u.email_laboral,
  u.nombre_sicas,
  u.oficina_id,
  o.nombre as oficina_nombre,
  
  -- Mapeo SICAS oficial
  smu.id as sicas_mapping_id,
  smu.id_sicas_vendedor,
  sv.nombre as sicas_vendedor_nombre,
  smu.mapped_at as sicas_mapped_at,
  
  -- Commission Agent
  ca.id as commission_agent_id,
  ca.name as commission_agent_name,
  
  -- Estado de mapeos
  CASE 
    WHEN smu.id IS NOT NULL THEN 'SICAS Mapeado'
    WHEN ca.id IS NOT NULL THEN 'Comisiones Mapeado'
    ELSE 'Sin Mapeo'
  END as estado_mapeo,
  
  -- Consistencia
  CASE
    WHEN u.nombre_sicas IS NOT NULL AND smu.id IS NULL THEN 'INCONSISTENTE: nombre_sicas sin mapeo'
    WHEN u.nombre_sicas IS NULL AND smu.id IS NOT NULL THEN 'INCONSISTENTE: mapeo sin nombre_sicas'
    WHEN u.nombre_sicas != sv.nombre THEN 'INCONSISTENTE: nombres no coinciden'
    ELSE 'CONSISTENTE'
  END as estado_consistencia
  
FROM usuarios u
LEFT JOIN oficinas o ON o.id = u.oficina_id
LEFT JOIN sicas_mapeo_vendedor_usuario smu ON smu.movi_user_id = u.id
LEFT JOIN sicas_vendedores sv ON sv.id_sicas = smu.id_sicas_vendedor
LEFT JOIN commission_agents ca ON ca.usuario_id = u.id
WHERE u.deleted_at IS NULL
ORDER BY u.nombre_completo;

COMMENT ON VIEW vista_mapeo_usuarios_unificado 
  IS 'Vista consolidada de todos los mapeos de usuarios MOVI con sistemas externos';

-- Grant access
GRANT SELECT ON vista_mapeo_usuarios_unificado TO authenticated;
