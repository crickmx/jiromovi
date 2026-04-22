/*
  # Fix SICAS RLS Policies - Correct Role Names & Backfill User Mappings

  ## Problem
  All RLS policies on sicas_documents and 15+ other sicas_* tables use
  lowercase role names ('admin', 'gerente', 'agente', 'empleado') but
  the actual roles in the usuarios table are capitalized
  ('Administrador', 'Gerente', 'Agente', 'Empleado').
  This means NO authenticated user can see ANY rows via direct table queries.

  Additionally, all 102 documents have NULL usuario_id and oficina_id,
  making role-based filtering impossible even with correct names.

  ## Changes
  1. Drop and recreate ALL broken RLS policies on sicas_documents
  2. Fix RLS on sicas_sync_runs, sicas_sync_cursors, sicas_sync_history
  3. Fix RLS on sicas_digital_cache, sicas_centro_digital_cache
  4. Fix RLS on sicas_user_mapping, sicas_config, sicas_cron_config
  5. Fix RLS on sicas_despachos, sicas_catalog_types
  6. Fix RLS on sicas_comisiones_*, sicas_production_sync_log
  7. Backfill usuario_id and oficina_id on existing sicas_documents
  8. Backfill sicas_document_user_map entries

  ## Security
  - Administrador: sees ALL documents
  - Gerente: sees documents from their office (via oficina_id or vendor mapping)
  - Empleado: sees documents from their office
  - Agente: sees own documents (via usuario_id, vend_id mapping, or nombre_sicas match)
  - Ejecutivo: sees ALL documents (same as admin for read)
  - service_role: full access (unchanged)
*/

-- ============================================================
-- 1. FIX sicas_documents RLS POLICIES
-- ============================================================

-- Drop all broken policies
DROP POLICY IF EXISTS "mis_polizas_admin_view_all" ON sicas_documents;
DROP POLICY IF EXISTS "mis_polizas_gerente_view_office" ON sicas_documents;
DROP POLICY IF EXISTS "mis_polizas_empleado_view_office" ON sicas_documents;
DROP POLICY IF EXISTS "mis_polizas_agente_view_own" ON sicas_documents;
DROP POLICY IF EXISTS "Users can view own documents" ON sicas_documents;

-- Administrador & Ejecutivo: see ALL documents
CREATE POLICY "sicas_docs_admin_ejecutivo_select"
  ON sicas_documents FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
        AND usuarios.rol IN ('Administrador', 'Ejecutivo')
    )
  );

-- Gerente: sees documents from their office
CREATE POLICY "sicas_docs_gerente_select"
  ON sicas_documents FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
        AND usuarios.rol = 'Gerente'
        AND (
          -- Match by oficina_id on the document
          (sicas_documents.oficina_id IS NOT NULL AND usuarios.oficina_id = sicas_documents.oficina_id)
          OR
          -- Or match by vendor belonging to a user in the same office
          EXISTS (
            SELECT 1 FROM usuarios u2
            WHERE u2.oficina_id = usuarios.oficina_id
              AND u2.deleted_at IS NULL
              AND (
                u2.id = sicas_documents.usuario_id
                OR CAST(u2.id_sicas AS text) = sicas_documents.vend_id
              )
          )
          OR
          -- Or match by despacho-to-oficina mapping
          EXISTS (
            SELECT 1 FROM sicas_mapeo_despacho_oficina mdo
            JOIN sicas_mapeo_vendedor_usuario mvu ON true
            WHERE mdo.movi_oficina_id = usuarios.oficina_id
              AND sicas_documents.vend_id IS NOT NULL
          )
        )
    )
  );

-- Empleado: sees documents from their office
CREATE POLICY "sicas_docs_empleado_select"
  ON sicas_documents FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
        AND usuarios.rol = 'Empleado'
        AND sicas_documents.oficina_id IS NOT NULL
        AND usuarios.oficina_id = sicas_documents.oficina_id
    )
  );

-- Agente: sees own documents via multiple matching strategies
CREATE POLICY "sicas_docs_agente_select"
  ON sicas_documents FOR SELECT TO authenticated
  USING (
    -- Direct usuario_id match
    sicas_documents.usuario_id = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
        AND u.rol = 'Agente'
        AND (
          -- Match via id_sicas field
          (u.id_sicas IS NOT NULL AND CAST(u.id_sicas AS text) = sicas_documents.vend_id)
          OR
          -- Match via mapping table
          EXISTS (
            SELECT 1 FROM sicas_mapeo_vendedor_usuario mvu
            WHERE mvu.movi_user_id = u.id
              AND CAST(mvu.id_sicas_vendedor AS text) = sicas_documents.vend_id
          )
          OR
          -- Match via nombre_sicas (ILIKE fuzzy match)
          (u.nombre_sicas IS NOT NULL AND sicas_documents.vend_nombre ILIKE u.nombre_sicas)
        )
    )
  );

-- ============================================================
-- 2. FIX sicas_sync_runs RLS
-- ============================================================
DROP POLICY IF EXISTS "Admins can view sync runs" ON sicas_sync_runs;
CREATE POLICY "sicas_sync_runs_admin_select"
  ON sicas_sync_runs FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
        AND usuarios.rol IN ('Administrador', 'Gerente', 'Ejecutivo')
    )
  );

-- ============================================================
-- 3. FIX sicas_sync_cursors RLS
-- ============================================================
DROP POLICY IF EXISTS "Admins can view sync cursors" ON sicas_sync_cursors;
CREATE POLICY "sicas_sync_cursors_admin_select"
  ON sicas_sync_cursors FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
        AND usuarios.rol IN ('Administrador', 'Gerente', 'Ejecutivo')
    )
  );

-- ============================================================
-- 4. FIX sicas_sync_history RLS
-- ============================================================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'sicas_sync_history') THEN
    DROP POLICY IF EXISTS "Administradores pueden ver sync history" ON sicas_sync_history;
    EXECUTE 'CREATE POLICY "sicas_sync_history_admin_select"
      ON sicas_sync_history FOR SELECT TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM usuarios
          WHERE usuarios.id = auth.uid()
            AND usuarios.rol IN (''Administrador'', ''Gerente'', ''Ejecutivo'')
        )
      )';
  END IF;
END $$;

-- ============================================================
-- 5. FIX sicas_catalog_types RLS
-- ============================================================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'sicas_catalog_types') THEN
    DROP POLICY IF EXISTS "Administradores pueden ver catalog types" ON sicas_catalog_types;
    EXECUTE 'CREATE POLICY "sicas_catalog_types_admin_select"
      ON sicas_catalog_types FOR SELECT TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM usuarios
          WHERE usuarios.id = auth.uid()
            AND usuarios.rol IN (''Administrador'', ''Gerente'', ''Ejecutivo'')
        )
      )';
  END IF;
END $$;

-- ============================================================
-- 6. FIX sicas_config RLS (update policy)
-- ============================================================
DROP POLICY IF EXISTS "Only admins can update sicas_config" ON sicas_config;
CREATE POLICY "sicas_config_update_admin"
  ON sicas_config FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
        AND usuarios.rol = 'Administrador'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
        AND usuarios.rol = 'Administrador'
    )
  );

-- ============================================================
-- 7. FIX sicas_cron_config RLS
-- ============================================================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'sicas_cron_config') THEN
    DROP POLICY IF EXISTS "Admins can view cron config" ON sicas_cron_config;
    DROP POLICY IF EXISTS "Admins can update cron config" ON sicas_cron_config;
    EXECUTE 'CREATE POLICY "sicas_cron_config_admin_select"
      ON sicas_cron_config FOR SELECT TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM usuarios
          WHERE usuarios.id = auth.uid()
            AND usuarios.rol = ''Administrador''
        )
      )';
    EXECUTE 'CREATE POLICY "sicas_cron_config_admin_update"
      ON sicas_cron_config FOR UPDATE TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM usuarios
          WHERE usuarios.id = auth.uid()
            AND usuarios.rol = ''Administrador''
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM usuarios
          WHERE usuarios.id = auth.uid()
            AND usuarios.rol = ''Administrador''
        )
      )';
  END IF;
END $$;

-- ============================================================
-- 8. FIX sicas_despachos RLS
-- ============================================================
DROP POLICY IF EXISTS "Allow admins and gerentes to view despachos" ON sicas_despachos;
DROP POLICY IF EXISTS "Allow admins and gerentes to update despachos" ON sicas_despachos;
CREATE POLICY "sicas_despachos_select"
  ON sicas_despachos FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
        AND usuarios.rol IN ('Administrador', 'Gerente', 'Ejecutivo')
    )
  );
CREATE POLICY "sicas_despachos_update"
  ON sicas_despachos FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
        AND usuarios.rol IN ('Administrador', 'Gerente')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
        AND usuarios.rol IN ('Administrador', 'Gerente')
    )
  );

-- ============================================================
-- 9. FIX sicas_digital_cache RLS
-- ============================================================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'sicas_digital_cache') THEN
    DROP POLICY IF EXISTS "Users can view cached files for their documents" ON sicas_digital_cache;
    EXECUTE 'CREATE POLICY "sicas_digital_cache_select"
      ON sicas_digital_cache FOR SELECT TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM usuarios
          WHERE usuarios.id = auth.uid()
            AND usuarios.rol IN (''Administrador'', ''Ejecutivo'')
        )
        OR EXISTS (
          SELECT 1 FROM sicas_documents sd
          WHERE sd.id_docto = sicas_digital_cache.id_docto
            AND (
              sd.usuario_id = auth.uid()
              OR EXISTS (
                SELECT 1 FROM usuarios u
                WHERE u.id = auth.uid()
                  AND u.rol = ''Gerente''
                  AND sd.oficina_id = u.oficina_id
              )
            )
        )
      )';
  END IF;
END $$;

-- ============================================================
-- 10. FIX sicas_centro_digital_cache RLS
-- ============================================================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'sicas_centro_digital_cache') THEN
    DROP POLICY IF EXISTS "Users can view cached files for their documents" ON sicas_centro_digital_cache;
    EXECUTE 'CREATE POLICY "sicas_centro_digital_cache_select"
      ON sicas_centro_digital_cache FOR SELECT TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM usuarios
          WHERE usuarios.id = auth.uid()
            AND usuarios.rol IN (''Administrador'', ''Ejecutivo'')
        )
        OR EXISTS (
          SELECT 1 FROM sicas_documents sd
          WHERE sd.id_docto = sicas_centro_digital_cache.id_docto
            AND (
              sd.usuario_id = auth.uid()
              OR EXISTS (
                SELECT 1 FROM usuarios u
                WHERE u.id = auth.uid()
                  AND u.rol = ''Gerente''
                  AND sd.oficina_id = u.oficina_id
              )
            )
        )
      )';
  END IF;
END $$;

-- ============================================================
-- 11. FIX sicas_user_mapping RLS
-- ============================================================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'sicas_user_mapping') THEN
    DROP POLICY IF EXISTS "Admins can manage all mappings" ON sicas_user_mapping;
    DROP POLICY IF EXISTS "Users can view own mapping" ON sicas_user_mapping;
    EXECUTE 'CREATE POLICY "sicas_user_mapping_admin_all"
      ON sicas_user_mapping FOR ALL TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM usuarios
          WHERE usuarios.id = auth.uid()
            AND usuarios.rol = ''Administrador''
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM usuarios
          WHERE usuarios.id = auth.uid()
            AND usuarios.rol = ''Administrador''
        )
      )';
    EXECUTE 'CREATE POLICY "sicas_user_mapping_select_own"
      ON sicas_user_mapping FOR SELECT TO authenticated
      USING (
        usuario_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM usuarios
          WHERE usuarios.id = auth.uid()
            AND usuarios.rol IN (''Administrador'', ''Gerente'', ''Ejecutivo'')
        )
      )';
  END IF;
END $$;

-- ============================================================
-- 12. FIX sicas_comisiones_pendientes RLS
-- ============================================================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'sicas_comisiones_pendientes') THEN
    DROP POLICY IF EXISTS "Administradores y SICAS pueden ver todas las comisiones pendien" ON sicas_comisiones_pendientes;
    EXECUTE 'CREATE POLICY "sicas_comisiones_pendientes_admin_select"
      ON sicas_comisiones_pendientes FOR SELECT TO authenticated
      USING (
        auth.uid() IN (
          SELECT id FROM usuarios
          WHERE rol IN (''Administrador'', ''Ejecutivo'')
            AND estado = ''activo''
        )
        OR usuario_id = auth.uid()
      )';
  END IF;
END $$;

-- ============================================================
-- 13. FIX sicas_comisiones_pagadas RLS
-- ============================================================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'sicas_comisiones_pagadas') THEN
    DROP POLICY IF EXISTS "Administradores y SICAS pueden ver todas las comisiones pagadas" ON sicas_comisiones_pagadas;
    EXECUTE 'CREATE POLICY "sicas_comisiones_pagadas_admin_select"
      ON sicas_comisiones_pagadas FOR SELECT TO authenticated
      USING (
        auth.uid() IN (
          SELECT id FROM usuarios
          WHERE rol IN (''Administrador'', ''Ejecutivo'')
            AND estado = ''activo''
        )
        OR usuario_id = auth.uid()
      )';
  END IF;
END $$;

-- ============================================================
-- 14. FIX sicas_comisiones_sync_log RLS
-- ============================================================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'sicas_comisiones_sync_log') THEN
    DROP POLICY IF EXISTS "Administradores y SICAS pueden ver el log de sincronización" ON sicas_comisiones_sync_log;
    EXECUTE 'CREATE POLICY "sicas_comisiones_sync_log_admin_select"
      ON sicas_comisiones_sync_log FOR SELECT TO authenticated
      USING (
        auth.uid() IN (
          SELECT id FROM usuarios
          WHERE rol IN (''Administrador'', ''Ejecutivo'')
            AND estado = ''activo''
        )
      )';
  END IF;
END $$;

-- ============================================================
-- 15. FIX sicas_production_sync_log RLS
-- ============================================================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'sicas_production_sync_log') THEN
    DROP POLICY IF EXISTS "Admin y gerentes ven log" ON sicas_production_sync_log;
    EXECUTE 'CREATE POLICY "sicas_production_sync_log_select"
      ON sicas_production_sync_log FOR SELECT TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM usuarios
          WHERE usuarios.id = auth.uid()
            AND usuarios.rol IN (''Administrador'', ''Gerente'', ''Ejecutivo'')
            AND usuarios.deleted_at IS NULL
        )
      )';
  END IF;
END $$;

-- ============================================================
-- 16. BACKFILL usuario_id and oficina_id on existing documents
-- ============================================================

-- Step A: Update from sicas_mapeo_vendedor_usuario table
UPDATE sicas_documents sd
SET usuario_id = mvu.movi_user_id
FROM sicas_mapeo_vendedor_usuario mvu
WHERE sd.vend_id IS NOT NULL
  AND CAST(mvu.id_sicas_vendedor AS text) = sd.vend_id
  AND sd.usuario_id IS NULL;

-- Step B: Update from usuarios.id_sicas field
UPDATE sicas_documents sd
SET usuario_id = u.id
FROM usuarios u
WHERE sd.vend_id IS NOT NULL
  AND u.id_sicas IS NOT NULL
  AND CAST(u.id_sicas AS text) = sd.vend_id
  AND sd.usuario_id IS NULL
  AND u.deleted_at IS NULL;

-- Step C: Update oficina_id from user's office
UPDATE sicas_documents sd
SET oficina_id = u.oficina_id
FROM usuarios u
WHERE sd.usuario_id = u.id
  AND u.oficina_id IS NOT NULL
  AND sd.oficina_id IS NULL;

-- Step D: Update oficina_id from despacho mapping
UPDATE sicas_documents sd
SET oficina_id = mdo.movi_oficina_id
FROM sicas_mapeo_despacho_oficina mdo
WHERE sd.oficina_id IS NULL
  AND sd.vend_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM sicas_documents s2
    WHERE s2.id_docto = sd.id_docto
  );

-- Step E: Backfill sicas_document_user_map for all documents with usuario_id
INSERT INTO sicas_document_user_map (movi_user_id, sicas_identity_type, sicas_identity_value, sicas_id_docto, relation_source)
SELECT
  sd.usuario_id,
  'vendor',
  sd.vend_id,
  sd.id_docto,
  'backfill'
FROM sicas_documents sd
WHERE sd.usuario_id IS NOT NULL
  AND sd.vend_id IS NOT NULL
ON CONFLICT (movi_user_id, sicas_id_docto) DO NOTHING;

-- Step F: Also update sicas_polizas_vigentes table
UPDATE sicas_polizas_vigentes spv
SET
  usuario_id = sd.usuario_id,
  oficina_id = sd.oficina_id
FROM sicas_documents sd
WHERE spv.id_documento = sd.id_docto
  AND sd.usuario_id IS NOT NULL
  AND spv.usuario_id IS NULL;