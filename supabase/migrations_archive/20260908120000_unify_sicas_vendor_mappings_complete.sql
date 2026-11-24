/*
  # Unificación Total del Mapeo de Vendedores SICAS y Usuarios MOVI

  1. Función `link_vendor_to_user`:
     - Sincroniza `sicas_vendor_user_mappings` (pone movi_user_id, status='active', etc.)
     - Sincroniza `usuarios` (actualiza id_sicas y nombre_sicas con el vend_id y vend_nombre)
     - Sincroniza `vendor_mappings` (mapeo por nombre y por id para el módulo de comisiones)
     - Sincroniza `sicas_mapeo_vendedor_usuario` (catálogo oficial para sincronizador y pólizas)

  2. Función `unlink_vendor_from_user`:
     - Desvincula un vendedor SICAS de un usuario MOVI
     - Limpia `id_sicas` y `nombre_sicas` en `usuarios` si correspondían a ese vendedor
     - Desactiva los `vendor_mappings` correspondientes
     - Remueve/desactiva la relación en `sicas_vendor_user_mappings` y `sicas_mapeo_vendedor_usuario`

  3. Trigger `sync_usuario_sicas_to_all_mappings`:
     - Cuando `usuarios.id_sicas` o `usuarios.nombre_sicas` cambian directamente,
       sincroniza en cascada `sicas_vendor_user_mappings`, `vendor_mappings` y `sicas_mapeo_vendedor_usuario`.

  4. Actualización de `confirm_fuzzy_matches`:
     - También actualiza `usuarios.id_sicas` y `usuarios.nombre_sicas` y `sicas_mapeo_vendedor_usuario`.
*/

-- ============================================================
-- 1. Función link_vendor_to_user (Unificada)
-- ================================================

CREATE OR REPLACE FUNCTION link_vendor_to_user(
  p_vendor_id UUID,
  p_movi_user_id UUID,
  p_linked_by UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_vend_id TEXT;
  v_vend_nombre TEXT;
  v_normalized_name TEXT;
  v_normalized_id TEXT;
BEGIN
  -- 1. Obtener datos del vendedor SICAS
  SELECT vend_id, vend_nombre INTO v_vend_id, v_vend_nombre
  FROM sicas_vendor_user_mappings
  WHERE id = p_vendor_id;

  IF v_vend_nombre IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Vendedor SICAS no encontrado');
  END IF;

  -- 2. Actualizar sicas_vendor_user_mappings
  UPDATE sicas_vendor_user_mappings
  SET movi_user_id = p_movi_user_id,
      match_type = 'manual',
      confidence_score = 100,
      status = 'active',
      mapped_by = p_linked_by,
      mapped_at = NOW(),
      match_details = jsonb_build_object(
        'method', 'manual_link',
        'linked_at', NOW(),
        'linked_by', p_linked_by
      ),
      updated_at = NOW()
  WHERE id = p_vendor_id;

  -- 3. Actualizar datos en la tabla usuarios (id_sicas y nombre_sicas)
  UPDATE usuarios
  SET id_sicas = v_vend_id,
      nombre_sicas = v_vend_nombre,
      updated_at = NOW()
  WHERE id = p_movi_user_id;

  -- 4. Normalizar nombre y registrar en vendor_mappings (para Comisiones)
  v_normalized_name := LOWER(TRIM(
    REGEXP_REPLACE(
      TRANSLATE(v_vend_nombre, 'ÁÉÍÓÚÜÑáéíóúüñ', 'AEIOUUNaeiouun'),
      '\s+', ' ', 'g'
    )
  ));

  INSERT INTO vendor_mappings (source_type, source_value, movi_user_id, status, created_by, notes)
  VALUES ('name', v_normalized_name, p_movi_user_id, 'active', p_linked_by, 'Vinculado manual desde panel unificado (nombre)')
  ON CONFLICT (source_type, source_value) WHERE status = 'active'
  DO UPDATE SET
    movi_user_id = EXCLUDED.movi_user_id,
    updated_by = EXCLUDED.created_by,
    updated_at = NOW(),
    notes = 'Vinculado manual desde panel unificado (nombre actualizado)';

  -- También registrar vendor_mapping por id si viene vend_id
  IF v_vend_id IS NOT NULL AND TRIM(v_vend_id) != '' THEN
    v_normalized_id := LOWER(TRIM(v_vend_id));
    INSERT INTO vendor_mappings (source_type, source_value, movi_user_id, status, created_by, notes)
    VALUES ('id', v_normalized_id, p_movi_user_id, 'active', p_linked_by, 'Vinculado manual desde panel unificado (ID SICAS)')
    ON CONFLICT (source_type, source_value) WHERE status = 'active'
    DO UPDATE SET
      movi_user_id = EXCLUDED.movi_user_id,
      updated_by = EXCLUDED.created_by,
      updated_at = NOW(),
      notes = 'Vinculado manual desde panel unificado (ID SICAS actualizado)';
  END IF;

  -- 5. Sincronizar catálogo sicas_mapeo_vendedor_usuario si existe la tabla
  BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sicas_mapeo_vendedor_usuario') THEN
      INSERT INTO sicas_mapeo_vendedor_usuario (id_sicas_vendedor, movi_user_id, mapped_by, mapped_at)
      VALUES (v_vend_id, p_movi_user_id, p_linked_by, NOW())
      ON CONFLICT (id_sicas_vendedor)
      DO UPDATE SET
        movi_user_id = EXCLUDED.movi_user_id,
        mapped_by = EXCLUDED.mapped_by,
        mapped_at = NOW(),
        updated_at = NOW();
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Silenciar si no existe constraint o falla por RLS
    NULL;
  END;

  RETURN jsonb_build_object(
    'success', true,
    'vendor_id', v_vend_id,
    'vendor_name', v_vend_nombre,
    'user_id', p_movi_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 2. Función unlink_vendor_from_user
-- ============================================================

CREATE OR REPLACE FUNCTION unlink_vendor_from_user(
  p_vendor_id UUID DEFAULT NULL,
  p_movi_user_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_vend_id TEXT;
  v_vend_nombre TEXT;
  v_user_id UUID;
  v_normalized_name TEXT;
  v_normalized_id TEXT;
BEGIN
  -- Identificar vendedor y usuario
  IF p_vendor_id IS NOT NULL THEN
    SELECT vend_id, vend_nombre, movi_user_id 
    INTO v_vend_id, v_vend_nombre, v_user_id
    FROM sicas_vendor_user_mappings
    WHERE id = p_vendor_id;
  ELSIF p_movi_user_id IS NOT NULL THEN
    v_user_id := p_movi_user_id;
    SELECT vend_id, vend_nombre, id
    INTO v_vend_id, v_vend_nombre, p_vendor_id
    FROM sicas_vendor_user_mappings
    WHERE movi_user_id = p_movi_user_id
    LIMIT 1;
  END IF;

  -- 1. Desvincular en sicas_vendor_user_mappings
  IF p_vendor_id IS NOT NULL THEN
    UPDATE sicas_vendor_user_mappings
    SET movi_user_id = NULL,
        status = 'pending_review',
        match_type = 'unlinked',
        confidence_score = 0,
        match_details = jsonb_build_object('unlinked_at', NOW()),
        updated_at = NOW()
    WHERE id = p_vendor_id;
  ELSIF v_user_id IS NOT NULL THEN
    UPDATE sicas_vendor_user_mappings
    SET movi_user_id = NULL,
        status = 'pending_review',
        match_type = 'unlinked',
        confidence_score = 0,
        match_details = jsonb_build_object('unlinked_at', NOW()),
        updated_at = NOW()
    WHERE movi_user_id = v_user_id;
  END IF;

  -- 2. Limpiar en tabla usuarios
  IF v_user_id IS NOT NULL THEN
    UPDATE usuarios
    SET id_sicas = NULL,
        nombre_sicas = NULL,
        updated_at = NOW()
    WHERE id = v_user_id;

    -- Desactivar vendor_mappings del usuario
    UPDATE vendor_mappings
    SET status = 'inactive',
        updated_at = NOW()
    WHERE movi_user_id = v_user_id
      AND status = 'active';

    -- Limpiar en sicas_mapeo_vendedor_usuario
    BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sicas_mapeo_vendedor_usuario') THEN
        DELETE FROM sicas_mapeo_vendedor_usuario
        WHERE movi_user_id = v_user_id;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  RETURN jsonb_build_object('success', true, 'unlinked_user_id', v_user_id, 'unlinked_vendor_id', v_vend_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 3. Trigger unificado en usuarios: sync_usuario_sicas_to_all_mappings
-- ============================================================

CREATE OR REPLACE FUNCTION sync_nombre_sicas_to_vendor_mapping()
RETURNS TRIGGER AS $$
DECLARE
  v_normalized_name TEXT;
  v_normalized_id TEXT;
  v_sicas_mapping_id UUID;
  v_matched_vend_id TEXT;
BEGIN
  -- Si no hubo cambios ni en nombre_sicas ni en id_sicas, no hacer nada
  IF OLD.nombre_sicas IS NOT DISTINCT FROM NEW.nombre_sicas AND OLD.id_sicas IS NOT DISTINCT FROM NEW.id_sicas THEN
    RETURN NEW;
  END IF;

  -- Caso 1: Se limpiaron ambos campos
  IF (NEW.nombre_sicas IS NULL OR TRIM(NEW.nombre_sicas) = '') AND (NEW.id_sicas IS NULL OR TRIM(NEW.id_sicas) = '') THEN
    -- Desactivar vendor_mappings activos
    UPDATE vendor_mappings
    SET status = 'inactive', updated_at = NOW()
    WHERE movi_user_id = NEW.id
      AND status = 'active';

    -- Desvincular en sicas_vendor_user_mappings
    UPDATE sicas_vendor_user_mappings
    SET movi_user_id = NULL,
        status = 'pending_review',
        updated_at = NOW()
    WHERE movi_user_id = NEW.id;

    -- Eliminar de sicas_mapeo_vendedor_usuario
    BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sicas_mapeo_vendedor_usuario') THEN
        DELETE FROM sicas_mapeo_vendedor_usuario WHERE movi_user_id = NEW.id;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;

    RETURN NEW;
  END IF;

  -- Caso 2: Se asignó o actualizó nombre_sicas o id_sicas
  -- A) Si tenemos id_sicas, buscar y vincular exactamente por vend_id en sicas_vendor_user_mappings
  IF NEW.id_sicas IS NOT NULL AND TRIM(NEW.id_sicas) != '' THEN
    SELECT id, vend_id INTO v_sicas_mapping_id, v_matched_vend_id
    FROM sicas_vendor_user_mappings
    WHERE vend_id = TRIM(NEW.id_sicas)
    LIMIT 1;

    IF v_sicas_mapping_id IS NOT NULL THEN
      UPDATE sicas_vendor_user_mappings
      SET movi_user_id = NEW.id,
          status = 'active',
          match_type = 'user_sync',
          confidence_score = 100,
          updated_at = NOW()
      WHERE id = v_sicas_mapping_id;
    END IF;

    -- Upsert vendor_mappings por ID
    v_normalized_id := LOWER(TRIM(NEW.id_sicas));
    INSERT INTO vendor_mappings (source_type, source_value, movi_user_id, status, notes)
    VALUES ('id', v_normalized_id, NEW.id, 'active', 'auto-sync id_sicas')
    ON CONFLICT (source_type, source_value) WHERE status = 'active'
    DO UPDATE SET
      movi_user_id = EXCLUDED.movi_user_id,
      updated_at = NOW(),
      notes = 'auto-sync id_sicas';

    -- Sincronizar sicas_mapeo_vendedor_usuario
    BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sicas_mapeo_vendedor_usuario') THEN
        INSERT INTO sicas_mapeo_vendedor_usuario (id_sicas_vendedor, movi_user_id, mapped_at)
        VALUES (TRIM(NEW.id_sicas), NEW.id, NOW())
        ON CONFLICT (id_sicas_vendedor)
        DO UPDATE SET
          movi_user_id = EXCLUDED.movi_user_id,
          mapped_at = NOW(),
          updated_at = NOW();
      END IF;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  -- B) Si tenemos nombre_sicas, normalizar y sincronizar vendor_mappings por nombre
  IF NEW.nombre_sicas IS NOT NULL AND TRIM(NEW.nombre_sicas) != '' THEN
    v_normalized_name := LOWER(TRIM(
      REGEXP_REPLACE(
        TRANSLATE(NEW.nombre_sicas, 'ÁÉÍÓÚÜÑáéíóúüñ', 'AEIOUUNaeiouun'),
        '\s+', ' ', 'g'
      )
    ));

    INSERT INTO vendor_mappings (source_type, source_value, movi_user_id, status, notes)
    VALUES ('name', v_normalized_name, NEW.id, 'active', 'auto-sync nombre_sicas')
    ON CONFLICT (source_type, source_value) WHERE status = 'active'
    DO UPDATE SET
      movi_user_id = EXCLUDED.movi_user_id,
      updated_at = NOW(),
      notes = 'auto-sync nombre_sicas';

    -- Si aún no se vinculó sicas_vendor_user_mappings por ID, intentar vincular por coincidencia de nombre
    IF v_sicas_mapping_id IS NULL THEN
      UPDATE sicas_vendor_user_mappings
      SET movi_user_id = NEW.id,
          match_type = 'nombre_sicas_sync',
          confidence_score = 95,
          status = 'active',
          match_details = jsonb_build_object('method', 'nombre_sicas_sync', 'synced_at', NOW()),
          updated_at = NOW()
      WHERE (status = 'pending_review' OR movi_user_id IS NULL)
        AND similarity(UPPER(vend_nombre), UPPER(NEW.nombre_sicas)) >= 0.75;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_sync_nombre_sicas ON usuarios;
CREATE TRIGGER trigger_sync_nombre_sicas
AFTER UPDATE OF nombre_sicas, id_sicas ON usuarios
FOR EACH ROW
EXECUTE FUNCTION sync_nombre_sicas_to_vendor_mapping();

-- ============================================================
-- 4. Confirm Fuzzy Matches (Unificado)
-- ============================================================

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
      vm.vend_id,
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
    -- 1. Update SICAS mapping
    UPDATE sicas_vendor_user_mappings
    SET movi_user_id = rec.usuario_id,
        match_type = 'auto_fuzzy',
        confidence_score = rec.sim_score * 100,
        status = 'active',
        match_details = jsonb_build_object('method', 'auto_fuzzy_confirm', 'score', rec.sim_score, 'confirmed_at', NOW()),
        updated_at = NOW()
    WHERE id = rec.vendor_id;
    v_confirmed := v_confirmed + 1;

    -- 2. Update user profile id_sicas & nombre_sicas
    UPDATE usuarios
    SET id_sicas = COALESCE(id_sicas, rec.vend_id),
        nombre_sicas = COALESCE(nombre_sicas, rec.vend_nombre),
        updated_at = NOW()
    WHERE id = rec.usuario_id;

    -- 3. Create vendor_mapping by name
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

    -- 4. Create vendor_mapping by ID
    IF rec.vend_id IS NOT NULL AND TRIM(rec.vend_id) != '' THEN
      INSERT INTO vendor_mappings (source_type, source_value, movi_user_id, status, notes)
      VALUES (
        'id',
        LOWER(TRIM(rec.vend_id)),
        rec.usuario_id,
        'active',
        'Auto-confirmado por fuzzy match ID (score: ' || ROUND(rec.sim_score, 3) || ')'
      )
      ON CONFLICT (source_type, source_value) WHERE status = 'active'
      DO NOTHING;
    END IF;

    -- 5. Sincronizar sicas_mapeo_vendedor_usuario
    BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sicas_mapeo_vendedor_usuario') THEN
        INSERT INTO sicas_mapeo_vendedor_usuario (id_sicas_vendedor, movi_user_id, mapped_at)
        VALUES (rec.vend_id, rec.usuario_id, NOW())
        ON CONFLICT (id_sicas_vendedor)
        DO UPDATE SET
          movi_user_id = EXCLUDED.movi_user_id,
          mapped_at = NOW(),
          updated_at = NOW();
      END IF;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END LOOP;

  confirmed_count := v_confirmed;
  vendor_mappings_created := v_vm_created;
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
