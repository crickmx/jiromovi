/*
  # Consolidación de Políticas RLS Duplicadas (Corregido)

  Elimina políticas duplicadas y mantiene solo una versión optimizada
*/

-- =====================================================
-- ASSISTANT_ACTION_CLICKS - Eliminar duplicados
-- =====================================================

DROP POLICY IF EXISTS "Action Clicks: insert own" ON assistant_action_clicks;

-- =====================================================
-- ASSISTANT_ACTIONS - Consolidar políticas de select
-- =====================================================

DROP POLICY IF EXISTS "Anyone can view active actions" ON assistant_actions;

-- =====================================================
-- ASSISTANT_INTENTS - Consolidar
-- =====================================================

DROP POLICY IF EXISTS "Anyone can view active intents" ON assistant_intents;

-- =====================================================
-- ASSISTANT_SUGGESTIONS - Consolidar
-- =====================================================

DROP POLICY IF EXISTS "Anyone can view active suggestions" ON assistant_suggestions;

-- =====================================================
-- AULA_EVENTOS - Consolidar
-- =====================================================

DROP POLICY IF EXISTS "Administradores pueden ver todos los eventos" ON aula_eventos;

-- =====================================================
-- AULA_VIRTUAL_GRABACIONES - Consolidar
-- =====================================================

DROP POLICY IF EXISTS "Sistema puede gestionar grabaciones" ON aula_virtual_grabaciones;

-- =====================================================
-- CAMPOS_PERSONALIZADOS - Consolidar
-- =====================================================

DROP POLICY IF EXISTS "Admins can manage custom fields" ON campos_personalizados;
CREATE POLICY "Admins can manage custom fields"
  ON campos_personalizados FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = (select auth.uid()) AND rol = 'Administrador'
    )
  );

DROP POLICY IF EXISTS "Users can view active custom fields" ON campos_personalizados;
CREATE POLICY "Users can view active custom fields"
  ON campos_personalizados FOR SELECT TO authenticated
  USING (activo = true);

-- =====================================================
-- CAMPOS_PERSONALIZADOS_OFICINAS - Consolidar
-- =====================================================

DROP POLICY IF EXISTS "Admins can manage custom office fields" ON campos_personalizados_oficinas;
CREATE POLICY "Admins can manage custom office fields"
  ON campos_personalizados_oficinas FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = (select auth.uid()) AND rol = 'Administrador'
    )
  );

DROP POLICY IF EXISTS "Users can read custom office fields" ON campos_personalizados_oficinas;
CREATE POLICY "Users can read custom office fields"
  ON campos_personalizados_oficinas FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios WHERE id = (select auth.uid())
    )
  );

-- =====================================================
-- CAT_ASEGURADORAS - Consolidar
-- =====================================================

DROP POLICY IF EXISTS "Everyone can view aseguradoras" ON cat_aseguradoras;
CREATE POLICY "Everyone can view aseguradoras"
  ON cat_aseguradoras FOR SELECT TO authenticated
  USING (true);

-- =====================================================
-- COMMISSION_AGENTS - Consolidar
-- =====================================================

DROP POLICY IF EXISTS "Authenticated users can view agents" ON commission_agents;
CREATE POLICY "Authenticated users can view agents"
  ON commission_agents FOR SELECT TO authenticated
  USING (true);

-- =====================================================
-- COMMISSION_BATCHES - Consolidar (usar "status")
-- =====================================================

DROP POLICY IF EXISTS "Authenticated users can view batches" ON commission_batches;
DROP POLICY IF EXISTS "Users view closed batches" ON commission_batches;
CREATE POLICY "Users can view batches"
  ON commission_batches FOR SELECT TO authenticated
  USING (
    status = 'closed' 
    OR EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = (select auth.uid()) AND rol = 'Administrador'
    )
  );

-- =====================================================
-- COMMISSION_BUSINESS_RULES - Consolidar
-- =====================================================

DROP POLICY IF EXISTS "Authenticated users can view rules" ON commission_business_rules;
CREATE POLICY "Authenticated users can view rules"
  ON commission_business_rules FOR SELECT TO authenticated
  USING (true);

-- =====================================================
-- COMMISSION_ERRORS - Consolidar
-- =====================================================

DROP POLICY IF EXISTS "Authenticated users can view errors" ON commission_errors;
CREATE POLICY "Authenticated users can view errors"
  ON commission_errors FOR SELECT TO authenticated
  USING (true);

-- =====================================================
-- COMMISSION_FISCAL_REGIMES - Consolidar
-- =====================================================

DROP POLICY IF EXISTS "All authenticated users can view fiscal regimes" ON commission_fiscal_regimes;
DROP POLICY IF EXISTS "Authenticated users can view fiscal regimes" ON commission_fiscal_regimes;
CREATE POLICY "Authenticated users can view fiscal regimes"
  ON commission_fiscal_regimes FOR SELECT TO authenticated
  USING (true);

-- =====================================================
-- COMMISSION_OFFICES - Consolidar
-- =====================================================

DROP POLICY IF EXISTS "Authenticated users can view offices" ON commission_offices;
CREATE POLICY "Authenticated users can view offices"
  ON commission_offices FOR SELECT TO authenticated
  USING (true);

-- =====================================================
-- COMUNICADOS_ADJUNTOS - Consolidar
-- =====================================================

DROP POLICY IF EXISTS "Anyone can view attachments of published comunicados" ON comunicados_adjuntos;
CREATE POLICY "Authenticated can view attachments"
  ON comunicados_adjuntos FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios WHERE id = (select auth.uid())
    )
  );

-- =====================================================
-- COMUNICADOS_VISIBILIDAD - Consolidar
-- =====================================================

DROP POLICY IF EXISTS "Admins and Gerentes can manage visibility" ON comunicados_visibilidad;
DROP POLICY IF EXISTS "Anyone can view visibility rules" ON comunicados_visibilidad;
CREATE POLICY "Users can view visibility rules"
  ON comunicados_visibilidad FOR SELECT TO authenticated
  USING (true);

-- =====================================================
-- CONFIGURACION_SISTEMA - Consolidar
-- =====================================================

DROP POLICY IF EXISTS "Todos pueden leer configuración" ON configuracion_sistema;
CREATE POLICY "Todos pueden leer configuración"
  ON configuracion_sistema FOR SELECT TO authenticated
  USING (true);

-- =====================================================
-- CONTACTOS - Consolidar
-- =====================================================

DROP POLICY IF EXISTS "Admins can view all contacts" ON contactos;
DROP POLICY IF EXISTS "Users can manage own contacts" ON contactos;

CREATE POLICY "Users can manage own contacts"
  ON contactos FOR ALL TO authenticated
  USING (asignado_a = (select auth.uid()));

CREATE POLICY "Admins can view all contacts"
  ON contactos FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = (select auth.uid()) AND rol = 'Administrador'
    )
  );

-- =====================================================
-- DOCUMENTOS_USUARIOS - Consolidar
-- =====================================================

DROP POLICY IF EXISTS "Admins can view all documents" ON documentos_usuarios;
DROP POLICY IF EXISTS "Users can view own documents" ON documentos_usuarios;

-- Ya consolidado anteriormente con "Admins can manage all documents" y "Users can manage own documents"

-- =====================================================
-- EMAIL_CONFIG_GLOBAL - Consolidar
-- =====================================================

DROP POLICY IF EXISTS "Anyone can read email config" ON email_config_global;
CREATE POLICY "Anyone can read email config"
  ON email_config_global FOR SELECT TO authenticated
  USING (true);

-- =====================================================
-- EMAIL_CONFIGURACIONES - Consolidar
-- =====================================================

DROP POLICY IF EXISTS "Admins can view all email configs" ON email_configuraciones;
DROP POLICY IF EXISTS "Users can manage own email config" ON email_configuraciones;
DROP POLICY IF EXISTS "Users can view own email config" ON email_configuraciones;

CREATE POLICY "Users can manage own email config"
  ON email_configuraciones FOR ALL TO authenticated
  USING (usuario_id = (select auth.uid()));

CREATE POLICY "Admins can view all email configs"
  ON email_configuraciones FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = (select auth.uid()) AND rol = 'Administrador'
    )
  );

-- =====================================================
-- EMAIL_TEMPLATES - Consolidar
-- =====================================================

DROP POLICY IF EXISTS "Admins can manage templates" ON email_templates;
DROP POLICY IF EXISTS "All users can view active templates" ON email_templates;

CREATE POLICY "Admins can manage templates"
  ON email_templates FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = (select auth.uid()) AND rol = 'Administrador'
    )
  );

CREATE POLICY "All users can view active templates"
  ON email_templates FOR SELECT TO authenticated
  USING (activo = true);

-- =====================================================
-- ESQUEMAS_PAGO - Consolidar
-- =====================================================

DROP POLICY IF EXISTS "Admins can manage payment schemes" ON esquemas_pago;
DROP POLICY IF EXISTS "All users can view active payment schemes" ON esquemas_pago;

CREATE POLICY "Admins can manage payment schemes"
  ON esquemas_pago FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = (select auth.uid()) AND rol = 'Administrador'
    )
  );

CREATE POLICY "All users can view active payment schemes"
  ON esquemas_pago FOR SELECT TO authenticated
  USING (activo = true);
