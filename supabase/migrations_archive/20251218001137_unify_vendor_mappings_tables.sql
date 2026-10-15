/*
  # Unificación de Tablas de Mapeo de Vendedores

  ## Problema
  Se crearon dos tablas distintas para el mismo propósito:
  1. `vendor_mappings` - usada por Producción
  2. `vendor_mapping_persistent` - usada por Comisiones

  Esto causaba que los mapeos creados en un módulo NO se reflejaran en el otro.

  ## Solución
  1. Migrar datos de `vendor_mapping_persistent` a `vendor_mappings`
  2. Actualizar función `apply_vendor_mapping_to_batch` para usar `vendor_mappings`
  3. Agregar política RLS para que todos puedan leer `vendor_mappings`
  4. Deprecar `vendor_mapping_persistent` (renombrar)

  ## Cambios
  - Migración de datos entre tablas
  - Actualización de función PostgreSQL
  - Actualización de políticas RLS
  - Tabla legacy renombrada
*/

-- =============================================
-- PASO 1: Verificar y crear vendor_mappings si no existe
-- =============================================
CREATE TABLE IF NOT EXISTS vendor_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identificación del vendedor externo
  source_type text NOT NULL CHECK (source_type IN ('email', 'name')),
  source_value text NOT NULL, -- normalizado (lowercase, trimmed)
  source_raw_examples jsonb DEFAULT '[]'::jsonb,

  -- Usuario MOVI asignado
  movi_user_id uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,

  -- Estado y control
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  notes text,

  -- Auditoría
  created_by uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Índices
CREATE UNIQUE INDEX IF NOT EXISTS idx_vendor_mappings_unique_source
  ON vendor_mappings(source_type, source_value)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_vendor_mappings_user
  ON vendor_mappings(movi_user_id);

CREATE INDEX IF NOT EXISTS idx_vendor_mappings_status
  ON vendor_mappings(status);

-- =============================================
-- PASO 2: Migrar datos de vendor_mapping_persistent a vendor_mappings
-- =============================================

-- Primero, convertir vendor_key a source_type y source_value
DO $$
DECLARE
  v_rec RECORD;
  v_source_type TEXT;
  v_source_value TEXT;
BEGIN
  -- Solo si existe la tabla vendor_mapping_persistent
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'vendor_mapping_persistent') THEN

    FOR v_rec IN
      SELECT * FROM vendor_mapping_persistent WHERE is_active = true
    LOOP
      -- Parsear vendor_key: "email:xxx" o "name:xxx"
      IF v_rec.vendor_key LIKE 'email:%' THEN
        v_source_type := 'email';
        v_source_value := SUBSTRING(v_rec.vendor_key FROM 7); -- Después de "email:"
      ELSIF v_rec.vendor_key LIKE 'name:%' THEN
        v_source_type := 'name';
        v_source_value := SUBSTRING(v_rec.vendor_key FROM 6); -- Después de "name:"
      ELSE
        -- Formato desconocido, asumir name
        v_source_type := 'name';
        v_source_value := v_rec.vendor_key;
      END IF;

      -- Insertar en vendor_mappings (ignorar duplicados)
      INSERT INTO vendor_mappings (
        source_type,
        source_value,
        movi_user_id,
        status,
        notes,
        created_by,
        updated_by,
        created_at,
        updated_at
      ) VALUES (
        v_source_type,
        v_source_value,
        v_rec.movi_user_id,
        CASE WHEN v_rec.is_active THEN 'active' ELSE 'inactive' END,
        COALESCE(v_rec.notes, 'Migrado desde vendor_mapping_persistent'),
        v_rec.assigned_by,
        v_rec.assigned_by,
        v_rec.created_at,
        v_rec.updated_at
      )
      ON CONFLICT (source_type, source_value) WHERE status = 'active'
      DO UPDATE SET
        movi_user_id = EXCLUDED.movi_user_id,
        notes = COALESCE(vendor_mappings.notes, '') || ' | ' || COALESCE(EXCLUDED.notes, ''),
        updated_by = EXCLUDED.updated_by,
        updated_at = EXCLUDED.updated_at;

    END LOOP;

    RAISE NOTICE 'Migración completada desde vendor_mapping_persistent';
  END IF;
END $$;

-- =============================================
-- PASO 3: Actualizar función apply_vendor_mapping_to_batch
-- =============================================

CREATE OR REPLACE FUNCTION apply_vendor_mapping_to_batch(
  p_batch_id uuid,
  p_vendor_key text,
  p_movi_user_id uuid,
  p_assigned_by uuid
)
RETURNS jsonb AS $$
DECLARE
  v_updated_count integer;
  v_mapping_id uuid;
  v_source_type text;
  v_source_value text;
BEGIN
  -- Parsear vendor_key: "email:xxx" o "name:xxx"
  IF p_vendor_key LIKE 'email:%' THEN
    v_source_type := 'email';
    v_source_value := SUBSTRING(p_vendor_key FROM 7);
  ELSIF p_vendor_key LIKE 'name:%' THEN
    v_source_type := 'name';
    v_source_value := SUBSTRING(p_vendor_key FROM 6);
  ELSE
    -- Formato desconocido, asumir name
    v_source_type := 'name';
    v_source_value := p_vendor_key;
  END IF;

  -- Crear o actualizar el mapping en vendor_mappings (tabla unificada)
  INSERT INTO vendor_mappings (
    source_type,
    source_value,
    movi_user_id,
    status,
    created_by,
    updated_by
  ) VALUES (
    v_source_type,
    v_source_value,
    p_movi_user_id,
    'active',
    p_assigned_by,
    p_assigned_by
  )
  ON CONFLICT (source_type, source_value) WHERE status = 'active'
  DO UPDATE SET
    movi_user_id = p_movi_user_id,
    updated_by = p_assigned_by,
    updated_at = now()
  RETURNING id INTO v_mapping_id;

  -- Aplicar el mapping a todos los items del lote con ese vendor_key
  UPDATE commission_details
  SET
    agent_id = p_movi_user_id,
    movi_user_id = p_movi_user_id,
    pending_assignment = false,
    match_method = 'manual',
    assignment_status = 'assigned'
  WHERE
    batch_id = p_batch_id
    AND vendor_key = p_vendor_key
    AND pending_assignment = true;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  -- Actualizar contadores del lote
  UPDATE commission_batches
  SET
    pending_count = (
      SELECT COUNT(*)
      FROM commission_details
      WHERE batch_id = p_batch_id AND pending_assignment = true
    ),
    has_pending_assignments = (
      SELECT COUNT(*) > 0
      FROM commission_details
      WHERE batch_id = p_batch_id AND pending_assignment = true
    ),
    updated_at = now()
  WHERE id = p_batch_id;

  RETURN jsonb_build_object(
    'success', true,
    'mapping_id', v_mapping_id,
    'updated_count', v_updated_count
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- PASO 4: Actualizar get_unrecognized_vendors_for_batch
-- =============================================

CREATE OR REPLACE FUNCTION get_unrecognized_vendors_for_batch(p_batch_id uuid)
RETURNS TABLE (
  vendor_key text,
  vendor_name_raw text,
  vendor_email_raw text,
  items_count bigint,
  total_commission double precision,
  has_existing_mapping boolean
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    cd.vendor_key,
    MAX(cd.vendor_name_raw) as vendor_name_raw,
    MAX(cd.vendor_email_raw) as vendor_email_raw,
    COUNT(*) as items_count,
    SUM(COALESCE(cd.commission_calculada, cd.commission_bruta, 0)) as total_commission,
    EXISTS (
      SELECT 1 FROM vendor_mappings vm
      WHERE (
        (cd.vendor_key LIKE 'email:%' AND vm.source_type = 'email' AND vm.source_value = SUBSTRING(cd.vendor_key FROM 7))
        OR
        (cd.vendor_key LIKE 'name:%' AND vm.source_type = 'name' AND vm.source_value = SUBSTRING(cd.vendor_key FROM 6))
      )
      AND vm.status = 'active'
    ) as has_existing_mapping
  FROM commission_details cd
  WHERE
    cd.batch_id = p_batch_id
    AND cd.pending_assignment = true
    AND cd.vendor_key IS NOT NULL
  GROUP BY cd.vendor_key
  ORDER BY items_count DESC, total_commission DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- PASO 5: Actualizar políticas RLS de vendor_mappings
-- =============================================

-- Habilitar RLS si no está habilitado
ALTER TABLE vendor_mappings ENABLE ROW LEVEL SECURITY;

-- Eliminar políticas anteriores que podrían ser restrictivas
DROP POLICY IF EXISTS "Admins can view all vendor mappings" ON vendor_mappings;
DROP POLICY IF EXISTS "Admins can create vendor mappings" ON vendor_mappings;
DROP POLICY IF EXISTS "Admins can update vendor mappings" ON vendor_mappings;
DROP POLICY IF EXISTS "Admins can delete vendor mappings" ON vendor_mappings;

-- NUEVA POLÍTICA: Todos los autenticados pueden leer (necesario para matching)
CREATE POLICY "Authenticated users can view vendor mappings"
  ON vendor_mappings FOR SELECT
  TO authenticated
  USING (true);

-- Administradores pueden crear mapeos
CREATE POLICY "Admins can create vendor mappings"
  ON vendor_mappings FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol IN ('Administrador', 'administrador', 'admin')
    )
  );

-- Administradores pueden actualizar mapeos
CREATE POLICY "Admins can update vendor mappings"
  ON vendor_mappings FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol IN ('Administrador', 'administrador', 'admin')
    )
  );

-- Administradores pueden eliminar mapeos
CREATE POLICY "Admins can delete vendor mappings"
  ON vendor_mappings FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol IN ('Administrador', 'administrador', 'admin')
    )
  );

-- =============================================
-- PASO 6: Deprecar vendor_mapping_persistent (NO eliminar por seguridad)
-- =============================================

-- Renombrar tabla para marcarla como legacy
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'vendor_mapping_persistent') THEN
    ALTER TABLE vendor_mapping_persistent RENAME TO vendor_mapping_persistent_legacy;
    COMMENT ON TABLE vendor_mapping_persistent_legacy IS 'DEPRECATED: Tabla migrada a vendor_mappings. No usar. Mantener solo para auditoría histórica.';
    RAISE NOTICE 'Tabla vendor_mapping_persistent renombrada a vendor_mapping_persistent_legacy';
  END IF;
END $$;

-- =============================================
-- COMENTARIOS Y DOCUMENTACIÓN
-- =============================================

COMMENT ON TABLE vendor_mappings IS 'Tabla unificada de mapeos vendedor→usuario. Usada por Comisiones y Producción. Fuente única de verdad.';
COMMENT ON FUNCTION apply_vendor_mapping_to_batch IS 'Aplica mapping a lote de comisiones. ACTUALIZADO para usar vendor_mappings unificada.';
COMMENT ON FUNCTION get_unrecognized_vendors_for_batch IS 'Lista vendedores no reconocidos. ACTUALIZADO para usar vendor_mappings unificada.';
