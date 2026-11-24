
/*
  # Unify SICAS + Vendor Mappings System

  1. Trigger: when usuarios.nombre_sicas is updated, auto-create/update a vendor_mapping of type 'name'
  2. Function: run_fuzzy_vendor_match() - callable from client to run fuzzy matching for pending SICAS vendors
  3. Function: link_sicas_vendor_to_user() - manually link a SICAS vendor to a MOVI user
*/

-- ================================================
-- 1. Trigger: Auto-sync nombre_sicas → vendor_mappings
-- ================================================

CREATE OR REPLACE FUNCTION sync_nombre_sicas_to_vendor_mapping()
RETURNS TRIGGER AS $$
DECLARE
  v_normalized TEXT;
  v_existing_id UUID;
BEGIN
  -- Only fire when nombre_sicas actually changes
  IF OLD.nombre_sicas IS NOT DISTINCT FROM NEW.nombre_sicas THEN
    RETURN NEW;
  END IF;

  -- If nombre_sicas was cleared, deactivate any mapping from it
  IF NEW.nombre_sicas IS NULL OR TRIM(NEW.nombre_sicas) = '' THEN
    UPDATE vendor_mappings
    SET status = 'inactive', updated_at = NOW()
    WHERE movi_user_id = NEW.id
      AND source_type = 'name'
      AND status = 'active'
      AND notes LIKE '%auto-sync nombre_sicas%';
    RETURN NEW;
  END IF;

  -- Normalize the SICAS name
  v_normalized := LOWER(TRIM(
    REGEXP_REPLACE(
      TRANSLATE(NEW.nombre_sicas, 'ÁÉÍÓÚÜÑáéíóúüñ', 'AEIOUUNaeiouun'),
      '\s+', ' ', 'g'
    )
  ));

  -- Check if active mapping already exists for this source_value
  SELECT id INTO v_existing_id
  FROM vendor_mappings
  WHERE source_type = 'name'
    AND source_value = v_normalized
    AND status = 'active';

  IF v_existing_id IS NOT NULL THEN
    -- Update existing mapping to point to this user
    UPDATE vendor_mappings
    SET movi_user_id = NEW.id,
        updated_at = NOW(),
        notes = 'auto-sync nombre_sicas'
    WHERE id = v_existing_id;
  ELSE
    -- Deactivate any previous auto-sync mapping for this user
    UPDATE vendor_mappings
    SET status = 'inactive', updated_at = NOW()
    WHERE movi_user_id = NEW.id
      AND source_type = 'name'
      AND status = 'active'
      AND notes LIKE '%auto-sync nombre_sicas%';

    -- Create new mapping
    INSERT INTO vendor_mappings (source_type, source_value, movi_user_id, status, notes)
    VALUES ('name', v_normalized, NEW.id, 'active', 'auto-sync nombre_sicas');
  END IF;

  -- Also try to link any pending SICAS vendor with similar name
  UPDATE sicas_vendor_user_mappings
  SET movi_user_id = NEW.id,
      match_type = 'nombre_sicas_sync',
      confidence_score = 95,
      status = 'active',
      match_details = jsonb_build_object('method', 'nombre_sicas_sync', 'synced_at', NOW()),
      updated_at = NOW()
  WHERE status = 'pending_review'
    AND movi_user_id IS NULL
    AND similarity(UPPER(vend_nombre), UPPER(NEW.nombre_sicas)) >= 0.75;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_sync_nombre_sicas ON usuarios;
CREATE TRIGGER trigger_sync_nombre_sicas
AFTER UPDATE OF nombre_sicas ON usuarios
FOR EACH ROW
EXECUTE FUNCTION sync_nombre_sicas_to_vendor_mapping();

-- ================================================
-- 2. Function: Run fuzzy matching for all pending SICAS vendors
-- ================================================

CREATE OR REPLACE FUNCTION run_fuzzy_vendor_match(
  p_threshold NUMERIC DEFAULT 0.75,
  p_auto_confirm_threshold NUMERIC DEFAULT 0.92
)
RETURNS TABLE(
  vendor_id UUID,
  vend_nombre TEXT,
  matched_user_id UUID,
  matched_user_name TEXT,
  similarity_score NUMERIC,
  auto_confirmed BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  WITH candidates AS (
    SELECT DISTINCT ON (vm.id)
      vm.id AS vendor_id,
      vm.vend_nombre,
      u.id AS usuario_id,
      (u.nombre || ' ' || u.apellidos) AS usuario_nombre,
      similarity(
        UPPER(vm.vend_nombre),
        UPPER(u.nombre || ' ' || u.apellidos)
      )::NUMERIC AS sim_score
    FROM sicas_vendor_user_mappings vm
    CROSS JOIN LATERAL (
      SELECT u2.id, u2.nombre, u2.apellidos
      FROM usuarios u2
      WHERE u2.estado = 'activo'
        AND similarity(UPPER(vm.vend_nombre), UPPER(u2.nombre || ' ' || u2.apellidos)) >= p_threshold
      ORDER BY similarity(UPPER(vm.vend_nombre), UPPER(u2.nombre || ' ' || u2.apellidos)) DESC
      LIMIT 1
    ) u
    WHERE vm.status = 'pending_review'
      AND vm.movi_user_id IS NULL
    ORDER BY vm.id, sim_score DESC
  )
  SELECT 
    c.vendor_id,
    c.vend_nombre,
    c.usuario_id AS matched_user_id,
    c.usuario_nombre AS matched_user_name,
    c.sim_score AS similarity_score,
    (c.sim_score >= p_auto_confirm_threshold) AS auto_confirmed
  FROM candidates c
  ORDER BY c.sim_score DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ================================================
-- 3. Function: Manually link a SICAS vendor to a MOVI user
-- ================================================

CREATE OR REPLACE FUNCTION link_vendor_to_user(
  p_vendor_id UUID,
  p_movi_user_id UUID,
  p_linked_by UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_vendor_name TEXT;
  v_normalized TEXT;
BEGIN
  -- Get vendor name
  SELECT vend_nombre INTO v_vendor_name
  FROM sicas_vendor_user_mappings
  WHERE id = p_vendor_id;

  IF v_vendor_name IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Vendor not found');
  END IF;

  -- Update SICAS vendor mapping
  UPDATE sicas_vendor_user_mappings
  SET movi_user_id = p_movi_user_id,
      match_type = 'manual',
      confidence_score = 100,
      status = 'active',
      mapped_by = p_linked_by,
      mapped_at = NOW(),
      match_details = jsonb_build_object('method', 'manual_link', 'linked_at', NOW(), 'linked_by', p_linked_by),
      updated_at = NOW()
  WHERE id = p_vendor_id;

  -- Normalize vendor name and create vendor_mapping
  v_normalized := LOWER(TRIM(
    REGEXP_REPLACE(
      TRANSLATE(v_vendor_name, 'ÁÉÍÓÚÜÑáéíóúüñ', 'AEIOUUNaeiouun'),
      '\s+', ' ', 'g'
    )
  ));

  -- Upsert into vendor_mappings
  INSERT INTO vendor_mappings (source_type, source_value, movi_user_id, status, created_by, notes)
  VALUES ('name', v_normalized, p_movi_user_id, 'active', p_linked_by, 'Vinculado manual desde panel unificado')
  ON CONFLICT (source_type, source_value) WHERE status = 'active'
  DO UPDATE SET
    movi_user_id = EXCLUDED.movi_user_id,
    updated_by = EXCLUDED.created_by,
    updated_at = NOW(),
    notes = 'Vinculado manual desde panel unificado (actualizado)';

  RETURN jsonb_build_object(
    'success', true,
    'vendor_name', v_vendor_name,
    'vendor_mapping_created', true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ================================================
-- 4. Function: Auto-confirm matched vendors in batch
-- ================================================

CREATE OR REPLACE FUNCTION confirm_fuzzy_matches(
  p_threshold NUMERIC DEFAULT 0.92
)
RETURNS TABLE(confirmed_count INTEGER, vendor_mappings_created INTEGER) AS $$
DECLARE
  v_confirmed INT := 0;
  v_vm_created INT := 0;
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT DISTINCT ON (vm.id)
      vm.id AS vendor_id,
      vm.vend_nombre,
      u.id AS usuario_id,
      similarity(UPPER(vm.vend_nombre), UPPER(u.nombre || ' ' || u.apellidos))::NUMERIC AS sim_score
    FROM sicas_vendor_user_mappings vm
    JOIN usuarios u ON similarity(UPPER(vm.vend_nombre), UPPER(u.nombre || ' ' || u.apellidos)) >= p_threshold
    WHERE vm.status = 'pending_review'
      AND vm.movi_user_id IS NULL
      AND u.estado = 'activo'
    ORDER BY vm.id, sim_score DESC
  LOOP
    -- Update SICAS mapping
    UPDATE sicas_vendor_user_mappings
    SET movi_user_id = rec.usuario_id,
        match_type = 'auto_fuzzy',
        confidence_score = rec.sim_score * 100,
        status = 'active',
        match_details = jsonb_build_object('method', 'auto_fuzzy_confirm', 'score', rec.sim_score, 'confirmed_at', NOW()),
        updated_at = NOW()
    WHERE id = rec.vendor_id;
    v_confirmed := v_confirmed + 1;

    -- Create vendor_mapping
    INSERT INTO vendor_mappings (source_type, source_value, movi_user_id, status, notes)
    VALUES (
      'name',
      LOWER(TRIM(REGEXP_REPLACE(TRANSLATE(rec.vend_nombre, 'ÁÉÍÓÚÜÑáéíóúüñ', 'AEIOUUNaeiouun'), '\s+', ' ', 'g'))),
      rec.usuario_id,
      'active',
      'Auto-confirmado por fuzzy match (score: ' || ROUND(rec.sim_score, 3) || ')'
    )
    ON CONFLICT (source_type, source_value) WHERE status = 'active'
    DO NOTHING;
    v_vm_created := v_vm_created + 1;
  END LOOP;

  confirmed_count := v_confirmed;
  vendor_mappings_created := v_vm_created;
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
