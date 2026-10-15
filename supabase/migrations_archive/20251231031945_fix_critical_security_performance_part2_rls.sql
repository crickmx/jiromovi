/*
  # Fix Critical Security and Performance - Part 2: RLS Optimization

  ## Problema
  Políticas RLS que re-evalúan auth.uid() para cada fila causan bajo rendimiento a escala

  ## Cambios
  Optimizar políticas RLS en tablas de alto tráfico usando (SELECT auth.uid())

  ## Seguridad
  - Mantiene los mismos permisos
  - Mejora el rendimiento al cachear auth.uid()
*/

-- =====================================================
-- Web Page Categories (alta tráfico en páginas públicas)
-- =====================================================

DROP POLICY IF EXISTS "Administradores can delete categories" ON web_page_categories;
CREATE POLICY "Administradores can delete categories" ON web_page_categories
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios 
      WHERE id = (SELECT auth.uid()) 
      AND rol = 'Administrador'
    )
  );

DROP POLICY IF EXISTS "Administradores can insert categories" ON web_page_categories;
CREATE POLICY "Administradores can insert categories" ON web_page_categories
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios 
      WHERE id = (SELECT auth.uid()) 
      AND rol = 'Administrador'
    )
  );

DROP POLICY IF EXISTS "Administradores can update categories" ON web_page_categories;
CREATE POLICY "Administradores can update categories" ON web_page_categories
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios 
      WHERE id = (SELECT auth.uid()) 
      AND rol = 'Administrador'
    )
  );

DROP POLICY IF EXISTS "Admins can view all categories" ON web_page_categories;
CREATE POLICY "Admins can view all categories" ON web_page_categories
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios 
      WHERE id = (SELECT auth.uid()) 
      AND rol = 'Administrador'
    )
  );

DROP POLICY IF EXISTS "Non-admins can view active categories" ON web_page_categories;
CREATE POLICY "Non-admins can view active categories" ON web_page_categories
  FOR SELECT TO authenticated
  USING (
    is_active = true 
    AND NOT EXISTS (
      SELECT 1 FROM usuarios 
      WHERE id = (SELECT auth.uid()) 
      AND rol = 'Administrador'
    )
  );

-- =====================================================
-- Assistant Attachments (alta tráfico)
-- =====================================================

DROP POLICY IF EXISTS "Users can delete own attachments" ON assistant_attachments;
CREATE POLICY "Users can delete own attachments" ON assistant_attachments
  FOR DELETE TO authenticated
  USING (uploaded_by = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can insert own attachments" ON assistant_attachments;
CREATE POLICY "Users can insert own attachments" ON assistant_attachments
  FOR INSERT TO authenticated
  WITH CHECK (uploaded_by = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can view own attachments" ON assistant_attachments;
CREATE POLICY "Users can view own attachments" ON assistant_attachments
  FOR SELECT TO authenticated
  USING (uploaded_by = (SELECT auth.uid()));

-- =====================================================
-- SICAS Config (acceso frecuente)
-- =====================================================

DROP POLICY IF EXISTS "Admins can manage sicas_config" ON sicas_config;
CREATE POLICY "Admins can manage sicas_config" ON sicas_config
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios 
      WHERE id = (SELECT auth.uid()) 
      AND rol = 'Administrador'
    )
  );

DROP POLICY IF EXISTS "Admins can view sicas_despachos" ON sicas_despachos;
CREATE POLICY "Admins can view sicas_despachos" ON sicas_despachos
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios 
      WHERE id = (SELECT auth.uid()) 
      AND rol = 'Administrador'
    )
  );

DROP POLICY IF EXISTS "Admins can view sicas_vendedores" ON sicas_vendedores;
CREATE POLICY "Admins can view sicas_vendedores" ON sicas_vendedores
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios 
      WHERE id = (SELECT auth.uid()) 
      AND rol = 'Administrador'
    )
  );

DROP POLICY IF EXISTS "Admins can manage despacho mappings" ON sicas_mapeo_despacho_oficina;
CREATE POLICY "Admins can manage despacho mappings" ON sicas_mapeo_despacho_oficina
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios 
      WHERE id = (SELECT auth.uid()) 
      AND rol = 'Administrador'
    )
  );

DROP POLICY IF EXISTS "Admins can manage vendedor mappings" ON sicas_mapeo_vendedor_usuario;
CREATE POLICY "Admins can manage vendedor mappings" ON sicas_mapeo_vendedor_usuario
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios 
      WHERE id = (SELECT auth.uid()) 
      AND rol = 'Administrador'
    )
  );

-- =====================================================
-- Aula Eventos (consultas frecuentes)
-- =====================================================

DROP POLICY IF EXISTS "Administradores y Gerentes pueden crear permisos" ON aula_eventos_permisos;
CREATE POLICY "Administradores y Gerentes pueden crear permisos" ON aula_eventos_permisos
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios 
      WHERE id = (SELECT auth.uid()) 
      AND rol IN ('Administrador', 'Gerente')
    )
  );

DROP POLICY IF EXISTS "Administradores y Gerentes pueden eliminar permisos" ON aula_eventos_permisos;
CREATE POLICY "Administradores y Gerentes pueden eliminar permisos" ON aula_eventos_permisos
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios 
      WHERE id = (SELECT auth.uid()) 
      AND rol IN ('Administrador', 'Gerente')
    )
  );

DROP POLICY IF EXISTS "Administradores y Gerentes pueden actualizar eventos" ON aula_eventos;
CREATE POLICY "Administradores y Gerentes pueden actualizar eventos" ON aula_eventos
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios 
      WHERE id = (SELECT auth.uid()) 
      AND rol IN ('Administrador', 'Gerente')
    )
  );

DROP POLICY IF EXISTS "Administradores y Gerentes pueden crear eventos" ON aula_eventos;
CREATE POLICY "Administradores y Gerentes pueden crear eventos" ON aula_eventos
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios 
      WHERE id = (SELECT auth.uid()) 
      AND rol IN ('Administrador', 'Gerente')
    )
  );

DROP POLICY IF EXISTS "Administradores y Gerentes pueden eliminar eventos" ON aula_eventos;
CREATE POLICY "Administradores y Gerentes pueden eliminar eventos" ON aula_eventos
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios 
      WHERE id = (SELECT auth.uid()) 
      AND rol IN ('Administrador', 'Gerente')
    )
  );

-- Log
DO $$
BEGIN
  RAISE NOTICE '✅ Part 2: 18 políticas RLS optimizadas';
END $$;
