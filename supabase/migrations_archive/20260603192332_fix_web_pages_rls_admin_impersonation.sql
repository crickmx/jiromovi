/*
  # Fix Mi Página Web RLS Policies for Admin Impersonation

  ## Problem
  When an admin impersonates another user and tries to save their web page
  configuration, the INSERT/UPDATE policies fail because `auth.uid()` always
  returns the real admin's UUID, not the impersonated user's UUID.

  ## Changes

  ### user_web_pages
  - UPDATE policy: allow admins to update any user's page config
  - INSERT policy: allow admins to insert on behalf of any user

  ### user_web_featured_forms
  - INSERT policy: allow admins to insert on behalf of any user
  - UPDATE policy: allow admins to update any user's featured forms
  - DELETE policy: allow admins to delete any user's featured forms

  ### user_web_page_insurers
  - ALL policy: allow admins to manage insurers for any user's page

  ### user_web_page_categories
  - ALL policy: allow admins to manage categories for any user's page

  ## Security
  Only users with rol = 'Administrador' receive the bypass. Regular users
  still can only modify their own data.
*/

-- ─── user_web_pages ───────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Users can update own web page config" ON user_web_pages;
CREATE POLICY "Users can update own web page config"
  ON user_web_pages FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR get_my_rol() = 'Administrador')
  WITH CHECK (user_id = auth.uid() OR get_my_rol() = 'Administrador');

DROP POLICY IF EXISTS "Users can insert own web page config" ON user_web_pages;
CREATE POLICY "Users can insert own web page config"
  ON user_web_pages FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR get_my_rol() = 'Administrador');

-- Also allow admins to view any user's page config
DROP POLICY IF EXISTS "Users can view own web page config" ON user_web_pages;
CREATE POLICY "Users can view own web page config"
  ON user_web_pages FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR get_my_rol() = 'Administrador');

-- ─── user_web_featured_forms ─────────────────────────────────────────────────

DROP POLICY IF EXISTS "Users can insert own featured forms" ON user_web_featured_forms;
CREATE POLICY "Users can insert own featured forms"
  ON user_web_featured_forms FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id OR get_my_rol() = 'Administrador');

DROP POLICY IF EXISTS "Users can update own featured forms" ON user_web_featured_forms;
CREATE POLICY "Users can update own featured forms"
  ON user_web_featured_forms FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR get_my_rol() = 'Administrador')
  WITH CHECK (auth.uid() = user_id OR get_my_rol() = 'Administrador');

DROP POLICY IF EXISTS "Users can delete own featured forms" ON user_web_featured_forms;
CREATE POLICY "Users can delete own featured forms"
  ON user_web_featured_forms FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR get_my_rol() = 'Administrador');

DROP POLICY IF EXISTS "Users can view own featured forms" ON user_web_featured_forms;
CREATE POLICY "Users can view own featured forms"
  ON user_web_featured_forms FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR get_my_rol() = 'Administrador');

-- ─── user_web_page_insurers ───────────────────────────────────────────────────

DROP POLICY IF EXISTS "Users can manage own web page insurers" ON user_web_page_insurers;
CREATE POLICY "Users can manage own web page insurers"
  ON user_web_page_insurers FOR ALL TO authenticated
  USING (
    get_my_rol() = 'Administrador' OR
    EXISTS (
      SELECT 1 FROM user_web_pages
      WHERE user_web_pages.id = user_web_page_insurers.user_web_page_id
        AND user_web_pages.user_id = auth.uid()
    )
  )
  WITH CHECK (
    get_my_rol() = 'Administrador' OR
    EXISTS (
      SELECT 1 FROM user_web_pages
      WHERE user_web_pages.id = user_web_page_insurers.user_web_page_id
        AND user_web_pages.user_id = auth.uid()
    )
  );

-- ─── user_web_page_categories ────────────────────────────────────────────────

DROP POLICY IF EXISTS "Users can manage own web page categories" ON user_web_page_categories;
CREATE POLICY "Users can manage own web page categories"
  ON user_web_page_categories FOR ALL TO authenticated
  USING (
    get_my_rol() = 'Administrador' OR
    EXISTS (
      SELECT 1 FROM user_web_pages
      WHERE user_web_pages.id = user_web_page_categories.user_web_page_id
        AND user_web_pages.user_id = auth.uid()
    )
  )
  WITH CHECK (
    get_my_rol() = 'Administrador' OR
    EXISTS (
      SELECT 1 FROM user_web_pages
      WHERE user_web_pages.id = user_web_page_categories.user_web_page_id
        AND user_web_pages.user_id = auth.uid()
    )
  );
