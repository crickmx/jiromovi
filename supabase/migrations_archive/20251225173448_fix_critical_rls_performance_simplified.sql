/*
  # Corrección Simplificada de Performance RLS

  1. Optimización masiva de políticas RLS con auth.uid()
    - Se optimizan las políticas más críticas
    - Se usa (select auth.uid()) para evitar re-evaluación por fila
  
  2. Se eliminan índices no utilizados
    - Mejora de almacenamiento y mantenimiento
*/

-- =====================================================
-- OPTIMIZAR POLÍTICAS RLS CRÍTICAS
-- =====================================================

-- PLANTILLAS_CORREO
DROP POLICY IF EXISTS "Admin y Gerentes pueden gestionar plantillas" ON plantillas_correo;
CREATE POLICY "Admin y Gerentes pueden gestionar plantillas"
  ON plantillas_correo
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = (select auth.uid()) 
        AND rol IN ('Administrador', 'Gerente')
    )
  );

DROP POLICY IF EXISTS "Admin y Gerentes pueden ver plantillas" ON plantillas_correo;
CREATE POLICY "Admin y Gerentes pueden ver plantillas"
  ON plantillas_correo
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = (select auth.uid()) 
        AND rol IN ('Administrador', 'Gerente')
    )
  );

-- CHAT_NO_LEIDOS
DROP POLICY IF EXISTS "Usuarios pueden ver sus propios no leídos" ON chat_no_leidos;
CREATE POLICY "Usuarios pueden ver sus propios no leídos"
  ON chat_no_leidos
  FOR SELECT
  TO authenticated
  USING (usuario_id = (select auth.uid()));

-- COMUNICADOS_ADJUNTOS
DROP POLICY IF EXISTS "Admins can delete attachments" ON comunicados_adjuntos;
CREATE POLICY "Admins can delete attachments"
  ON comunicados_adjuntos
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = (select auth.uid()) AND rol = 'Administrador'
    )
  );

DROP POLICY IF EXISTS "Admins can insert attachments" ON comunicados_adjuntos;
CREATE POLICY "Admins can insert attachments"
  ON comunicados_adjuntos
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = (select auth.uid()) AND rol = 'Administrador'
    )
  );

DROP POLICY IF EXISTS "Admins can view all attachments" ON comunicados_adjuntos;
CREATE POLICY "Admins can view all attachments"
  ON comunicados_adjuntos
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = (select auth.uid()) AND rol = 'Administrador'
    )
  );

-- VACACIONES_BALANCE_ANUAL
DROP POLICY IF EXISTS "Admin y Gerentes pueden gestionar balances" ON vacaciones_balance_anual;
CREATE POLICY "Admin y Gerentes pueden gestionar balances"
  ON vacaciones_balance_anual
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = (select auth.uid()) 
        AND rol IN ('Administrador', 'Gerente')
    )
  );

-- CORREO_DESTINATARIOS_PREDEFINIDOS
DROP POLICY IF EXISTS "Admins can manage correo_destinatarios_predefinidos" ON correo_destinatarios_predefinidos;
CREATE POLICY "Admins can manage correo_destinatarios_predefinidos"
  ON correo_destinatarios_predefinidos
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = (select auth.uid()) AND rol = 'Administrador'
    )
  );

-- CORREO_RECORDATORIOS_CONFIG
DROP POLICY IF EXISTS "Admins can manage correo_recordatorios_config" ON correo_recordatorios_config;
CREATE POLICY "Admins can manage correo_recordatorios_config"
  ON correo_recordatorios_config
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = (select auth.uid()) AND rol = 'Administrador'
    )
  );

-- CORREO_HISTORIAL_ENVIOS
DROP POLICY IF EXISTS "Admins can view all correo_historial" ON correo_historial_envios;
CREATE POLICY "Admins can view all correo_historial"
  ON correo_historial_envios
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = (select auth.uid()) AND rol = 'Administrador'
    )
  );

DROP POLICY IF EXISTS "Users can view own correo_historial" ON correo_historial_envios;
CREATE POLICY "Users can view own correo_historial"
  ON correo_historial_envios
  FOR SELECT
  TO authenticated
  USING (usuario_id = (select auth.uid()));

-- PRODUCTION_REGIONS
DROP POLICY IF EXISTS "Admins can insert regions" ON production_regions;
CREATE POLICY "Admins can insert regions"
  ON production_regions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = (select auth.uid()) AND rol = 'Administrador'
    )
  );

DROP POLICY IF EXISTS "Admins can update regions" ON production_regions;
CREATE POLICY "Admins can update regions"
  ON production_regions
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = (select auth.uid()) AND rol = 'Administrador'
    )
  );

DROP POLICY IF EXISTS "Admins can view all regions" ON production_regions;
CREATE POLICY "Admins can view all regions"
  ON production_regions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = (select auth.uid()) AND rol = 'Administrador'
    )
  );

-- =====================================================
-- ELIMINAR ÍNDICES NO UTILIZADOS (MUESTRA)
-- =====================================================

-- Eliminamos algunos índices no utilizados para mejorar almacenamiento
DROP INDEX IF EXISTS idx_oficinas_logo_url;
DROP INDEX IF EXISTS idx_usuarios_mi_logotipo_url;
DROP INDEX IF EXISTS idx_web_categories_slug;
DROP INDEX IF EXISTS idx_user_web_insurers_insurer;
DROP INDEX IF EXISTS idx_attachments_mensaje;
DROP INDEX IF EXISTS idx_attachments_user;
DROP INDEX IF EXISTS idx_accesos_nacional_creado_por;
DROP INDEX IF EXISTS idx_accesos_nacional_ultima_edicion_por;
DROP INDEX IF EXISTS idx_usuarios_rol_admin;
DROP INDEX IF EXISTS idx_usuarios_oficina_activo;
DROP INDEX IF EXISTS idx_usuarios_web_slug;
DROP INDEX IF EXISTS idx_commission_details_nombre_asegurado;
DROP INDEX IF EXISTS idx_conversaciones_usuario;
DROP INDEX IF EXISTS idx_mensajes_conversacion;
DROP INDEX IF EXISTS idx_assistant_snapshots_usuario_modulo;
DROP INDEX IF EXISTS idx_assistant_snapshots_expires;
DROP INDEX IF EXISTS idx_assistant_action_clicks_usuario;
DROP INDEX IF EXISTS idx_conversaciones_assistant_module;
DROP INDEX IF EXISTS idx_routing_logs_user;
DROP INDEX IF EXISTS idx_routing_logs_mode;
DROP INDEX IF EXISTS idx_routing_logs_created;
DROP INDEX IF EXISTS idx_mode_analytics_user;
DROP INDEX IF EXISTS idx_mode_analytics_period;
DROP INDEX IF EXISTS idx_mensajes_modo;
