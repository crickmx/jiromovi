/*
  # Fix Security and Performance Issues - Part 1: Foreign Key Indexes

  1. Performance Optimization
    - Add missing indexes on all foreign key columns
    - This prevents table scans and improves query performance significantly
    
  2. Tables affected (94 foreign keys total)
    - agent_mapping_audit, agent_user_mappings, audit_logs
    - aula_virtual_chat, aula_virtual_eventos, aula_virtual_sesiones
    - chat_archivos, chat_mensajes, chat_no_leidos, chats
    - commission_* tables (agents, batches, business_rules, details, etc.)
    - configuracion_sistema, conversion_jobs, correo_* tables
    - crm_* tables, dashboard_calendar_events
    - document_import_*, gmm_*, historial_correos
    - meeting_*, notificaciones_globales, notification_*
    - production_*, publicidad_*, seguros_*, store_*
    - tariff_*, ticket_*, user_roles, usuarios
    - valores_campos_*, vendor_*, whatsapp_configuracion
*/

-- ============================================
-- AGENT MAPPING TABLES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_agent_mapping_audit_changed_by 
  ON agent_mapping_audit(changed_by);

CREATE INDEX IF NOT EXISTS idx_agent_user_mappings_created_by 
  ON agent_user_mappings(created_by);

CREATE INDEX IF NOT EXISTS idx_agent_user_mappings_matched_user_id 
  ON agent_user_mappings(matched_user_id);

CREATE INDEX IF NOT EXISTS idx_agent_user_mappings_updated_by 
  ON agent_user_mappings(updated_by);

-- ============================================
-- AUDIT TABLES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_audit_logs_performed_by 
  ON audit_logs(performed_by);

CREATE INDEX IF NOT EXISTS idx_audit_logs_target_user_id 
  ON audit_logs(target_user_id);

-- ============================================
-- AULA VIRTUAL TABLES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_aula_virtual_chat_destinatario_id 
  ON aula_virtual_chat(destinatario_id);

CREATE INDEX IF NOT EXISTS idx_aula_virtual_chat_participante_id 
  ON aula_virtual_chat(participante_id);

CREATE INDEX IF NOT EXISTS idx_aula_virtual_eventos_participante_id 
  ON aula_virtual_eventos(participante_id);

CREATE INDEX IF NOT EXISTS idx_aula_virtual_sesiones_instructor_id 
  ON aula_virtual_sesiones(instructor_id);

-- ============================================
-- CHAT TABLES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_chat_archivos_chat_id 
  ON chat_archivos(chat_id);

CREATE INDEX IF NOT EXISTS idx_chat_archivos_mensaje_id 
  ON chat_archivos(mensaje_id);

CREATE INDEX IF NOT EXISTS idx_chat_archivos_remitente_id 
  ON chat_archivos(remitente_id);

CREATE INDEX IF NOT EXISTS idx_chat_mensajes_responde_a_id 
  ON chat_mensajes(responde_a_id);

CREATE INDEX IF NOT EXISTS idx_chat_no_leidos_ultimo_mensaje_id 
  ON chat_no_leidos(ultimo_mensaje_id);

CREATE INDEX IF NOT EXISTS idx_chat_no_leidos_usuario_id_fk 
  ON chat_no_leidos(usuario_id);

CREATE INDEX IF NOT EXISTS idx_chats_creador_id 
  ON chats(creador_id);

-- ============================================
-- COMMISSION TABLES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_commission_agents_fiscal_regime_id 
  ON commission_agents(fiscal_regime_id);

CREATE INDEX IF NOT EXISTS idx_commission_agents_office_id 
  ON commission_agents(office_id);

CREATE INDEX IF NOT EXISTS idx_commission_batches_converted_by 
  ON commission_batches(converted_by);

CREATE INDEX IF NOT EXISTS idx_commission_batches_source_import_batch_id 
  ON commission_batches(source_import_batch_id);

CREATE INDEX IF NOT EXISTS idx_commission_business_rules_office_id 
  ON commission_business_rules(office_id);

CREATE INDEX IF NOT EXISTS idx_commission_details_adjusted_by_user_id 
  ON commission_details(adjusted_by_user_id);

CREATE INDEX IF NOT EXISTS idx_commission_details_business_rule_id 
  ON commission_details(business_rule_id);

CREATE INDEX IF NOT EXISTS idx_commission_details_movi_user_id 
  ON commission_details(movi_user_id);

CREATE INDEX IF NOT EXISTS idx_commission_details_office_id 
  ON commission_details(office_id);

CREATE INDEX IF NOT EXISTS idx_commission_import_config_created_by 
  ON commission_import_config(created_by);

CREATE INDEX IF NOT EXISTS idx_commission_recalculations_recalculated_by 
  ON commission_recalculations(recalculated_by);

CREATE INDEX IF NOT EXISTS idx_commission_staging_sessions_uploaded_by 
  ON commission_staging_sessions(uploaded_by);

-- ============================================
-- CONFIGURATION TABLES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_configuracion_sistema_modificado_por 
  ON configuracion_sistema(modificado_por);

CREATE INDEX IF NOT EXISTS idx_conversion_jobs_batch_id 
  ON conversion_jobs(batch_id);

CREATE INDEX IF NOT EXISTS idx_conversion_jobs_started_by 
  ON conversion_jobs(started_by);

-- ============================================
-- CORREO (EMAIL) TABLES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_correo_canales_historial_cambiado_por 
  ON correo_canales_historial(cambiado_por);

CREATE INDEX IF NOT EXISTS idx_correo_configuracion_configurado_por 
  ON correo_configuracion(configurado_por);

CREATE INDEX IF NOT EXISTS idx_correo_historial_envios_enviado_por 
  ON correo_historial_envios(enviado_por);

CREATE INDEX IF NOT EXISTS idx_correo_historial_envios_tipo_notificacion_id 
  ON correo_historial_envios(tipo_notificacion_id);

CREATE INDEX IF NOT EXISTS idx_correo_plantillas_actualizado_por 
  ON correo_plantillas(actualizado_por);

-- ============================================
-- CRM TABLES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_crm_birthday_reminders_usuario_id_fk 
  ON crm_birthday_reminders(usuario_id);

CREATE INDEX IF NOT EXISTS idx_crm_cotizaciones_creado_por_fk 
  ON crm_cotizaciones(creado_por);

CREATE INDEX IF NOT EXISTS idx_crm_notas_creado_por_fk 
  ON crm_notas(creado_por);

CREATE INDEX IF NOT EXISTS idx_crm_polizas_creado_por_fk 
  ON crm_polizas(creado_por);

-- ============================================
-- DASHBOARD TABLES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_dashboard_calendar_events_usuario_id_fk 
  ON dashboard_calendar_events(usuario_id);

-- ============================================
-- DOCUMENT IMPORT TABLES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_document_import_batches_converted_by 
  ON document_import_batches(converted_by);

CREATE INDEX IF NOT EXISTS idx_document_import_batches_imported_by 
  ON document_import_batches(imported_by);

CREATE INDEX IF NOT EXISTS idx_document_import_items_movi_user_id 
  ON document_import_items(movi_user_id);

-- ============================================
-- GMM TABLES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_gmm_quotations_editada_desde_cotizacion_id 
  ON gmm_quotations(editada_desde_cotizacion_id);

CREATE INDEX IF NOT EXISTS idx_gmm_quotations_usuario_id_fk 
  ON gmm_quotations(usuario_id);

CREATE INDEX IF NOT EXISTS idx_gmm_quotes_created_by_fk 
  ON gmm_quotes(created_by);

CREATE INDEX IF NOT EXISTS idx_gmm_quotes_tariff_package_id 
  ON gmm_quotes(tariff_package_id);

-- ============================================
-- HISTORIAL CORREOS
-- ============================================

CREATE INDEX IF NOT EXISTS idx_historial_correos_plantilla_id_fk 
  ON historial_correos(plantilla_id);

-- ============================================
-- IMPORTED DOCUMENTS
-- ============================================

CREATE INDEX IF NOT EXISTS idx_imported_documents_batch_id_fk 
  ON imported_documents(batch_id);

CREATE INDEX IF NOT EXISTS idx_imported_documents_movi_user_id_fk 
  ON imported_documents(movi_user_id);

-- ============================================
-- MEETING TABLES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_meeting_chat_messages_meeting_id 
  ON meeting_chat_messages(meeting_id);

CREATE INDEX IF NOT EXISTS idx_meeting_participants_user_id_fk2 
  ON meeting_participants(user_id);

-- ============================================
-- NOTIFICATION TABLES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_notificaciones_globales_enviado_por 
  ON notificaciones_globales(enviado_por);

CREATE INDEX IF NOT EXISTS idx_notification_delivery_attempts_job_id 
  ON notification_delivery_attempts(job_id);

-- ============================================
-- PRODUCTION TABLES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_production_google_sheets_config_configurado_por 
  ON production_google_sheets_config(configurado_por_user_id);

CREATE INDEX IF NOT EXISTS idx_production_import_batches_created_by 
  ON production_import_batches(created_by);

CREATE INDEX IF NOT EXISTS idx_production_import_logs_imported_by 
  ON production_import_logs(imported_by_user_id);

CREATE INDEX IF NOT EXISTS idx_production_offices_region_id 
  ON production_offices(region_id);

CREATE INDEX IF NOT EXISTS idx_production_records_user_id_fk 
  ON production_records(user_id);

-- ============================================
-- PUBLICIDAD TABLES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_publicidad_disenos_plantilla_id 
  ON publicidad_disenos(plantilla_id);

CREATE INDEX IF NOT EXISTS idx_publicidad_plantillas_categoria_id 
  ON publicidad_plantillas(categoria_id);

CREATE INDEX IF NOT EXISTS idx_publicidad_plantillas_created_by 
  ON publicidad_plantillas(created_by);

-- ============================================
-- SEGUROS TABLES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_seguros_categories_creado_por 
  ON seguros_categories(creado_por);

-- ============================================
-- STORE TABLES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_store_carrito_producto_id 
  ON store_carrito(producto_id);

CREATE INDEX IF NOT EXISTS idx_store_pedidos_detalle_producto_id 
  ON store_pedidos_detalle(producto_id);

CREATE INDEX IF NOT EXISTS idx_store_pedidos_historial_cambiado_por 
  ON store_pedidos_historial(cambiado_por);

CREATE INDEX IF NOT EXISTS idx_store_pedidos_historial_estatus_id 
  ON store_pedidos_historial(estatus_id);

CREATE INDEX IF NOT EXISTS idx_store_pedidos_notas_admin_id 
  ON store_pedidos_notas(admin_id);

-- ============================================
-- TARIFF TABLES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_tariff_packages_activated_by 
  ON tariff_packages(activated_by);

CREATE INDEX IF NOT EXISTS idx_tariff_packages_created_by 
  ON tariff_packages(created_by);

-- ============================================
-- TICKET TABLES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_ticket_archivos_ticket_id_fk 
  ON ticket_archivos(ticket_id);

CREATE INDEX IF NOT EXISTS idx_ticket_asignaciones_ejecutivo_id 
  ON ticket_asignaciones(ejecutivo_id);

CREATE INDEX IF NOT EXISTS idx_ticket_comentarios_ticket_id_fk 
  ON ticket_comentarios(ticket_id);

CREATE INDEX IF NOT EXISTS idx_ticket_historial_ticket_id_fk 
  ON ticket_historial(ticket_id);

CREATE INDEX IF NOT EXISTS idx_tickets_agente_id 
  ON tickets(agente_id);

CREATE INDEX IF NOT EXISTS idx_tickets_assigned_to_user_id 
  ON tickets(assigned_to_user_id);

CREATE INDEX IF NOT EXISTS idx_tickets_comisiones_documento_id 
  ON tickets(comisiones_documento_id);

CREATE INDEX IF NOT EXISTS idx_tickets_comisiones_lote_id 
  ON tickets(comisiones_lote_id);

CREATE INDEX IF NOT EXISTS idx_tickets_creado_por_fk 
  ON tickets(creado_por);

CREATE INDEX IF NOT EXISTS idx_tickets_estatus_id_fk 
  ON tickets(estatus_id);

CREATE INDEX IF NOT EXISTS idx_tickets_registro_aseguradora 
  ON tickets(registro_aseguradora);

-- ============================================
-- USER TABLES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_user_roles_oficina_id 
  ON user_roles(oficina_id);

CREATE INDEX IF NOT EXISTS idx_usuarios_deleted_by_user_id 
  ON usuarios(deleted_by_user_id);

-- ============================================
-- VALORES CAMPOS TABLES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_valores_campos_oficinas_campo_id 
  ON valores_campos_oficinas(campo_id);

CREATE INDEX IF NOT EXISTS idx_valores_campos_personalizados_campo_id 
  ON valores_campos_personalizados(campo_id);

-- ============================================
-- VENDOR MAPPING TABLES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_vendor_mapping_persistent_assigned_by 
  ON vendor_mapping_persistent(assigned_by);

CREATE INDEX IF NOT EXISTS idx_vendor_mapping_persistent_legacy_assigned_by 
  ON vendor_mapping_persistent_legacy(assigned_by);

CREATE INDEX IF NOT EXISTS idx_vendor_mapping_persistent_legacy_movi_user_id 
  ON vendor_mapping_persistent_legacy(movi_user_id);

CREATE INDEX IF NOT EXISTS idx_vendor_mappings_created_by_fk 
  ON vendor_mappings(created_by);

CREATE INDEX IF NOT EXISTS idx_vendor_mappings_movi_user_id_fk 
  ON vendor_mappings(movi_user_id);

CREATE INDEX IF NOT EXISTS idx_vendor_mappings_updated_by 
  ON vendor_mappings(updated_by);

-- ============================================
-- WHATSAPP CONFIGURATION
-- ============================================

CREATE INDEX IF NOT EXISTS idx_whatsapp_configuracion_configurado_por 
  ON whatsapp_configuracion(configurado_por);
