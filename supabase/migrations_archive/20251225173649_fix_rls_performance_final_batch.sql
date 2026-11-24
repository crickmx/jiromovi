/*
  # Optimización Masiva RLS - Batch Final

  Optimización de las políticas más críticas restantes:
  - CRM Birthday Reminders
  - Dashboard Calendar Events
  - CRM Tareas
  - Vendor Mappings
  - Mensajes ChatGPT y Conversaciones
  - Commission Tables
  - Tickets
  - GMM Tables
  - Production Records
  - Assistant Tables
  - Notification Tables
*/

-- =====================================================
-- CRM_BIRTHDAY_REMINDERS
-- =====================================================

DROP POLICY IF EXISTS "Usuarios pueden ver sus propios recordatorios" ON crm_birthday_reminders;
CREATE POLICY "Usuarios pueden ver sus propios recordatorios"
  ON crm_birthday_reminders FOR SELECT TO authenticated
  USING (usuario_id = (select auth.uid()));

-- =====================================================
-- DASHBOARD_CALENDAR_EVENTS
-- =====================================================

DROP POLICY IF EXISTS "Usuarios pueden actualizar sus propios eventos" ON dashboard_calendar_events;
CREATE POLICY "Usuarios pueden actualizar sus propios eventos"
  ON dashboard_calendar_events FOR UPDATE TO authenticated
  USING (usuario_id = (select auth.uid()));

DROP POLICY IF EXISTS "Usuarios pueden crear sus propios eventos" ON dashboard_calendar_events;
CREATE POLICY "Usuarios pueden crear sus propios eventos"
  ON dashboard_calendar_events FOR INSERT TO authenticated
  WITH CHECK (usuario_id = (select auth.uid()));

DROP POLICY IF EXISTS "Usuarios pueden eliminar sus propios eventos" ON dashboard_calendar_events;
CREATE POLICY "Usuarios pueden eliminar sus propios eventos"
  ON dashboard_calendar_events FOR DELETE TO authenticated
  USING (usuario_id = (select auth.uid()));

DROP POLICY IF EXISTS "Usuarios pueden ver sus propios eventos" ON dashboard_calendar_events;
CREATE POLICY "Usuarios pueden ver sus propios eventos"
  ON dashboard_calendar_events FOR SELECT TO authenticated
  USING (usuario_id = (select auth.uid()));

-- =====================================================
-- CRM_TAREAS - Simplificadas (eliminar duplicados)
-- =====================================================

DROP POLICY IF EXISTS "Usuarios pueden actualizar sus tareas" ON crm_tareas;
DROP POLICY IF EXISTS "Usuarios solo actualizan tareas de sus contactos" ON crm_tareas;
CREATE POLICY "Usuarios pueden actualizar sus tareas"
  ON crm_tareas FOR UPDATE TO authenticated
  USING (
    creado_por = (select auth.uid())
    OR EXISTS (
      SELECT 1 FROM crm_contactos
      WHERE crm_contactos.id = crm_tareas.contacto_id
        AND crm_contactos.creado_por = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Usuarios pueden crear sus tareas" ON crm_tareas;
DROP POLICY IF EXISTS "Usuarios solo crean tareas para sus contactos" ON crm_tareas;
CREATE POLICY "Usuarios pueden crear sus tareas"
  ON crm_tareas FOR INSERT TO authenticated
  WITH CHECK (
    creado_por = (select auth.uid())
    OR EXISTS (
      SELECT 1 FROM crm_contactos
      WHERE crm_contactos.id = crm_tareas.contacto_id
        AND crm_contactos.creado_por = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Usuarios pueden eliminar sus tareas" ON crm_tareas;
DROP POLICY IF EXISTS "Usuarios solo eliminan tareas de sus contactos" ON crm_tareas;
CREATE POLICY "Usuarios pueden eliminar sus tareas"
  ON crm_tareas FOR DELETE TO authenticated
  USING (
    creado_por = (select auth.uid())
    OR EXISTS (
      SELECT 1 FROM crm_contactos
      WHERE crm_contactos.id = crm_tareas.contacto_id
        AND crm_contactos.creado_por = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Usuarios pueden ver solo sus tareas" ON crm_tareas;
DROP POLICY IF EXISTS "Usuarios solo ven tareas de sus contactos" ON crm_tareas;
CREATE POLICY "Usuarios pueden ver sus tareas"
  ON crm_tareas FOR SELECT TO authenticated
  USING (
    creado_por = (select auth.uid())
    OR EXISTS (
      SELECT 1 FROM crm_contactos
      WHERE crm_contactos.id = crm_tareas.contacto_id
        AND crm_contactos.creado_por = (select auth.uid())
    )
  );

-- =====================================================
-- VENDOR_MAPPINGS - Simplificar políticas duplicadas
-- =====================================================

DROP POLICY IF EXISTS "Administradores pueden actualizar mapeos" ON vendor_mappings;
DROP POLICY IF EXISTS "Admins can update vendor mappings" ON vendor_mappings;
CREATE POLICY "Admins can update vendor mappings"
  ON vendor_mappings FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = (select auth.uid()) AND rol = 'Administrador'
    )
  );

DROP POLICY IF EXISTS "Administradores pueden crear mapeos" ON vendor_mappings;
DROP POLICY IF EXISTS "Admins can create vendor mappings" ON vendor_mappings;
CREATE POLICY "Admins can create vendor mappings"
  ON vendor_mappings FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = (select auth.uid()) AND rol = 'Administrador'
    )
  );

DROP POLICY IF EXISTS "Administradores pueden eliminar mapeos" ON vendor_mappings;
DROP POLICY IF EXISTS "Admins can delete vendor mappings" ON vendor_mappings;
CREATE POLICY "Admins can delete vendor mappings"
  ON vendor_mappings FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = (select auth.uid()) AND rol = 'Administrador'
    )
  );

DROP POLICY IF EXISTS "Administradores pueden ver todos los mapeos" ON vendor_mappings;
CREATE POLICY "Admins can view vendor mappings"
  ON vendor_mappings FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios WHERE id = (select auth.uid())
    )
  );

-- =====================================================
-- MENSAJES_CHATGPT
-- =====================================================

DROP POLICY IF EXISTS "authenticated_insert_own_messages" ON mensajes_chatgpt;
CREATE POLICY "authenticated_insert_own_messages"
  ON mensajes_chatgpt FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM conversaciones_chatgpt
      WHERE id = mensajes_chatgpt.conversacion_id
        AND usuario_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "authenticated_view_own_messages" ON mensajes_chatgpt;
CREATE POLICY "authenticated_view_own_messages"
  ON mensajes_chatgpt FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversaciones_chatgpt
      WHERE id = mensajes_chatgpt.conversacion_id
        AND usuario_id = (select auth.uid())
    )
  );

-- =====================================================
-- CONVERSACIONES_CHATGPT
-- =====================================================

DROP POLICY IF EXISTS "Authenticated: create own conversations" ON conversaciones_chatgpt;
CREATE POLICY "Authenticated: create own conversations"
  ON conversaciones_chatgpt FOR INSERT TO authenticated
  WITH CHECK (usuario_id = (select auth.uid()));

DROP POLICY IF EXISTS "Authenticated: delete own conversations" ON conversaciones_chatgpt;
CREATE POLICY "Authenticated: delete own conversations"
  ON conversaciones_chatgpt FOR DELETE TO authenticated
  USING (usuario_id = (select auth.uid()));

DROP POLICY IF EXISTS "Authenticated: update own conversations" ON conversaciones_chatgpt;
CREATE POLICY "Authenticated: update own conversations"
  ON conversaciones_chatgpt FOR UPDATE TO authenticated
  USING (usuario_id = (select auth.uid()));

DROP POLICY IF EXISTS "Authenticated: view own conversations" ON conversaciones_chatgpt;
CREATE POLICY "Authenticated: view own conversations"
  ON conversaciones_chatgpt FOR SELECT TO authenticated
  USING (usuario_id = (select auth.uid()));

-- =====================================================
-- COMMISSION_IMPORT_CONFIG
-- =====================================================

DROP POLICY IF EXISTS "Admins pueden actualizar configuración" ON commission_import_config;
CREATE POLICY "Admins pueden actualizar configuración"
  ON commission_import_config FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = (select auth.uid()) AND rol = 'Administrador'
    )
  );

DROP POLICY IF EXISTS "Admins pueden insertar configuración" ON commission_import_config;
CREATE POLICY "Admins pueden insertar configuración"
  ON commission_import_config FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = (select auth.uid()) AND rol = 'Administrador'
    )
  );

DROP POLICY IF EXISTS "Admins pueden ver configuración" ON commission_import_config;
CREATE POLICY "Admins pueden ver configuración"
  ON commission_import_config FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = (select auth.uid()) AND rol = 'Administrador'
    )
  );

-- =====================================================
-- COMMISSION_RECALCULATIONS
-- =====================================================

DROP POLICY IF EXISTS "Admins pueden insertar recálculos" ON commission_recalculations;
CREATE POLICY "Admins pueden insertar recálculos"
  ON commission_recalculations FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = (select auth.uid()) AND rol = 'Administrador'
    )
  );

DROP POLICY IF EXISTS "Admins pueden ver recálculos" ON commission_recalculations;
CREATE POLICY "Admins pueden ver recálculos"
  ON commission_recalculations FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = (select auth.uid()) AND rol = 'Administrador'
    )
  );

-- =====================================================
-- CAT_ASEGURADORAS
-- =====================================================

DROP POLICY IF EXISTS "Admins can manage aseguradoras" ON cat_aseguradoras;
CREATE POLICY "Admins can manage aseguradoras"
  ON cat_aseguradoras FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = (select auth.uid()) AND rol = 'Administrador'
    )
  );

-- =====================================================
-- CORREO_CANALES_HISTORIAL
-- =====================================================

DROP POLICY IF EXISTS "Admins can view canales historial" ON correo_canales_historial;
CREATE POLICY "Admins can view canales historial"
  ON correo_canales_historial FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = (select auth.uid()) AND rol = 'Administrador'
    )
  );

-- =====================================================
-- NOTIFICATION_EVENTS_CATALOG
-- =====================================================

DROP POLICY IF EXISTS "Admins can manage events catalog" ON notification_events_catalog;
CREATE POLICY "Admins can manage events catalog"
  ON notification_events_catalog FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = (select auth.uid()) AND rol = 'Administrador'
    )
  );

-- =====================================================
-- NOTIFICATION_JOBS
-- =====================================================

DROP POLICY IF EXISTS "Admins can view all notification jobs" ON notification_jobs;
CREATE POLICY "Admins can view all notification jobs"
  ON notification_jobs FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = (select auth.uid()) AND rol = 'Administrador'
    )
  );

DROP POLICY IF EXISTS "Users can view own notification jobs" ON notification_jobs;
CREATE POLICY "Users can view own notification jobs"
  ON notification_jobs FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()));

-- =====================================================
-- NOTIFICATION_PROVIDER_LOGS
-- =====================================================

DROP POLICY IF EXISTS "Admins can view provider logs" ON notification_provider_logs;
CREATE POLICY "Admins can view provider logs"
  ON notification_provider_logs FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = (select auth.uid()) AND rol = 'Administrador'
    )
  );

-- =====================================================
-- NOTIFICATION_DELIVERY_ATTEMPTS
-- =====================================================

DROP POLICY IF EXISTS "Admins can view delivery attempts" ON notification_delivery_attempts;
CREATE POLICY "Admins can view delivery attempts"
  ON notification_delivery_attempts FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = (select auth.uid()) AND rol = 'Administrador'
    )
  );

-- =====================================================
-- NOTIFICATION_PHONE_NORMALIZATION_LOG
-- =====================================================

DROP POLICY IF EXISTS "Admins can view phone logs" ON notification_phone_normalization_log;
CREATE POLICY "Admins can view phone logs"
  ON notification_phone_normalization_log FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = (select auth.uid()) AND rol = 'Administrador'
    )
  );
