/*
  # Optimización Masiva RLS - Batch 1

  Optimización de múltiples tablas críticas:
  - CRM (cotizaciones, polizas, notas, tareas)
  - CARPETAS_CORREO
  - BORRADORES_CORREO
  - CORREOS_USUARIO
  - ADJUNTOS_CORREO
  - FIRMA_TEMPLATES y ASIGNACIONES
*/

-- =====================================================
-- CRM_COTIZACIONES
-- =====================================================

DROP POLICY IF EXISTS "Usuarios solo actualizan cotizaciones de sus contactos" ON crm_cotizaciones;
CREATE POLICY "Usuarios solo actualizan cotizaciones de sus contactos"
  ON crm_cotizaciones FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM crm_contactos
      WHERE crm_contactos.id = crm_cotizaciones.contacto_id
        AND crm_contactos.creado_por = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Usuarios solo crean cotizaciones para sus contactos" ON crm_cotizaciones;
CREATE POLICY "Usuarios solo crean cotizaciones para sus contactos"
  ON crm_cotizaciones FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM crm_contactos
      WHERE crm_contactos.id = crm_cotizaciones.contacto_id
        AND crm_contactos.creado_por = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Usuarios solo eliminan cotizaciones de sus contactos" ON crm_cotizaciones;
CREATE POLICY "Usuarios solo eliminan cotizaciones de sus contactos"
  ON crm_cotizaciones FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM crm_contactos
      WHERE crm_contactos.id = crm_cotizaciones.contacto_id
        AND crm_contactos.creado_por = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Usuarios solo ven cotizaciones de sus contactos" ON crm_cotizaciones;
CREATE POLICY "Usuarios solo ven cotizaciones de sus contactos"
  ON crm_cotizaciones FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM crm_contactos
      WHERE crm_contactos.id = crm_cotizaciones.contacto_id
        AND crm_contactos.creado_por = (select auth.uid())
    )
  );

-- =====================================================
-- CRM_POLIZAS
-- =====================================================

DROP POLICY IF EXISTS "Usuarios solo actualizan pólizas de sus contactos" ON crm_polizas;
CREATE POLICY "Usuarios solo actualizan pólizas de sus contactos"
  ON crm_polizas FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM crm_contactos
      WHERE crm_contactos.id = crm_polizas.contacto_id
        AND crm_contactos.creado_por = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Usuarios solo crean pólizas para sus contactos" ON crm_polizas;
CREATE POLICY "Usuarios solo crean pólizas para sus contactos"
  ON crm_polizas FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM crm_contactos
      WHERE crm_contactos.id = crm_polizas.contacto_id
        AND crm_contactos.creado_por = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Usuarios solo eliminan pólizas de sus contactos" ON crm_polizas;
CREATE POLICY "Usuarios solo eliminan pólizas de sus contactos"
  ON crm_polizas FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM crm_contactos
      WHERE crm_contactos.id = crm_polizas.contacto_id
        AND crm_contactos.creado_por = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Usuarios solo ven pólizas de sus contactos" ON crm_polizas;
CREATE POLICY "Usuarios solo ven pólizas de sus contactos"
  ON crm_polizas FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM crm_contactos
      WHERE crm_contactos.id = crm_polizas.contacto_id
        AND crm_contactos.creado_por = (select auth.uid())
    )
  );

-- =====================================================
-- CRM_NOTAS
-- =====================================================

DROP POLICY IF EXISTS "Usuarios solo actualizan notas de sus contactos" ON crm_notas;
CREATE POLICY "Usuarios solo actualizan notas de sus contactos"
  ON crm_notas FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM crm_contactos
      WHERE crm_contactos.id = crm_notas.contacto_id
        AND crm_contactos.creado_por = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Usuarios solo crean notas para sus contactos" ON crm_notas;
CREATE POLICY "Usuarios solo crean notas para sus contactos"
  ON crm_notas FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM crm_contactos
      WHERE crm_contactos.id = crm_notas.contacto_id
        AND crm_contactos.creado_por = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Usuarios solo eliminan notas de sus contactos" ON crm_notas;
CREATE POLICY "Usuarios solo eliminan notas de sus contactos"
  ON crm_notas FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM crm_contactos
      WHERE crm_contactos.id = crm_notas.contacto_id
        AND crm_contactos.creado_por = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Usuarios solo ven notas de sus contactos" ON crm_notas;
CREATE POLICY "Usuarios solo ven notas de sus contactos"
  ON crm_notas FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM crm_contactos
      WHERE crm_contactos.id = crm_notas.contacto_id
        AND crm_contactos.creado_por = (select auth.uid())
    )
  );

-- =====================================================
-- CARPETAS_CORREO
-- =====================================================

DROP POLICY IF EXISTS "Users can insert own folders" ON carpetas_correo;
CREATE POLICY "Users can insert own folders"
  ON carpetas_correo FOR INSERT TO authenticated
  WITH CHECK (usuario_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update own folders" ON carpetas_correo;
CREATE POLICY "Users can update own folders"
  ON carpetas_correo FOR UPDATE TO authenticated
  USING (usuario_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can view own folders" ON carpetas_correo;
CREATE POLICY "Users can view own folders"
  ON carpetas_correo FOR SELECT TO authenticated
  USING (usuario_id = (select auth.uid()));

-- =====================================================
-- BORRADORES_CORREO
-- =====================================================

DROP POLICY IF EXISTS "Users can manage own drafts" ON borradores_correo;
CREATE POLICY "Users can manage own drafts"
  ON borradores_correo FOR ALL TO authenticated
  USING (usuario_id = (select auth.uid()));

-- =====================================================
-- CORREOS_USUARIO
-- =====================================================

DROP POLICY IF EXISTS "Users can delete own emails" ON correos_usuario;
CREATE POLICY "Users can delete own emails"
  ON correos_usuario FOR DELETE TO authenticated
  USING (usuario_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can insert own emails" ON correos_usuario;
CREATE POLICY "Users can insert own emails"
  ON correos_usuario FOR INSERT TO authenticated
  WITH CHECK (usuario_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update own emails" ON correos_usuario;
CREATE POLICY "Users can update own emails"
  ON correos_usuario FOR UPDATE TO authenticated
  USING (usuario_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can view own emails" ON correos_usuario;
CREATE POLICY "Users can view own emails"
  ON correos_usuario FOR SELECT TO authenticated
  USING (usuario_id = (select auth.uid()));

-- =====================================================
-- ADJUNTOS_CORREO
-- =====================================================

DROP POLICY IF EXISTS "Users can view attachments of own emails" ON adjuntos_correo;
CREATE POLICY "Users can view attachments of own emails"
  ON adjuntos_correo FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM correos_usuario
      WHERE correos_usuario.id = adjuntos_correo.correo_id
        AND correos_usuario.usuario_id = (select auth.uid())
    )
  );

-- =====================================================
-- FIRMA_TEMPLATES
-- =====================================================

DROP POLICY IF EXISTS "firma_templates_delete_admin" ON firma_templates;
CREATE POLICY "firma_templates_delete_admin"
  ON firma_templates FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = (select auth.uid()) AND rol = 'Administrador'
    )
  );

DROP POLICY IF EXISTS "firma_templates_insert_admin" ON firma_templates;
CREATE POLICY "firma_templates_insert_admin"
  ON firma_templates FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = (select auth.uid()) AND rol = 'Administrador'
    )
  );

DROP POLICY IF EXISTS "firma_templates_update_admin" ON firma_templates;
CREATE POLICY "firma_templates_update_admin"
  ON firma_templates FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = (select auth.uid()) AND rol = 'Administrador'
    )
  );

-- =====================================================
-- FIRMA_ASIGNACIONES
-- =====================================================

DROP POLICY IF EXISTS "firma_asignaciones_delete_admin" ON firma_asignaciones;
CREATE POLICY "firma_asignaciones_delete_admin"
  ON firma_asignaciones FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = (select auth.uid()) AND rol = 'Administrador'
    )
  );

DROP POLICY IF EXISTS "firma_asignaciones_insert_admin" ON firma_asignaciones;
CREATE POLICY "firma_asignaciones_insert_admin"
  ON firma_asignaciones FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = (select auth.uid()) AND rol = 'Administrador'
    )
  );

DROP POLICY IF EXISTS "firma_asignaciones_update_admin" ON firma_asignaciones;
CREATE POLICY "firma_asignaciones_update_admin"
  ON firma_asignaciones FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = (select auth.uid()) AND rol = 'Administrador'
    )
  );
