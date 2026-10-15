/*
  # Optimización Masiva RLS - Batch 2

  Optimización de:
  - ACCESOS_NACIONAL
  - EXPEDIENTE_USUARIO
  - TRANSACTIONAL_NOTIFICATION_TEMPLATES
  - PRODUCTION_CONFIG
  - STORE (categorias, productos, pedidos)
  - ACCESOS_NACIONAL
  - SEGUROS_LESSONS
*/

-- =====================================================
-- ACCESOS_NACIONAL
-- =====================================================

DROP POLICY IF EXISTS "Admins can delete accesos" ON accesos_nacional;
CREATE POLICY "Admins can delete accesos"
  ON accesos_nacional FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = (select auth.uid()) AND rol = 'Administrador'
    )
  );

DROP POLICY IF EXISTS "Authenticated users can insert accesos" ON accesos_nacional;
CREATE POLICY "Authenticated users can insert accesos"
  ON accesos_nacional FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios WHERE id = (select auth.uid())
    )
  );

-- =====================================================
-- EXPEDIENTE_USUARIO
-- =====================================================

DROP POLICY IF EXISTS "Administrador can delete expediente files" ON expediente_usuario;
CREATE POLICY "Administrador can delete expediente files"
  ON expediente_usuario FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = (select auth.uid()) AND rol = 'Administrador'
    )
  );

DROP POLICY IF EXISTS "Administrador can insert expediente files" ON expediente_usuario;
CREATE POLICY "Administrador can insert expediente files"
  ON expediente_usuario FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = (select auth.uid()) AND rol = 'Administrador'
    )
  );

DROP POLICY IF EXISTS "Administrador can update expediente files" ON expediente_usuario;
CREATE POLICY "Administrador can update expediente files"
  ON expediente_usuario FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = (select auth.uid()) AND rol = 'Administrador'
    )
  );

DROP POLICY IF EXISTS "Administrador can view all expediente files" ON expediente_usuario;
CREATE POLICY "Administrador can view all expediente files"
  ON expediente_usuario FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = (select auth.uid()) AND rol = 'Administrador'
    )
  );

DROP POLICY IF EXISTS "Gerente can delete expediente files from their office" ON expediente_usuario;
CREATE POLICY "Gerente can delete expediente files from their office"
  ON expediente_usuario FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u
      JOIN usuarios target ON target.id = expediente_usuario.usuario_id
      WHERE u.id = (select auth.uid())
        AND u.rol = 'Gerente'
        AND u.oficina_id = target.oficina_id
    )
  );

DROP POLICY IF EXISTS "Gerente can insert expediente files for their office" ON expediente_usuario;
CREATE POLICY "Gerente can insert expediente files for their office"
  ON expediente_usuario FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios u
      JOIN usuarios target ON target.id = expediente_usuario.usuario_id
      WHERE u.id = (select auth.uid())
        AND u.rol = 'Gerente'
        AND u.oficina_id = target.oficina_id
    )
  );

DROP POLICY IF EXISTS "Gerente can update expediente files from their office" ON expediente_usuario;
CREATE POLICY "Gerente can update expediente files from their office"
  ON expediente_usuario FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u
      JOIN usuarios target ON target.id = expediente_usuario.usuario_id
      WHERE u.id = (select auth.uid())
        AND u.rol = 'Gerente'
        AND u.oficina_id = target.oficina_id
    )
  );

DROP POLICY IF EXISTS "Gerente can view expediente files from their office" ON expediente_usuario;
CREATE POLICY "Gerente can view expediente files from their office"
  ON expediente_usuario FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u
      JOIN usuarios target ON target.id = expediente_usuario.usuario_id
      WHERE u.id = (select auth.uid())
        AND u.rol = 'Gerente'
        AND u.oficina_id = target.oficina_id
    )
  );

-- =====================================================
-- TRANSACTIONAL_NOTIFICATION_TEMPLATES
-- =====================================================

DROP POLICY IF EXISTS "Admins can insert templates" ON transactional_notification_templates;
CREATE POLICY "Admins can insert templates"
  ON transactional_notification_templates FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = (select auth.uid()) AND rol = 'Administrador'
    )
  );

DROP POLICY IF EXISTS "Admins can update templates" ON transactional_notification_templates;
CREATE POLICY "Admins can update templates"
  ON transactional_notification_templates FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = (select auth.uid()) AND rol = 'Administrador'
    )
  );

DROP POLICY IF EXISTS "Admins can view all templates" ON transactional_notification_templates;
CREATE POLICY "Admins can view all templates"
  ON transactional_notification_templates FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = (select auth.uid()) AND rol = 'Administrador'
    )
  );

-- =====================================================
-- PRODUCTION_CONFIG
-- =====================================================

DROP POLICY IF EXISTS "Admins can insert production config" ON production_config;
CREATE POLICY "Admins can insert production config"
  ON production_config FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = (select auth.uid()) AND rol = 'Administrador'
    )
  );

DROP POLICY IF EXISTS "Admins can update production config" ON production_config;
CREATE POLICY "Admins can update production config"
  ON production_config FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = (select auth.uid()) AND rol = 'Administrador'
    )
  );

DROP POLICY IF EXISTS "Admins can view production config" ON production_config;
CREATE POLICY "Admins can view production config"
  ON production_config FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = (select auth.uid()) AND rol = 'Administrador'
    )
  );

-- =====================================================
-- STORE_CATEGORIAS
-- =====================================================

DROP POLICY IF EXISTS "Admins pueden actualizar categorías" ON store_categorias;
CREATE POLICY "Admins pueden actualizar categorías"
  ON store_categorias FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = (select auth.uid()) AND rol = 'Administrador'
    )
  );

DROP POLICY IF EXISTS "Admins pueden crear categorías" ON store_categorias;
CREATE POLICY "Admins pueden crear categorías"
  ON store_categorias FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = (select auth.uid()) AND rol = 'Administrador'
    )
  );

DROP POLICY IF EXISTS "Admins pueden eliminar categorías" ON store_categorias;
CREATE POLICY "Admins pueden eliminar categorías"
  ON store_categorias FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = (select auth.uid()) AND rol = 'Administrador'
    )
  );

DROP POLICY IF EXISTS "Admins pueden ver todas las categorías" ON store_categorias;
CREATE POLICY "Admins pueden ver todas las categorías"
  ON store_categorias FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = (select auth.uid()) AND rol = 'Administrador'
    )
  );

-- =====================================================
-- STORE_PRODUCTOS
-- =====================================================

DROP POLICY IF EXISTS "Admins pueden actualizar productos" ON store_productos;
CREATE POLICY "Admins pueden actualizar productos"
  ON store_productos FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = (select auth.uid()) AND rol = 'Administrador'
    )
  );

DROP POLICY IF EXISTS "Admins pueden crear productos" ON store_productos;
CREATE POLICY "Admins pueden crear productos"
  ON store_productos FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = (select auth.uid()) AND rol = 'Administrador'
    )
  );

DROP POLICY IF EXISTS "Admins pueden eliminar productos" ON store_productos;
CREATE POLICY "Admins pueden eliminar productos"
  ON store_productos FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = (select auth.uid()) AND rol = 'Administrador'
    )
  );

DROP POLICY IF EXISTS "Admins pueden ver todos los productos" ON store_productos;
CREATE POLICY "Admins pueden ver todos los productos"
  ON store_productos FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = (select auth.uid()) AND rol = 'Administrador'
    )
  );

-- =====================================================
-- SEGUROS_LESSONS
-- =====================================================

DROP POLICY IF EXISTS "Admins can delete lessons" ON seguros_lessons;
CREATE POLICY "Admins can delete lessons"
  ON seguros_lessons FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = (select auth.uid()) AND rol = 'Administrador'
    )
  );

DROP POLICY IF EXISTS "Admins can insert lessons" ON seguros_lessons;
CREATE POLICY "Admins can insert lessons"
  ON seguros_lessons FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = (select auth.uid()) AND rol = 'Administrador'
    )
  );

DROP POLICY IF EXISTS "Admins can update lessons" ON seguros_lessons;
CREATE POLICY "Admins can update lessons"
  ON seguros_lessons FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = (select auth.uid()) AND rol = 'Administrador'
    )
  );
