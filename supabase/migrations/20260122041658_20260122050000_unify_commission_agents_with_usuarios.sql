/*
  # Unificar Commission Agents con Usuarios
  
  1. Problema
    - commission_agents duplica datos de usuarios
    - Dos sistemas de agentes: commission_agents y usuarios con nombre_sicas
    
  2. Solución
    - Migrar commission_details.agent_id -> usuario_id
    - Eliminar tabla commission_agents
    - Usar usuarios.nombre_sicas e id_sicas como identificadores SICAS únicos
    
  3. Beneficios
    - Un solo sistema de usuarios
    - Consistencia de datos
    - Menos duplicación
    - Más fácil de mantener
*/

-- =============================================
-- PASO 1: Agregar columna usuario_id a commission_details
-- =============================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'commission_details' AND column_name = 'usuario_id'
  ) THEN
    ALTER TABLE commission_details ADD COLUMN usuario_id UUID;
    CREATE INDEX IF NOT EXISTS idx_commission_details_usuario_id ON commission_details(usuario_id);
  END IF;
END $$;

-- =============================================
-- PASO 2: Migrar agent_id -> usuario_id en commission_details
-- =============================================

-- Actualizar usuario_id desde agent_id
UPDATE commission_details cd
SET usuario_id = ca.usuario_id
FROM commission_agents ca
WHERE cd.agent_id = ca.id
  AND cd.usuario_id IS NULL;

-- Verificar que todos los registros tienen usuario_id
DO $$
DECLARE
  missing_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO missing_count
  FROM commission_details
  WHERE usuario_id IS NULL;
  
  IF missing_count > 0 THEN
    RAISE WARNING 'Existen % registros de commission_details sin usuario_id - se eliminarán si no tienen agent_id válido', missing_count;
    
    -- Eliminar registros huérfanos sin agent_id válido
    DELETE FROM commission_details WHERE usuario_id IS NULL;
  END IF;
END $$;

-- =============================================
-- PASO 3: Agregar foreign key a usuario_id
-- =============================================

ALTER TABLE commission_details 
  ADD CONSTRAINT commission_details_usuario_id_fkey 
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL;

-- =============================================
-- PASO 4: Hacer usuario_id NOT NULL y eliminar agent_id
-- =============================================

-- Hacer usuario_id NOT NULL
ALTER TABLE commission_details 
  ALTER COLUMN usuario_id SET NOT NULL;

-- Eliminar constraint de agent_id
ALTER TABLE commission_details 
  DROP CONSTRAINT IF EXISTS commission_details_agent_id_fkey;

-- Eliminar columna agent_id
ALTER TABLE commission_details 
  DROP COLUMN IF EXISTS agent_id CASCADE;

COMMENT ON COLUMN commission_details.usuario_id IS 'Usuario MOVI responsable de esta comisión - reemplaza agent_id';

-- =============================================
-- PASO 5: Eliminar tabla commission_agents
-- =============================================

DROP TABLE IF EXISTS commission_agents CASCADE;

COMMENT ON TABLE commission_details IS 'Detalles de comisiones - vinculados directamente a usuarios';

-- =============================================
-- PASO 6: Agregar campo id_sicas a usuarios
-- =============================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'usuarios' AND column_name = 'id_sicas'
  ) THEN
    ALTER TABLE usuarios ADD COLUMN id_sicas TEXT;
    CREATE INDEX IF NOT EXISTS idx_usuarios_id_sicas ON usuarios(id_sicas);
    COMMENT ON COLUMN usuarios.id_sicas IS 'ID del vendedor en SICAS - sincronizado desde sicas_mapeo_vendedor_usuario';
  END IF;
END $$;

-- Sincronizar id_sicas desde mapeo existente
UPDATE usuarios u
SET id_sicas = smu.id_sicas_vendedor
FROM sicas_mapeo_vendedor_usuario smu
WHERE u.id = smu.movi_user_id
  AND u.id_sicas IS NULL;

-- =============================================
-- PASO 7: Trigger para sincronizar datos SICAS
-- =============================================

CREATE OR REPLACE FUNCTION sync_usuario_sicas_data()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_TABLE_NAME = 'sicas_mapeo_vendedor_usuario' THEN
    UPDATE usuarios
    SET 
      nombre_sicas = (SELECT nombre FROM sicas_vendedores WHERE id_sicas = NEW.id_sicas_vendedor),
      id_sicas = NEW.id_sicas_vendedor
    WHERE id = NEW.movi_user_id;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_sync_nombre_sicas ON sicas_mapeo_vendedor_usuario;
DROP TRIGGER IF EXISTS trigger_sync_usuario_sicas_data ON sicas_mapeo_vendedor_usuario;

CREATE TRIGGER trigger_sync_usuario_sicas_data
  AFTER INSERT OR UPDATE ON sicas_mapeo_vendedor_usuario
  FOR EACH ROW
  EXECUTE FUNCTION sync_usuario_sicas_data();

-- =============================================
-- PASO 8: Actualizar vista unificada
-- =============================================

DROP VIEW IF EXISTS vista_mapeo_usuarios_unificado CASCADE;

CREATE OR REPLACE VIEW vista_mapeo_usuarios_unificado AS
SELECT 
  u.id as usuario_id,
  u.nombre_completo as nombre_movi,
  u.email_laboral,
  u.nombre_sicas,
  u.id_sicas,
  u.oficina_id,
  o.nombre as oficina_nombre,
  u.regimen_fiscal_id,
  rf.name as regimen_fiscal_nombre,
  
  -- Mapeo SICAS oficial
  smu.id as sicas_mapping_id,
  smu.id_sicas_vendedor,
  sv.nombre as sicas_vendedor_nombre,
  smu.mapped_at as sicas_mapped_at,
  
  -- Comisiones
  (SELECT COUNT(*) FROM commission_details cd WHERE cd.usuario_id = u.id) as comisiones_count,
  (SELECT SUM(cd.commission_neta) FROM commission_details cd WHERE cd.usuario_id = u.id) as comisiones_total,
  
  -- Estado
  CASE 
    WHEN smu.id IS NOT NULL THEN 'SICAS Mapeado'
    WHEN EXISTS (SELECT 1 FROM commission_details cd WHERE cd.usuario_id = u.id) THEN 'Con Comisiones'
    ELSE 'Sin Mapeo'
  END as estado_mapeo,
  
  -- Consistencia
  CASE
    WHEN u.nombre_sicas IS NOT NULL AND smu.id IS NULL THEN 'INCONSISTENTE: nombre_sicas sin mapeo'
    WHEN u.nombre_sicas IS NULL AND smu.id IS NOT NULL THEN 'INCONSISTENTE: mapeo sin nombre_sicas'
    WHEN u.nombre_sicas IS NOT NULL AND sv.nombre IS NOT NULL AND u.nombre_sicas != sv.nombre THEN 'INCONSISTENTE: nombres no coinciden'
    WHEN u.id_sicas IS NOT NULL AND smu.id_sicas_vendedor IS NOT NULL AND u.id_sicas != smu.id_sicas_vendedor THEN 'INCONSISTENTE: id_sicas no coincide'
    ELSE 'CONSISTENTE'
  END as estado_consistencia
  
FROM usuarios u
LEFT JOIN oficinas o ON o.id = u.oficina_id
LEFT JOIN commission_fiscal_regimes rf ON rf.id = u.regimen_fiscal_id
LEFT JOIN sicas_mapeo_vendedor_usuario smu ON smu.movi_user_id = u.id
LEFT JOIN sicas_vendedores sv ON sv.id_sicas = smu.id_sicas_vendedor
WHERE u.deleted_at IS NULL
ORDER BY u.nombre_completo;

GRANT SELECT ON vista_mapeo_usuarios_unificado TO authenticated;

-- =============================================
-- PASO 9: Función helper
-- =============================================

CREATE OR REPLACE FUNCTION get_usuario_by_sicas_id(p_id_sicas TEXT)
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_usuario_id UUID;
BEGIN
  SELECT id INTO v_usuario_id
  FROM usuarios
  WHERE id_sicas = p_id_sicas
    AND deleted_at IS NULL
  LIMIT 1;
  
  RETURN v_usuario_id;
END;
$$;

-- =============================================
-- PASO 10: Vista de comisiones por usuario
-- =============================================

CREATE OR REPLACE VIEW vista_comisiones_por_usuario AS
SELECT 
  u.id as usuario_id,
  u.nombre_completo,
  u.nombre_sicas,
  u.id_sicas,
  u.email_laboral,
  o.nombre as oficina_nombre,
  rf.name as regimen_fiscal,
  
  COUNT(cd.id) as total_polizas,
  SUM(cd.importe_base) as total_importe_base,
  SUM(cd.commission_bruta) as total_commission_bruta,
  SUM(cd.commission_neta) as total_commission_neta,
  
  MIN(cd.created_at) as primera_comision,
  MAX(cd.created_at) as ultima_comision
  
FROM usuarios u
LEFT JOIN oficinas o ON o.id = u.oficina_id
LEFT JOIN commission_fiscal_regimes rf ON rf.id = u.regimen_fiscal_id
LEFT JOIN commission_details cd ON cd.usuario_id = u.id
WHERE u.deleted_at IS NULL
GROUP BY u.id, u.nombre_completo, u.nombre_sicas, u.id_sicas, u.email_laboral, o.nombre, rf.name
ORDER BY total_commission_neta DESC NULLS LAST;

GRANT SELECT ON vista_comisiones_por_usuario TO authenticated;
