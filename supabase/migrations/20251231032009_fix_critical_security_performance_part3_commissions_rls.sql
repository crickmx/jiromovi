/*
  # Fix Critical Security and Performance - Part 3: Commissions RLS

  ## Problema
  Políticas RLS en tablas de comisiones con alto volumen re-evalúan auth.uid() 
  para cada fila, causando bajo rendimiento durante operaciones de importación

  ## Cambios
  Optimizar políticas RLS en tablas de comisiones y staging

  ## Seguridad
  - Mantiene los mismos permisos
  - Mejora el rendimiento en imports de comisiones
*/

-- =====================================================
-- Commission Staging (uso intensivo durante imports)
-- =====================================================

DROP POLICY IF EXISTS "Admins can delete staging sessions" ON commission_staging_sessions;
CREATE POLICY "Admins can delete staging sessions" ON commission_staging_sessions
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios 
      WHERE id = (SELECT auth.uid()) 
      AND rol = 'Administrador'
    )
  );

DROP POLICY IF EXISTS "Admins can insert staging sessions" ON commission_staging_sessions;
CREATE POLICY "Admins can insert staging sessions" ON commission_staging_sessions
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios 
      WHERE id = (SELECT auth.uid()) 
      AND rol = 'Administrador'
    )
  );

DROP POLICY IF EXISTS "Admins can update staging sessions" ON commission_staging_sessions;
CREATE POLICY "Admins can update staging sessions" ON commission_staging_sessions
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios 
      WHERE id = (SELECT auth.uid()) 
      AND rol = 'Administrador'
    )
  );

DROP POLICY IF EXISTS "Admins can view staging sessions" ON commission_staging_sessions;
CREATE POLICY "Admins can view staging sessions" ON commission_staging_sessions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios 
      WHERE id = (SELECT auth.uid()) 
      AND rol = 'Administrador'
    )
  );

-- =====================================================
-- Commission Items Staging (alto volumen)
-- =====================================================

DROP POLICY IF EXISTS "Admins can delete staging items" ON commission_items_staging;
CREATE POLICY "Admins can delete staging items" ON commission_items_staging
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios 
      WHERE id = (SELECT auth.uid()) 
      AND rol = 'Administrador'
    )
  );

DROP POLICY IF EXISTS "Admins can insert staging items" ON commission_items_staging;
CREATE POLICY "Admins can insert staging items" ON commission_items_staging
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios 
      WHERE id = (SELECT auth.uid()) 
      AND rol = 'Administrador'
    )
  );

DROP POLICY IF EXISTS "Admins can update staging items" ON commission_items_staging;
CREATE POLICY "Admins can update staging items" ON commission_items_staging
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios 
      WHERE id = (SELECT auth.uid()) 
      AND rol = 'Administrador'
    )
  );

DROP POLICY IF EXISTS "Admins can view staging items" ON commission_items_staging;
CREATE POLICY "Admins can view staging items" ON commission_items_staging
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios 
      WHERE id = (SELECT auth.uid()) 
      AND rol = 'Administrador'
    )
  );

-- =====================================================
-- Conversion Jobs
-- =====================================================

DROP POLICY IF EXISTS "Admins can view conversion jobs" ON conversion_jobs;
CREATE POLICY "Admins can view conversion jobs" ON conversion_jobs
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios 
      WHERE id = (SELECT auth.uid()) 
      AND rol = 'Administrador'
    )
  );

-- =====================================================
-- Vendor Mapping Persistent Legacy
-- =====================================================

DROP POLICY IF EXISTS "Admins can create vendor mappings" ON vendor_mapping_persistent_legacy;
CREATE POLICY "Admins can create vendor mappings" ON vendor_mapping_persistent_legacy
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios 
      WHERE id = (SELECT auth.uid()) 
      AND rol = 'Administrador'
    )
  );

DROP POLICY IF EXISTS "Admins can delete vendor mappings" ON vendor_mapping_persistent_legacy;
CREATE POLICY "Admins can delete vendor mappings" ON vendor_mapping_persistent_legacy
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios 
      WHERE id = (SELECT auth.uid()) 
      AND rol = 'Administrador'
    )
  );

DROP POLICY IF EXISTS "Admins can update vendor mappings" ON vendor_mapping_persistent_legacy;
CREATE POLICY "Admins can update vendor mappings" ON vendor_mapping_persistent_legacy
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios 
      WHERE id = (SELECT auth.uid()) 
      AND rol = 'Administrador'
    )
  );

-- =====================================================
-- Document Import (alto volumen durante imports)
-- =====================================================

DROP POLICY IF EXISTS "Usuarios pueden ver sus propios documentos" ON imported_documents;
CREATE POLICY "Usuarios pueden ver sus propios documentos" ON imported_documents
  FOR SELECT TO authenticated
  USING (movi_user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Admins pueden actualizar batches" ON document_import_batches;
CREATE POLICY "Admins pueden actualizar batches" ON document_import_batches
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios 
      WHERE id = (SELECT auth.uid()) 
      AND rol = 'Administrador'
    )
  );

DROP POLICY IF EXISTS "Admins pueden insertar batches" ON document_import_batches;
CREATE POLICY "Admins pueden insertar batches" ON document_import_batches
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios 
      WHERE id = (SELECT auth.uid()) 
      AND rol = 'Administrador'
    )
  );

DROP POLICY IF EXISTS "Admins pueden ver todos los batches" ON document_import_batches;
CREATE POLICY "Admins pueden ver todos los batches" ON document_import_batches
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios 
      WHERE id = (SELECT auth.uid()) 
      AND rol = 'Administrador'
    )
  );

-- =====================================================
-- Document Import Items
-- =====================================================

DROP POLICY IF EXISTS "Admins can delete import items" ON document_import_items;
CREATE POLICY "Admins can delete import items" ON document_import_items
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios 
      WHERE id = (SELECT auth.uid()) 
      AND rol = 'Administrador'
    )
  );

DROP POLICY IF EXISTS "Admins can insert import items" ON document_import_items;
CREATE POLICY "Admins can insert import items" ON document_import_items
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios 
      WHERE id = (SELECT auth.uid()) 
      AND rol = 'Administrador'
    )
  );

DROP POLICY IF EXISTS "Admins can update import items" ON document_import_items;
CREATE POLICY "Admins can update import items" ON document_import_items
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios 
      WHERE id = (SELECT auth.uid()) 
      AND rol = 'Administrador'
    )
  );

DROP POLICY IF EXISTS "Admins can view all import items" ON document_import_items;
CREATE POLICY "Admins can view all import items" ON document_import_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios 
      WHERE id = (SELECT auth.uid()) 
      AND rol = 'Administrador'
    )
  );

-- Log
DO $$
BEGIN
  RAISE NOTICE '✅ Part 3: 20 políticas RLS optimizadas en tablas de comisiones';
END $$;
