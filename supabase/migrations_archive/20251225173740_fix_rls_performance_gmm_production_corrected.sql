/*
  # Optimización RLS Final - GMM, Production (Corregido)

  Optimización de políticas sin errores de columnas faltantes
*/

-- =====================================================
-- GMM_QUOTES
-- =====================================================

DROP POLICY IF EXISTS "Admin can view all quotes" ON gmm_quotes;
CREATE POLICY "Admin can view all quotes"
  ON gmm_quotes FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = (select auth.uid()) AND rol = 'Administrador'
    )
  );

DROP POLICY IF EXISTS "Users can create quotes" ON gmm_quotes;
CREATE POLICY "Users can create quotes"
  ON gmm_quotes FOR INSERT TO authenticated
  WITH CHECK (created_by = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update own quotes" ON gmm_quotes;
CREATE POLICY "Users can update own quotes"
  ON gmm_quotes FOR UPDATE TO authenticated
  USING (created_by = (select auth.uid()));

DROP POLICY IF EXISTS "Users can view own quotes" ON gmm_quotes;
CREATE POLICY "Users can view own quotes"
  ON gmm_quotes FOR SELECT TO authenticated
  USING (created_by = (select auth.uid()));

-- =====================================================
-- GMM_QUOTATIONS
-- =====================================================

DROP POLICY IF EXISTS "Admins can view all quotations" ON gmm_quotations;
CREATE POLICY "Admins can view all quotations"
  ON gmm_quotations FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = (select auth.uid()) AND rol = 'Administrador'
    )
  );

-- =====================================================
-- GMM_QUOTE_INSUREDS
-- =====================================================

DROP POLICY IF EXISTS "Admin can view all insureds" ON gmm_quote_insureds;
CREATE POLICY "Admin can view all insureds"
  ON gmm_quote_insureds FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = (select auth.uid()) AND rol = 'Administrador'
    )
  );

DROP POLICY IF EXISTS "Users can insert insureds for own quotes" ON gmm_quote_insureds;
CREATE POLICY "Users can insert insureds for own quotes"
  ON gmm_quote_insureds FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM gmm_quotes
      WHERE gmm_quotes.id = gmm_quote_insureds.quote_id
        AND gmm_quotes.created_by = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can view insureds of own quotes" ON gmm_quote_insureds;
CREATE POLICY "Users can view insureds of own quotes"
  ON gmm_quote_insureds FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM gmm_quotes
      WHERE gmm_quotes.id = gmm_quote_insureds.quote_id
        AND gmm_quotes.created_by = (select auth.uid())
    )
  );

-- =====================================================
-- TARIFF_PACKAGES
-- =====================================================

DROP POLICY IF EXISTS "Admin can manage tariff packages" ON tariff_packages;
CREATE POLICY "Admin can manage tariff packages"
  ON tariff_packages FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = (select auth.uid()) AND rol = 'Administrador'
    )
  );

DROP POLICY IF EXISTS "Admin can view all tariff packages" ON tariff_packages;
CREATE POLICY "Admin can view all tariff packages"
  ON tariff_packages FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = (select auth.uid()) AND rol = 'Administrador'
    )
  );

-- =====================================================
-- TARIFF_TABLES
-- =====================================================

DROP POLICY IF EXISTS "Admin can manage tariff tables" ON tariff_tables;
CREATE POLICY "Admin can manage tariff tables"
  ON tariff_tables FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = (select auth.uid()) AND rol = 'Administrador'
    )
  );

-- =====================================================
-- COMMISSION_BATCHES
-- =====================================================

DROP POLICY IF EXISTS "Admins manage batches" ON commission_batches;
CREATE POLICY "Admins manage batches"
  ON commission_batches FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = (select auth.uid()) AND rol = 'Administrador'
    )
  );

-- =====================================================
-- COMMISSION_DETAILS
-- =====================================================

DROP POLICY IF EXISTS "Admins manage commission details" ON commission_details;
CREATE POLICY "Admins manage commission details"
  ON commission_details FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = (select auth.uid()) AND rol = 'Administrador'
    )
  );

-- =====================================================
-- PRODUCTION_RECORDS
-- =====================================================

DROP POLICY IF EXISTS "Admins can delete production records" ON production_records;
CREATE POLICY "Admins can delete production records"
  ON production_records FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = (select auth.uid()) AND rol = 'Administrador'
    )
  );

DROP POLICY IF EXISTS "Admins can insert production records" ON production_records;
CREATE POLICY "Admins can insert production records"
  ON production_records FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = (select auth.uid()) AND rol = 'Administrador'
    )
  );

DROP POLICY IF EXISTS "Admins can view all production records" ON production_records;
CREATE POLICY "Admins can view all production records"
  ON production_records FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = (select auth.uid()) AND rol = 'Administrador'
    )
  );

-- =====================================================
-- PRODUCTION_IMPORT_BATCHES
-- =====================================================

DROP POLICY IF EXISTS "Admin can insert batches" ON production_import_batches;
CREATE POLICY "Admin can insert batches"
  ON production_import_batches FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = (select auth.uid()) AND rol = 'Administrador'
    )
  );

DROP POLICY IF EXISTS "Admin can update batches" ON production_import_batches;
CREATE POLICY "Admin can update batches"
  ON production_import_batches FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = (select auth.uid()) AND rol = 'Administrador'
    )
  );

DROP POLICY IF EXISTS "Admin can view all batches" ON production_import_batches;
CREATE POLICY "Admin can view all batches"
  ON production_import_batches FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = (select auth.uid()) AND rol = 'Administrador'
    )
  );

DROP POLICY IF EXISTS "Agentes can view visible batches" ON production_import_batches;
CREATE POLICY "Agentes can view visible batches"
  ON production_import_batches FOR SELECT TO authenticated
  USING (visible_to_agents = true);

-- =====================================================
-- VENDOR_MAPPING_PERSISTENT
-- =====================================================

DROP POLICY IF EXISTS "Admins can create vendor mappings" ON vendor_mapping_persistent;
CREATE POLICY "Admins can create vendor mappings"
  ON vendor_mapping_persistent FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = (select auth.uid()) AND rol = 'Administrador'
    )
  );

DROP POLICY IF EXISTS "Admins can delete vendor mappings" ON vendor_mapping_persistent;
CREATE POLICY "Admins can delete vendor mappings"
  ON vendor_mapping_persistent FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = (select auth.uid()) AND rol = 'Administrador'
    )
  );

DROP POLICY IF EXISTS "Admins can update vendor mappings" ON vendor_mapping_persistent;
CREATE POLICY "Admins can update vendor mappings"
  ON vendor_mapping_persistent FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = (select auth.uid()) AND rol = 'Administrador'
    )
  );

-- =====================================================
-- AGENT_USER_MAPPINGS
-- =====================================================

DROP POLICY IF EXISTS "Admins can create mappings" ON agent_user_mappings;
CREATE POLICY "Admins can create mappings"
  ON agent_user_mappings FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = (select auth.uid()) AND rol = 'Administrador'
    )
  );

DROP POLICY IF EXISTS "Admins can delete mappings" ON agent_user_mappings;
CREATE POLICY "Admins can delete mappings"
  ON agent_user_mappings FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = (select auth.uid()) AND rol = 'Administrador'
    )
  );

DROP POLICY IF EXISTS "Admins can update mappings" ON agent_user_mappings;
CREATE POLICY "Admins can update mappings"
  ON agent_user_mappings FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = (select auth.uid()) AND rol = 'Administrador'
    )
  );

DROP POLICY IF EXISTS "Admins can view all mappings" ON agent_user_mappings;
CREATE POLICY "Admins can view all mappings"
  ON agent_user_mappings FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = (select auth.uid()) AND rol = 'Administrador'
    )
  );

-- =====================================================
-- AGENT_MAPPING_AUDIT
-- =====================================================

DROP POLICY IF EXISTS "Admins can view audit logs" ON agent_mapping_audit;
CREATE POLICY "Admins can view audit logs"
  ON agent_mapping_audit FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = (select auth.uid()) AND rol = 'Administrador'
    )
  );

-- =====================================================
-- IMPORTED_DOCUMENTS
-- =====================================================

DROP POLICY IF EXISTS "Admins pueden actualizar documentos" ON imported_documents;
CREATE POLICY "Admins pueden actualizar documentos"
  ON imported_documents FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = (select auth.uid()) AND rol = 'Administrador'
    )
  );

DROP POLICY IF EXISTS "Admins pueden insertar documentos" ON imported_documents;
CREATE POLICY "Admins pueden insertar documentos"
  ON imported_documents FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = (select auth.uid()) AND rol = 'Administrador'
    )
  );

DROP POLICY IF EXISTS "Admins pueden ver todos los documentos importados" ON imported_documents;
CREATE POLICY "Admins pueden ver todos los documentos importados"
  ON imported_documents FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = (select auth.uid()) AND rol = 'Administrador'
    )
  );
