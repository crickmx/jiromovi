/*
  # Corrección de problemas críticos de seguridad y performance

  1. Índices faltantes en foreign keys
    - Se agregan 13 índices faltantes en foreign keys
    - Mejora significativa en performance de queries con joins

  2. Optimización de políticas RLS más usadas
    - Se optimizan políticas críticas con (SELECT auth.uid())
    - Reduce evaluaciones repetidas de auth functions

  3. Limpieza de índices no utilizados
    - Se eliminan 12 índices que nunca se usan
    - Ahorra espacio en disco y mejora performance de writes
*/

-- ============================================================================
-- PARTE 1: AGREGAR ÍNDICES FALTANTES EN FOREIGN KEYS
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_agent_mapping_audit_changed_by
  ON agent_mapping_audit(changed_by);

CREATE INDEX IF NOT EXISTS idx_agent_user_mappings_created_by
  ON agent_user_mappings(created_by);
  
CREATE INDEX IF NOT EXISTS idx_agent_user_mappings_updated_by
  ON agent_user_mappings(updated_by);

CREATE INDEX IF NOT EXISTS idx_commission_batches_converted_by
  ON commission_batches(converted_by);

CREATE INDEX IF NOT EXISTS idx_commission_import_config_created_by
  ON commission_import_config(created_by);

CREATE INDEX IF NOT EXISTS idx_commission_items_staging_commission_detail_id
  ON commission_items_staging(commission_detail_id);

CREATE INDEX IF NOT EXISTS idx_commission_recalculations_recalculated_by
  ON commission_recalculations(recalculated_by);

CREATE INDEX IF NOT EXISTS idx_conversion_jobs_started_by
  ON conversion_jobs(started_by);

CREATE INDEX IF NOT EXISTS idx_document_import_batches_converted_by
  ON document_import_batches(converted_by);

CREATE INDEX IF NOT EXISTS idx_usuarios_deleted_by_user_id
  ON usuarios(deleted_by_user_id);

CREATE INDEX IF NOT EXISTS idx_vendor_mapping_persistent_assigned_by
  ON vendor_mapping_persistent(assigned_by);

CREATE INDEX IF NOT EXISTS idx_vendor_mappings_created_by
  ON vendor_mappings(created_by);
  
CREATE INDEX IF NOT EXISTS idx_vendor_mappings_updated_by
  ON vendor_mappings(updated_by);

-- ============================================================================
-- PARTE 2: OPTIMIZAR POLÍTICAS RLS CRÍTICAS
-- ============================================================================

-- Usuarios (tablas más consultada)
DROP POLICY IF EXISTS "Users can read own profile" ON usuarios;
CREATE POLICY "Users can read own profile" ON usuarios
  FOR SELECT TO authenticated
  USING (id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can update own profile" ON usuarios;
CREATE POLICY "Users can update own profile" ON usuarios
  FOR UPDATE TO authenticated
  USING (id = (SELECT auth.uid()))
  WITH CHECK (id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can view own data" ON usuarios;
CREATE POLICY "Users can view own data" ON usuarios
  FOR SELECT TO authenticated
  USING (id = (SELECT auth.uid()));

-- Chat (muy usado)
DROP POLICY IF EXISTS "chat_miembros_delete_propio" ON chat_miembros;
CREATE POLICY "chat_miembros_delete_propio" ON chat_miembros
  FOR DELETE TO authenticated
  USING (usuario_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "chat_miembros_update_propio" ON chat_miembros;
CREATE POLICY "chat_miembros_update_propio" ON chat_miembros
  FOR UPDATE TO authenticated
  USING (usuario_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "chats_delete_creador" ON chats;
CREATE POLICY "chats_delete_creador" ON chats
  FOR DELETE TO authenticated
  USING (creador_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "chats_insert_authenticated" ON chats;
CREATE POLICY "chats_insert_authenticated" ON chats
  FOR INSERT TO authenticated
  WITH CHECK (creador_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "chats_update_creador" ON chats;
CREATE POLICY "chats_update_creador" ON chats
  FOR UPDATE TO authenticated
  USING (creador_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "chat_mensajes_delete_propio" ON chat_mensajes;
CREATE POLICY "chat_mensajes_delete_propio" ON chat_mensajes
  FOR DELETE TO authenticated
  USING (remitente_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "chat_mensajes_update_propio" ON chat_mensajes;
CREATE POLICY "chat_mensajes_update_propio" ON chat_mensajes
  FOR UPDATE TO authenticated
  USING (remitente_id = (SELECT auth.uid()));

-- Store (muy usado)
DROP POLICY IF EXISTS "Usuarios pueden ver su carrito" ON store_carrito;
CREATE POLICY "Usuarios pueden ver su carrito" ON store_carrito
  FOR SELECT TO authenticated
  USING (usuario_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Usuarios pueden agregar a su carrito" ON store_carrito;
CREATE POLICY "Usuarios pueden agregar a su carrito" ON store_carrito
  FOR INSERT TO authenticated
  WITH CHECK (usuario_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Usuarios pueden actualizar su carrito" ON store_carrito;
CREATE POLICY "Usuarios pueden actualizar su carrito" ON store_carrito
  FOR UPDATE TO authenticated
  USING (usuario_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Usuarios pueden eliminar de su carrito" ON store_carrito;
CREATE POLICY "Usuarios pueden eliminar de su carrito" ON store_carrito
  FOR DELETE TO authenticated
  USING (usuario_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Usuarios pueden crear pedidos" ON store_pedidos;
CREATE POLICY "Usuarios pueden crear pedidos" ON store_pedidos
  FOR INSERT TO authenticated
  WITH CHECK (usuario_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Usuarios pueden ver sus pedidos" ON store_pedidos;
CREATE POLICY "Usuarios pueden ver sus pedidos" ON store_pedidos
  FOR SELECT TO authenticated
  USING (usuario_id = (SELECT auth.uid()));

-- CRM (muy usado)
DROP POLICY IF EXISTS "Usuarios solo ven sus propios contactos" ON crm_contactos;
CREATE POLICY "Usuarios solo ven sus propios contactos" ON crm_contactos
  FOR SELECT TO authenticated
  USING (creado_por = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Usuarios solo crean contactos propios" ON crm_contactos;
CREATE POLICY "Usuarios solo crean contactos propios" ON crm_contactos
  FOR INSERT TO authenticated
  WITH CHECK (creado_por = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Usuarios solo actualizan sus propios contactos" ON crm_contactos;
CREATE POLICY "Usuarios solo actualizan sus propios contactos" ON crm_contactos
  FOR UPDATE TO authenticated
  USING (creado_por = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Usuarios solo eliminan sus propios contactos" ON crm_contactos;
CREATE POLICY "Usuarios solo eliminan sus propios contactos" ON crm_contactos
  FOR DELETE TO authenticated
  USING (creado_por = (SELECT auth.uid()));

-- Notificaciones
DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
CREATE POLICY "Users can view own notifications" ON notifications
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
CREATE POLICY "Users can update own notifications" ON notifications
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- ============================================================================
-- PARTE 3: ELIMINAR ÍNDICES NO UTILIZADOS
-- ============================================================================

DROP INDEX IF EXISTS idx_valores_campo;
DROP INDEX IF EXISTS idx_permisos_rol;
DROP INDEX IF EXISTS idx_usuarios_activo;
DROP INDEX IF EXISTS idx_areas_activo;
DROP INDEX IF EXISTS idx_notificaciones_modulo;
DROP INDEX IF EXISTS idx_contactos_email;
DROP INDEX IF EXISTS idx_contactos_nombre;
DROP INDEX IF EXISTS idx_contactos_apellido;
DROP INDEX IF EXISTS idx_contactos_empresa;
DROP INDEX IF EXISTS idx_usuarios_nombre_completo_busqueda;
DROP INDEX IF EXISTS idx_usuarios_email_laboral;
DROP INDEX IF EXISTS idx_usuarios_nombre_completo;
