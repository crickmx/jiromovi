/*
  # Fix RLS Auth Initialization - Corrected

  1. Performance Optimization
    - Replace `auth.uid()` with `(select auth.uid())` in RLS policies
    - This prevents re-evaluation for each row, improving query performance
    
  2. Tables affected
    - web_page_insurers
    - user_web_page_insurers  
    - user_web_pages
    - user_web_page_categories
    - web_page_categories
    - aula_eventos_permisos
    - aula_eventos
    - comunicados_categorias
    - publicidad_categorias
    - publicidad_plantillas
    - publicidad_disenos
    - correo_plantillas
    - correo_tipos_notificacion
    - correo_configuracion
*/

-- ============================================
-- WEB PAGE INSURERS
-- ============================================

DROP POLICY IF EXISTS "Admins can delete insurers" ON web_page_insurers;
CREATE POLICY "Admins can delete insurers" ON web_page_insurers
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.usuario_id = (select auth.uid())
      AND user_roles.rol = 'administrador'
    )
  );

DROP POLICY IF EXISTS "Admins can insert insurers" ON web_page_insurers;
CREATE POLICY "Admins can insert insurers" ON web_page_insurers
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.usuario_id = (select auth.uid())
      AND user_roles.rol = 'administrador'
    )
  );

DROP POLICY IF EXISTS "Admins can update insurers" ON web_page_insurers;
CREATE POLICY "Admins can update insurers" ON web_page_insurers
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.usuario_id = (select auth.uid())
      AND user_roles.rol = 'administrador'
    )
  );

-- ============================================
-- USER WEB PAGE INSURERS
-- ============================================

DROP POLICY IF EXISTS "Users can manage own web page insurers" ON user_web_page_insurers;
CREATE POLICY "Users can manage own web page insurers" ON user_web_page_insurers
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_web_pages
      WHERE user_web_pages.id = user_web_page_insurers.user_web_page_id
      AND user_web_pages.user_id = (select auth.uid())
    )
  );

-- ============================================
-- USER WEB PAGES
-- ============================================

DROP POLICY IF EXISTS "Users can insert own web page config" ON user_web_pages;
CREATE POLICY "Users can insert own web page config" ON user_web_pages
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update own web page config" ON user_web_pages;
CREATE POLICY "Users can update own web page config" ON user_web_pages
  FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can view own web page config" ON user_web_pages;
CREATE POLICY "Users can view own web page config" ON user_web_pages
  FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

-- ============================================
-- USER WEB PAGE CATEGORIES
-- ============================================

DROP POLICY IF EXISTS "Users can manage own web page categories" ON user_web_page_categories;
CREATE POLICY "Users can manage own web page categories" ON user_web_page_categories
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_web_pages
      WHERE user_web_pages.id = user_web_page_categories.user_web_page_id
      AND user_web_pages.user_id = (select auth.uid())
    )
  );

-- ============================================
-- WEB PAGE CATEGORIES
-- ============================================

DROP POLICY IF EXISTS "Admins can delete categories" ON web_page_categories;
CREATE POLICY "Admins can delete categories" ON web_page_categories
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.usuario_id = (select auth.uid())
      AND user_roles.rol = 'administrador'
    )
  );

DROP POLICY IF EXISTS "Admins can insert categories" ON web_page_categories;
CREATE POLICY "Admins can insert categories" ON web_page_categories
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.usuario_id = (select auth.uid())
      AND user_roles.rol = 'administrador'
    )
  );

DROP POLICY IF EXISTS "Admins can update categories" ON web_page_categories;
CREATE POLICY "Admins can update categories" ON web_page_categories
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.usuario_id = (select auth.uid())
      AND user_roles.rol = 'administrador'
    )
  );

-- ============================================
-- AULA EVENTOS PERMISOS
-- ============================================

DROP POLICY IF EXISTS "Administradores pueden crear permisos" ON aula_eventos_permisos;
CREATE POLICY "Administradores pueden crear permisos" ON aula_eventos_permisos
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.usuario_id = (select auth.uid())
      AND user_roles.rol = 'administrador'
    )
  );

DROP POLICY IF EXISTS "Administradores pueden eliminar permisos" ON aula_eventos_permisos;
CREATE POLICY "Administradores pueden eliminar permisos" ON aula_eventos_permisos
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.usuario_id = (select auth.uid())
      AND user_roles.rol = 'administrador'
    )
  );

DROP POLICY IF EXISTS "Administradores pueden ver permisos" ON aula_eventos_permisos;
CREATE POLICY "Administradores pueden ver permisos" ON aula_eventos_permisos
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.usuario_id = (select auth.uid())
      AND user_roles.rol = 'administrador'
    )
  );

-- ============================================
-- AULA EVENTOS
-- ============================================

DROP POLICY IF EXISTS "Administradores pueden actualizar eventos" ON aula_eventos;
CREATE POLICY "Administradores pueden actualizar eventos" ON aula_eventos
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.usuario_id = (select auth.uid())
      AND user_roles.rol = 'administrador'
    )
  );

DROP POLICY IF EXISTS "Administradores pueden crear eventos" ON aula_eventos;
CREATE POLICY "Administradores pueden crear eventos" ON aula_eventos
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.usuario_id = (select auth.uid())
      AND user_roles.rol = 'administrador'
    )
  );

DROP POLICY IF EXISTS "Administradores pueden eliminar eventos" ON aula_eventos;
CREATE POLICY "Administradores pueden eliminar eventos" ON aula_eventos
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.usuario_id = (select auth.uid())
      AND user_roles.rol = 'administrador'
    )
  );

DROP POLICY IF EXISTS "Administradores pueden ver todos los eventos" ON aula_eventos;
CREATE POLICY "Administradores pueden ver todos los eventos" ON aula_eventos
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.usuario_id = (select auth.uid())
      AND user_roles.rol = 'administrador'
    )
  );

DROP POLICY IF EXISTS "Usuarios pueden ver eventos autorizados" ON aula_eventos;
CREATE POLICY "Usuarios pueden ver eventos autorizados" ON aula_eventos
  FOR SELECT
  TO authenticated
  USING (
    visible_para_todos = true OR
    EXISTS (
      SELECT 1 FROM aula_eventos_permisos
      WHERE aula_eventos_permisos.evento_id = aula_eventos.id
      AND (
        aula_eventos_permisos.usuario_id = (select auth.uid()) OR
        aula_eventos_permisos.oficina_id IN (
          SELECT oficina_id FROM usuarios WHERE id = (select auth.uid())
        )
      )
    )
  );

-- ============================================
-- COMUNICADOS CATEGORIAS
-- ============================================

DROP POLICY IF EXISTS "Admins can delete categories" ON comunicados_categorias;
CREATE POLICY "Admins can delete categories" ON comunicados_categorias
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.usuario_id = (select auth.uid())
      AND user_roles.rol = 'administrador'
    )
  );

DROP POLICY IF EXISTS "Admins can insert categories" ON comunicados_categorias;
CREATE POLICY "Admins can insert categories" ON comunicados_categorias
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.usuario_id = (select auth.uid())
      AND user_roles.rol = 'administrador'
    )
  );

DROP POLICY IF EXISTS "Admins can update categories" ON comunicados_categorias;
CREATE POLICY "Admins can update categories" ON comunicados_categorias
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.usuario_id = (select auth.uid())
      AND user_roles.rol = 'administrador'
    )
  );

-- ============================================
-- PUBLICIDAD CATEGORIAS
-- ============================================

DROP POLICY IF EXISTS "Solo admin puede actualizar categorías" ON publicidad_categorias;
CREATE POLICY "Solo admin puede actualizar categorías" ON publicidad_categorias
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.usuario_id = (select auth.uid())
      AND user_roles.rol = 'administrador'
    )
  );

DROP POLICY IF EXISTS "Solo admin puede crear categorías" ON publicidad_categorias;
CREATE POLICY "Solo admin puede crear categorías" ON publicidad_categorias
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.usuario_id = (select auth.uid())
      AND user_roles.rol = 'administrador'
    )
  );

DROP POLICY IF EXISTS "Solo admin puede eliminar categorías" ON publicidad_categorias;
CREATE POLICY "Solo admin puede eliminar categorías" ON publicidad_categorias
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.usuario_id = (select auth.uid())
      AND user_roles.rol = 'administrador'
    )
  );

-- ============================================
-- PUBLICIDAD PLANTILLAS
-- ============================================

DROP POLICY IF EXISTS "Admins can create plantillas" ON publicidad_plantillas;
CREATE POLICY "Admins can create plantillas" ON publicidad_plantillas
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.usuario_id = (select auth.uid())
      AND user_roles.rol = 'administrador'
    )
  );

DROP POLICY IF EXISTS "Admins can delete plantillas" ON publicidad_plantillas;
CREATE POLICY "Admins can delete plantillas" ON publicidad_plantillas
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.usuario_id = (select auth.uid())
      AND user_roles.rol = 'administrador'
    )
  );

-- ============================================
-- PUBLICIDAD DISENOS
-- ============================================

DROP POLICY IF EXISTS "Usuarios pueden crear sus diseños" ON publicidad_disenos;
CREATE POLICY "Usuarios pueden crear sus diseños" ON publicidad_disenos
  FOR INSERT
  TO authenticated
  WITH CHECK (usuario_id = (select auth.uid()));

DROP POLICY IF EXISTS "Usuarios pueden eliminar sus propios diseños" ON publicidad_disenos;
CREATE POLICY "Usuarios pueden eliminar sus propios diseños" ON publicidad_disenos
  FOR DELETE
  TO authenticated
  USING (usuario_id = (select auth.uid()));

DROP POLICY IF EXISTS "Usuarios pueden ver sus propios diseños" ON publicidad_disenos;
CREATE POLICY "Usuarios pueden ver sus propios diseños" ON publicidad_disenos
  FOR SELECT
  TO authenticated
  USING (usuario_id = (select auth.uid()));

-- ============================================
-- CORREO PLANTILLAS
-- ============================================

DROP POLICY IF EXISTS "Admins can manage correo_plantillas" ON correo_plantillas;
CREATE POLICY "Admins can manage correo_plantillas" ON correo_plantillas
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.usuario_id = (select auth.uid())
      AND user_roles.rol = 'administrador'
    )
  );

-- ============================================
-- CORREO TIPOS NOTIFICACION
-- ============================================

DROP POLICY IF EXISTS "Admins can manage correo_tipos_notificacion" ON correo_tipos_notificacion;
CREATE POLICY "Admins can manage correo_tipos_notificacion" ON correo_tipos_notificacion
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.usuario_id = (select auth.uid())
      AND user_roles.rol = 'administrador'
    )
  );

-- ============================================
-- CORREO CONFIGURACION
-- ============================================

DROP POLICY IF EXISTS "Admins can manage correo_configuracion" ON correo_configuracion;
CREATE POLICY "Admins can manage correo_configuracion" ON correo_configuracion
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.usuario_id = (select auth.uid())
      AND user_roles.rol = 'administrador'
    )
  );
