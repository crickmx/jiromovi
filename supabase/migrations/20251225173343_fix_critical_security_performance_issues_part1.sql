/*
  # Corrección de Problemas Críticos de Seguridad y Rendimiento - Parte 1

  1. Índices para Foreign Keys Faltantes
    - Se añaden índices a todas las claves foráneas sin índice
    - Mejora significativa en performance de JOINs

  2. Optimización de Políticas RLS con auth.uid()
    - Se reemplazan llamadas a `auth.uid()` por `(select auth.uid())`
    - Previene re-evaluación en cada fila
    - Mejora dramática en queries grandes

  3. Eliminación de Índices Duplicados
    - Se eliminan índices duplicados
*/

-- =====================================================
-- PARTE 1: AÑADIR ÍNDICES FALTANTES PARA FOREIGN KEYS
-- =====================================================

-- assistant_action_clicks
CREATE INDEX IF NOT EXISTS idx_assistant_action_clicks_action_id 
  ON assistant_action_clicks(action_id);

-- assistant_actions
CREATE INDEX IF NOT EXISTS idx_assistant_actions_intent_codigo 
  ON assistant_actions(intent_codigo);

-- assistant_suggestions
CREATE INDEX IF NOT EXISTS idx_assistant_suggestions_intent_codigo 
  ON assistant_suggestions(intent_codigo);

-- conversaciones_chatgpt
CREATE INDEX IF NOT EXISTS idx_conversaciones_chatgpt_snapshot_id 
  ON conversaciones_chatgpt(snapshot_id);

-- meeting_participants (ya existe idx_meeting_participants_user_id_fk)
-- Solo necesitamos eliminar el duplicado más adelante

-- =====================================================
-- PARTE 2: ELIMINAR ÍNDICE DUPLICADO
-- =====================================================

-- Eliminar idx_meeting_participants_user_id_fk2 (es duplicado de idx_meeting_participants_user_id_fk)
DROP INDEX IF EXISTS idx_meeting_participants_user_id_fk2;

-- =====================================================
-- PARTE 3: OPTIMIZAR POLÍTICAS RLS - TABLA USUARIOS
-- =====================================================

-- Usuarios: Admins update all users
DROP POLICY IF EXISTS "Admins: update all users" ON usuarios;
CREATE POLICY "Admins: update all users"
  ON usuarios
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = (select auth.uid()) 
        AND u.rol = 'Administrador'
    )
  );

-- Usuarios: Gerentes update office users
DROP POLICY IF EXISTS "Gerentes: update office users" ON usuarios;
CREATE POLICY "Gerentes: update office users"
  ON usuarios
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = (select auth.uid())
        AND u.rol = 'Gerente'
        AND u.oficina_id = usuarios.oficina_id
    )
  );

-- Usuarios: Users update own profile
DROP POLICY IF EXISTS "Users: update own profile" ON usuarios;
CREATE POLICY "Users: update own profile"
  ON usuarios
  FOR UPDATE
  TO authenticated
  USING (id = (select auth.uid()));

-- =====================================================
-- PARTE 4: OPTIMIZAR POLÍTICAS RLS - COMMISSION_FISCAL_REGIMES
-- =====================================================

DROP POLICY IF EXISTS "Admins can delete fiscal regimes" ON commission_fiscal_regimes;
CREATE POLICY "Admins can delete fiscal regimes"
  ON commission_fiscal_regimes
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = (select auth.uid()) AND rol = 'Administrador'
    )
  );

DROP POLICY IF EXISTS "Admins can insert fiscal regimes" ON commission_fiscal_regimes;
CREATE POLICY "Admins can insert fiscal regimes"
  ON commission_fiscal_regimes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = (select auth.uid()) AND rol = 'Administrador'
    )
  );

DROP POLICY IF EXISTS "Admins can update fiscal regimes" ON commission_fiscal_regimes;
CREATE POLICY "Admins can update fiscal regimes"
  ON commission_fiscal_regimes
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = (select auth.uid()) AND rol = 'Administrador'
    )
  );

-- =====================================================
-- PARTE 5: OPTIMIZAR POLÍTICAS RLS - WEB_PAGE_INSURERS
-- =====================================================

DROP POLICY IF EXISTS "Administradores can delete insurers" ON web_page_insurers;
CREATE POLICY "Administradores can delete insurers"
  ON web_page_insurers
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = (select auth.uid()) AND rol = 'Administrador'
    )
  );

DROP POLICY IF EXISTS "Administradores can insert insurers" ON web_page_insurers;
CREATE POLICY "Administradores can insert insurers"
  ON web_page_insurers
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = (select auth.uid()) AND rol = 'Administrador'
    )
  );

DROP POLICY IF EXISTS "Administradores can update insurers" ON web_page_insurers;
CREATE POLICY "Administradores can update insurers"
  ON web_page_insurers
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = (select auth.uid()) AND rol = 'Administrador'
    )
  );
