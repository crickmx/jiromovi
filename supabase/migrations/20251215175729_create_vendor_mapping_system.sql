/*
  # Sistema de Mapeo de Vendedores

  1. Objetivo
    - Resolver casos donde vendedores en documentos no se reconocen en MOVI
    - Permitir asignación manual persistente
    - Auto-aplicar en futuros lotes

  2. Nueva Tabla
    - vendor_mappings: Mapeos persistentes de vendedores externos a usuarios MOVI

  3. Campos en Comisiones
    - Agregar campos de tracking de vendedor
    - vendor_email_raw, vendor_name_raw, vendor_key
    - match_method, is_unmatched

  4. Funciones
    - normalize_email: Normalizar emails
    - normalize_name: Normalizar nombres
    - find_vendor_mapping: Buscar mapeo automático
    - apply_vendor_mappings: Aplicar mapeos a lote

  5. Security
    - RLS en vendor_mappings (solo admins)
*/

-- ============================================
-- TABLA DE MAPEOS DE VENDEDORES
-- ============================================

CREATE TABLE IF NOT EXISTS vendor_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type TEXT NOT NULL CHECK (source_type IN ('email', 'name')),
  source_value TEXT NOT NULL,
  source_raw_examples JSONB DEFAULT '[]'::jsonb,
  movi_user_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_by UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (source_type, source_value)
);

CREATE INDEX IF NOT EXISTS idx_vendor_mappings_source ON vendor_mappings(source_type, source_value);
CREATE INDEX IF NOT EXISTS idx_vendor_mappings_user ON vendor_mappings(movi_user_id);
CREATE INDEX IF NOT EXISTS idx_vendor_mappings_status ON vendor_mappings(status);

-- ============================================
-- AGREGAR CAMPOS A COMMISSION_DETAILS
-- ============================================

DO $$
BEGIN
  -- Agregar vendor_email_raw
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'commission_details' AND column_name = 'vendor_email_raw'
  ) THEN
    ALTER TABLE commission_details ADD COLUMN vendor_email_raw TEXT;
  END IF;

  -- Agregar vendor_name_raw
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'commission_details' AND column_name = 'vendor_name_raw'
  ) THEN
    ALTER TABLE commission_details ADD COLUMN vendor_name_raw TEXT;
  END IF;

  -- Agregar vendor_key
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'commission_details' AND column_name = 'vendor_key'
  ) THEN
    ALTER TABLE commission_details ADD COLUMN vendor_key TEXT;
  END IF;

  -- Agregar match_method
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'commission_details' AND column_name = 'match_method'
  ) THEN
    ALTER TABLE commission_details
    ADD COLUMN match_method TEXT CHECK (
      match_method IN ('direct_email', 'mapping_email', 'mapping_name', 'manual', 'none')
    );
  END IF;

  -- Agregar is_unmatched
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'commission_details' AND column_name = 'is_unmatched'
  ) THEN
    ALTER TABLE commission_details ADD COLUMN is_unmatched BOOLEAN DEFAULT false;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_commission_details_vendor_key ON commission_details(vendor_key);
CREATE INDEX IF NOT EXISTS idx_commission_details_unmatched ON commission_details(batch_id, is_unmatched) WHERE is_unmatched = true;

-- ============================================
-- AGREGAR CAMPOS A COMMISSION_AGENTS
-- ============================================

DO $$
BEGIN
  -- Agregar phone para notificaciones
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'commission_agents' AND column_name = 'phone'
  ) THEN
    ALTER TABLE commission_agents ADD COLUMN phone TEXT;
  END IF;
END $$;

-- ============================================
-- FUNCIONES DE NORMALIZACIÓN
-- ============================================

-- Normalizar email: trim + lowercase
CREATE OR REPLACE FUNCTION normalize_email(email TEXT)
RETURNS TEXT AS $$
BEGIN
  IF email IS NULL OR TRIM(email) = '' THEN
    RETURN NULL;
  END IF;

  RETURN LOWER(TRIM(email));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Normalizar nombre: trim + lowercase + quitar acentos + dobles espacios
CREATE OR REPLACE FUNCTION normalize_name(name TEXT)
RETURNS TEXT AS $$
DECLARE
  normalized TEXT;
BEGIN
  IF name IS NULL OR TRIM(name) = '' THEN
    RETURN NULL;
  END IF;

  -- Trim y lowercase
  normalized := LOWER(TRIM(name));

  -- Quitar acentos
  normalized := TRANSLATE(normalized,
    'áéíóúàèìòùäëïöüâêîôûãõñçÁÉÍÓÚÀÈÌÒÙÄËÏÖÜÂÊÎÔÛÃÕÑÇ',
    'aeiouaeiouaeiouaeiouaoncAEIOUAEIOUAEIOUAEIOUAONC'
  );

  -- Quitar dobles espacios
  normalized := REGEXP_REPLACE(normalized, '\s+', ' ', 'g');

  RETURN normalized;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Calcular vendor_key
CREATE OR REPLACE FUNCTION calculate_vendor_key(vendor_email TEXT, vendor_name TEXT)
RETURNS TEXT AS $$
DECLARE
  normalized_email TEXT;
  normalized_name TEXT;
BEGIN
  normalized_email := normalize_email(vendor_email);
  normalized_name := normalize_name(vendor_name);

  -- Prioridad a email
  IF normalized_email IS NOT NULL THEN
    RETURN 'email:' || normalized_email;
  END IF;

  -- Si no hay email, usar nombre
  IF normalized_name IS NOT NULL THEN
    RETURN 'name:' || normalized_name;
  END IF;

  -- Si no hay nada, unknown
  RETURN 'unknown';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================
-- FUNCIÓN PARA BUSCAR MAPEO AUTOMÁTICO
-- ============================================

CREATE OR REPLACE FUNCTION find_vendor_mapping(vendor_email TEXT, vendor_name TEXT)
RETURNS TABLE (
  movi_user_id UUID,
  match_method TEXT,
  mapping_id UUID
) AS $$
DECLARE
  normalized_email TEXT;
  normalized_name TEXT;
  result_record RECORD;
BEGIN
  normalized_email := normalize_email(vendor_email);
  normalized_name := normalize_name(vendor_name);

  -- Paso 1: Buscar por email directo en usuarios
  IF normalized_email IS NOT NULL THEN
    SELECT u.id, 'direct_email'::TEXT, NULL::UUID
    INTO result_record
    FROM usuarios u
    WHERE normalize_email(u.email) = normalized_email
    LIMIT 1;

    IF FOUND THEN
      RETURN QUERY SELECT result_record.id, result_record.match_method, result_record.mapping_id;
      RETURN;
    END IF;
  END IF;

  -- Paso 2: Buscar mapeo por email
  IF normalized_email IS NOT NULL THEN
    SELECT vm.movi_user_id, 'mapping_email'::TEXT, vm.id
    INTO result_record
    FROM vendor_mappings vm
    WHERE vm.source_type = 'email'
      AND vm.source_value = normalized_email
      AND vm.status = 'active'
    LIMIT 1;

    IF FOUND THEN
      RETURN QUERY SELECT result_record.movi_user_id, result_record.match_method, result_record.id;
      RETURN;
    END IF;
  END IF;

  -- Paso 3: Buscar mapeo por nombre
  IF normalized_name IS NOT NULL THEN
    SELECT vm.movi_user_id, 'mapping_name'::TEXT, vm.id
    INTO result_record
    FROM vendor_mappings vm
    WHERE vm.source_type = 'name'
      AND vm.source_value = normalized_name
      AND vm.status = 'active'
    LIMIT 1;

    IF FOUND THEN
      RETURN QUERY SELECT result_record.movi_user_id, result_record.match_method, result_record.id;
      RETURN;
    END IF;
  END IF;

  -- No se encontró match
  RETURN QUERY SELECT NULL::UUID, 'none'::TEXT, NULL::UUID;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- FUNCIÓN PARA APLICAR MAPEOS A UN LOTE
-- ============================================

CREATE OR REPLACE FUNCTION apply_vendor_mappings_to_batch(batch_id_param UUID)
RETURNS TABLE (
  total_processed INTEGER,
  matched INTEGER,
  still_unmatched INTEGER
) AS $$
DECLARE
  total_count INTEGER := 0;
  matched_count INTEGER := 0;
  unmatched_count INTEGER := 0;
  detail_record RECORD;
  mapping_result RECORD;
BEGIN
  -- Procesar cada detalle sin match
  FOR detail_record IN
    SELECT id, vendor_email_raw, vendor_name_raw
    FROM commission_details
    WHERE batch_id = batch_id_param
      AND (is_unmatched = true OR agent_id IS NULL OR match_method IS NULL)
  LOOP
    total_count := total_count + 1;

    -- Buscar mapeo
    SELECT * INTO mapping_result
    FROM find_vendor_mapping(detail_record.vendor_email_raw, detail_record.vendor_name_raw);

    IF mapping_result.movi_user_id IS NOT NULL THEN
      -- Actualizar el detalle con el match encontrado
      UPDATE commission_details
      SET
        agent_id = (SELECT id FROM commission_agents WHERE email = (SELECT email FROM usuarios WHERE id = mapping_result.movi_user_id) LIMIT 1),
        match_method = mapping_result.match_method,
        is_unmatched = false,
        updated_at = now()
      WHERE id = detail_record.id;

      matched_count := matched_count + 1;
    ELSE
      -- Sigue sin match
      UPDATE commission_details
      SET
        is_unmatched = true,
        match_method = 'none',
        updated_at = now()
      WHERE id = detail_record.id;

      unmatched_count := unmatched_count + 1;
    END IF;
  END LOOP;

  RETURN QUERY SELECT total_count, matched_count, unmatched_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- FUNCIÓN PARA OBTENER VENDEDORES NO RECONOCIDOS DE UN LOTE
-- ============================================

CREATE OR REPLACE FUNCTION get_unmatched_vendors_by_batch(batch_id_param UUID)
RETURNS TABLE (
  vendor_key TEXT,
  vendor_type TEXT,
  vendor_email TEXT,
  vendor_name TEXT,
  polizas_count BIGINT,
  total_commission NUMERIC,
  example_polizas JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    cd.vendor_key,
    CASE
      WHEN cd.vendor_email_raw IS NOT NULL AND cd.vendor_email_raw != '' THEN 'email'
      WHEN cd.vendor_name_raw IS NOT NULL AND cd.vendor_name_raw != '' THEN 'name'
      ELSE 'unknown'
    END as vendor_type,
    COALESCE(cd.vendor_email_raw, '') as vendor_email,
    COALESCE(cd.vendor_name_raw, '') as vendor_name,
    COUNT(cd.id) as polizas_count,
    COALESCE(SUM(cd.commission_neta), 0) as total_commission,
    jsonb_agg(
      jsonb_build_object(
        'id', cd.id,
        'poliza', cd.poliza,
        'ramo', cd.ramo,
        'aseguradora', cd.aseguradora,
        'prima_base', cd.prima_base,
        'commission_neta', cd.commission_neta
      )
    ) FILTER (WHERE cd.id IS NOT NULL) as example_polizas
  FROM commission_details cd
  WHERE cd.batch_id = batch_id_param
    AND cd.is_unmatched = true
  GROUP BY cd.vendor_key, cd.vendor_email_raw, cd.vendor_name_raw
  ORDER BY polizas_count DESC;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- FUNCIÓN PARA ASIGNAR VENDEDOR MANUALMENTE
-- ============================================

CREATE OR REPLACE FUNCTION assign_vendor_manually(
  batch_id_param UUID,
  vendor_key_param TEXT,
  movi_user_id_param UUID,
  save_mapping BOOLEAN DEFAULT true,
  created_by_param UUID DEFAULT NULL
)
RETURNS TABLE (
  updated_count INTEGER,
  mapping_created BOOLEAN
) AS $$
DECLARE
  update_count INTEGER := 0;
  mapping_exists BOOLEAN := false;
  vendor_email_sample TEXT;
  vendor_name_sample TEXT;
  source_type_value TEXT;
  source_value_normalized TEXT;
BEGIN
  -- Obtener ejemplos de vendor
  SELECT vendor_email_raw, vendor_name_raw
  INTO vendor_email_sample, vendor_name_sample
  FROM commission_details
  WHERE batch_id = batch_id_param AND vendor_key = vendor_key_param
  LIMIT 1;

  -- Actualizar todas las pólizas con ese vendor_key en el lote
  WITH updated AS (
    UPDATE commission_details
    SET
      agent_id = (SELECT id FROM commission_agents WHERE email = (SELECT email FROM usuarios WHERE id = movi_user_id_param) LIMIT 1),
      match_method = 'manual',
      is_unmatched = false,
      updated_at = now()
    WHERE batch_id = batch_id_param AND vendor_key = vendor_key_param
    RETURNING id
  )
  SELECT COUNT(*) INTO update_count FROM updated;

  -- Guardar mapeo si se solicita
  IF save_mapping THEN
    -- Determinar source_type y source_value
    IF vendor_email_sample IS NOT NULL AND vendor_email_sample != '' THEN
      source_type_value := 'email';
      source_value_normalized := normalize_email(vendor_email_sample);
    ELSIF vendor_name_sample IS NOT NULL AND vendor_name_sample != '' THEN
      source_type_value := 'name';
      source_value_normalized := normalize_name(vendor_name_sample);
    ELSE
      source_type_value := NULL;
      source_value_normalized := NULL;
    END IF;

    IF source_type_value IS NOT NULL AND source_value_normalized IS NOT NULL THEN
      -- Insertar o actualizar mapeo
      INSERT INTO vendor_mappings (
        source_type,
        source_value,
        movi_user_id,
        status,
        created_by,
        updated_by,
        source_raw_examples
      )
      VALUES (
        source_type_value,
        source_value_normalized,
        movi_user_id_param,
        'active',
        created_by_param,
        created_by_param,
        jsonb_build_array(
          jsonb_build_object(
            'email', vendor_email_sample,
            'name', vendor_name_sample
          )
        )
      )
      ON CONFLICT (source_type, source_value)
      DO UPDATE SET
        movi_user_id = movi_user_id_param,
        updated_by = created_by_param,
        updated_at = now(),
        status = 'active';

      mapping_exists := true;
    END IF;
  END IF;

  RETURN QUERY SELECT update_count, mapping_exists;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- TRIGGER PARA UPDATED_AT EN VENDOR_MAPPINGS
-- ============================================

CREATE OR REPLACE FUNCTION update_vendor_mappings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_vendor_mappings_updated_at ON vendor_mappings;
CREATE TRIGGER trigger_vendor_mappings_updated_at
  BEFORE UPDATE ON vendor_mappings
  FOR EACH ROW
  EXECUTE FUNCTION update_vendor_mappings_updated_at();

-- ============================================
-- RLS POLICIES PARA VENDOR_MAPPINGS
-- ============================================

ALTER TABLE vendor_mappings ENABLE ROW LEVEL SECURITY;

-- Solo admins pueden ver mapeos
CREATE POLICY "Admins pueden ver todos los mapeos"
  ON vendor_mappings FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid() AND rol = 'admin'
    )
  );

-- Solo admins pueden crear mapeos
CREATE POLICY "Admins pueden crear mapeos"
  ON vendor_mappings FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid() AND rol = 'admin'
    )
  );

-- Solo admins pueden actualizar mapeos
CREATE POLICY "Admins pueden actualizar mapeos"
  ON vendor_mappings FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid() AND rol = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid() AND rol = 'admin'
    )
  );

-- Solo admins pueden eliminar mapeos
CREATE POLICY "Admins pueden eliminar mapeos"
  ON vendor_mappings FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid() AND rol = 'admin'
    )
  );