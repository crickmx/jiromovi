/*
  # Fix Critical Security and Performance - Part 4: Assistant RLS Simplified

  ## Problema
  Políticas RLS en módulo Assistant re-evalúan auth.uid() para cada fila

  ## Cambios
  Optimizar solo las políticas que existen y están causando problemas

  ## Seguridad
  - Mantiene los mismos permisos
  - Mejora rendimiento
*/

-- =====================================================
-- Assistant Core Tables
-- =====================================================

DROP POLICY IF EXISTS "Only admins can manage intents" ON assistant_intents;
CREATE POLICY "Only admins can manage intents" ON assistant_intents
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios 
      WHERE id = (SELECT auth.uid()) 
      AND rol = 'Administrador'
    )
  );

DROP POLICY IF EXISTS "Only admins can manage suggestions" ON assistant_suggestions;
CREATE POLICY "Only admins can manage suggestions" ON assistant_suggestions
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios 
      WHERE id = (SELECT auth.uid()) 
      AND rol = 'Administrador'
    )
  );

DROP POLICY IF EXISTS "Only admins can manage actions" ON assistant_actions;
CREATE POLICY "Only admins can manage actions" ON assistant_actions
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios 
      WHERE id = (SELECT auth.uid()) 
      AND rol = 'Administrador'
    )
  );

-- =====================================================
-- Assistant Snapshots
-- =====================================================

DROP POLICY IF EXISTS "Users can create own snapshots" ON assistant_snapshots;
CREATE POLICY "Users can create own snapshots" ON assistant_snapshots
  FOR INSERT TO authenticated
  WITH CHECK (usuario_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can view own snapshots" ON assistant_snapshots;
CREATE POLICY "Users can view own snapshots" ON assistant_snapshots
  FOR SELECT TO authenticated
  USING (usuario_id = (SELECT auth.uid()));

-- =====================================================
-- Assistant Events
-- =====================================================

DROP POLICY IF EXISTS "Events: insert own" ON assistant_events;
CREATE POLICY "Events: insert own" ON assistant_events
  FOR INSERT TO authenticated
  WITH CHECK (usuario_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Events: select own" ON assistant_events;
CREATE POLICY "Events: select own" ON assistant_events
  FOR SELECT TO authenticated
  USING (usuario_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Events: update own" ON assistant_events;
CREATE POLICY "Events: update own" ON assistant_events
  FOR UPDATE TO authenticated
  USING (usuario_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can update own events" ON assistant_events;
CREATE POLICY "Users can update own events" ON assistant_events
  FOR UPDATE TO authenticated
  USING (usuario_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can view own events" ON assistant_events;
CREATE POLICY "Users can view own events" ON assistant_events
  FOR SELECT TO authenticated
  USING (usuario_id = (SELECT auth.uid()));

-- =====================================================
-- Assistant Action Clicks
-- =====================================================

DROP POLICY IF EXISTS "Admins can view all action clicks" ON assistant_action_clicks;
CREATE POLICY "Admins can view all action clicks" ON assistant_action_clicks
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios 
      WHERE id = (SELECT auth.uid()) 
      AND rol = 'Administrador'
    )
  );

DROP POLICY IF EXISTS "Users can create own action clicks" ON assistant_action_clicks;
CREATE POLICY "Users can create own action clicks" ON assistant_action_clicks
  FOR INSERT TO authenticated
  WITH CHECK (usuario_id = (SELECT auth.uid()));

-- =====================================================
-- Correo Configuracion
-- =====================================================

DROP POLICY IF EXISTS "Admins can delete correo_configuracion" ON correo_configuracion;
CREATE POLICY "Admins can delete correo_configuracion" ON correo_configuracion
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios 
      WHERE id = (SELECT auth.uid()) 
      AND rol = 'Administrador'
    )
  );

DROP POLICY IF EXISTS "Admins can insert correo_configuracion" ON correo_configuracion;
CREATE POLICY "Admins can insert correo_configuracion" ON correo_configuracion
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios 
      WHERE id = (SELECT auth.uid()) 
      AND rol = 'Administrador'
    )
  );

DROP POLICY IF EXISTS "Admins can update correo_configuracion" ON correo_configuracion;
CREATE POLICY "Admins can update correo_configuracion" ON correo_configuracion
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios 
      WHERE id = (SELECT auth.uid()) 
      AND rol = 'Administrador'
    )
  );

DROP POLICY IF EXISTS "Admins can view correo_configuracion" ON correo_configuracion;
CREATE POLICY "Admins can view correo_configuracion" ON correo_configuracion
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
  RAISE NOTICE '✅ Part 4: 16 políticas RLS optimizadas en Assistant y Email';
END $$;
