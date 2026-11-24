/*
  # Limpieza de Índices No Utilizados - Batch 2

  Continuación de la eliminación de índices no utilizados
*/

-- Índices de production
DROP INDEX IF EXISTS idx_production_records_management_id;
DROP INDEX IF EXISTS idx_production_records_office_id;
DROP INDEX IF EXISTS idx_production_records_region_id;
DROP INDEX IF EXISTS idx_production_offices_region_id;
DROP INDEX IF EXISTS idx_production_import_logs_imported_by;
DROP INDEX IF EXISTS idx_production_import_batches_created_by;
DROP INDEX IF EXISTS idx_production_google_sheets_config_configurado_por;

-- Índices de publicidad
DROP INDEX IF EXISTS idx_publicidad_uso_estadisticas_usuario_id;
DROP INDEX IF EXISTS idx_publicidad_disenos_plantilla_id;
DROP INDEX IF EXISTS idx_publicidad_plantillas_categoria_id;
DROP INDEX IF EXISTS idx_publicidad_plantillas_created_by;

-- Índices de reservas
DROP INDEX IF EXISTS idx_reservas_espacio_creado_por;
DROP INDEX IF EXISTS idx_reservas_espacio_oficina_id;
DROP INDEX IF EXISTS idx_reservas_evaluaciones_usuario_id;

-- Índices de seguros education
DROP INDEX IF EXISTS idx_seguros_certificados_categoria_id;
DROP INDEX IF EXISTS idx_seguros_certificados_usuario_id;
DROP INDEX IF EXISTS idx_seguros_lessons_categoria_id;
DROP INDEX IF EXISTS idx_seguros_lessons_creado_por;
DROP INDEX IF EXISTS idx_seguros_lessons_session_id;
DROP INDEX IF EXISTS idx_seguros_sessions_categoria_id;
DROP INDEX IF EXISTS idx_seguros_sessions_creado_por;
DROP INDEX IF EXISTS idx_seguros_categories_creado_por;

-- Índices de solicitudes vacaciones
DROP INDEX IF EXISTS idx_solicitudes_vacaciones_aprobado_por;
DROP INDEX IF EXISTS idx_solicitudes_vacaciones_usuario_id;

-- Índices de store
DROP INDEX IF EXISTS idx_store_pedidos_estatus_id;
DROP INDEX IF EXISTS idx_store_pedidos_notas_pedido_id;
DROP INDEX IF EXISTS idx_store_productos_categoria_id;
DROP INDEX IF EXISTS idx_store_carrito_producto_id;
DROP INDEX IF EXISTS idx_store_pedidos_detalle_producto_id;
DROP INDEX IF EXISTS idx_store_pedidos_historial_cambiado_por;
DROP INDEX IF EXISTS idx_store_pedidos_historial_estatus_id;
DROP INDEX IF EXISTS idx_store_pedidos_notas_admin_id;

-- Índices de tickets
DROP INDEX IF EXISTS idx_ticket_archivos_usuario_id;
DROP INDEX IF EXISTS idx_ticket_asignaciones_asignado_por;
DROP INDEX IF EXISTS idx_ticket_comentarios_usuario_id;
DROP INDEX IF EXISTS idx_ticket_historial_usuario_id;
DROP INDEX IF EXISTS idx_tickets_cerrado_por;
DROP INDEX IF EXISTS idx_tickets_modificado_por;
DROP INDEX IF EXISTS idx_ticket_archivos_ticket_id_fk;
DROP INDEX IF EXISTS idx_ticket_asignaciones_ejecutivo_id;
DROP INDEX IF EXISTS idx_ticket_comentarios_ticket_id_fk;
DROP INDEX IF EXISTS idx_ticket_historial_ticket_id_fk;
DROP INDEX IF EXISTS idx_tickets_agente_id;
DROP INDEX IF EXISTS idx_tickets_assigned_to_user_id;
DROP INDEX IF EXISTS idx_tickets_comisiones_documento_id;
DROP INDEX IF EXISTS idx_tickets_comisiones_lote_id;
DROP INDEX IF EXISTS idx_tickets_creado_por_fk;
DROP INDEX IF EXISTS idx_tickets_estatus_id_fk;
DROP INDEX IF EXISTS idx_tickets_registro_aseguradora;

-- Índices de usuarios
DROP INDEX IF EXISTS idx_usuarios_production_office_id;
DROP INDEX IF EXISTS idx_usuarios_regimen_fiscal_id;
DROP INDEX IF EXISTS idx_usuarios_deleted_by_user_id;

-- Índices de user roles
DROP INDEX IF EXISTS idx_user_roles_oficina_id;

-- Índices de valores campos
DROP INDEX IF EXISTS idx_valores_campos_oficinas_campo_id;
DROP INDEX IF EXISTS idx_valores_campos_personalizados_campo_id;

-- Índices de vendor mapping
DROP INDEX IF EXISTS idx_vendor_mapping_persistent_movi_user_id_fk;
DROP INDEX IF EXISTS idx_vendor_mapping_persistent_assigned_by;
DROP INDEX IF EXISTS idx_vendor_mapping_persistent_legacy_assigned_by;
DROP INDEX IF EXISTS idx_vendor_mapping_persistent_legacy_movi_user_id;
DROP INDEX IF EXISTS idx_vendor_mappings_created_by_fk;
DROP INDEX IF EXISTS idx_vendor_mappings_movi_user_id_fk;
DROP INDEX IF EXISTS idx_vendor_mappings_updated_by;

-- Índices de whatsapp
DROP INDEX IF EXISTS idx_whatsapp_configuracion_configurado_por;

-- Índices de agent mapping
DROP INDEX IF EXISTS idx_agent_mapping_audit_changed_by;
DROP INDEX IF EXISTS idx_agent_user_mappings_created_by;
DROP INDEX IF EXISTS idx_agent_user_mappings_matched_user_id;
DROP INDEX IF EXISTS idx_agent_user_mappings_updated_by;

-- Índices de audit logs
DROP INDEX IF EXISTS idx_audit_logs_performed_by;
DROP INDEX IF EXISTS idx_audit_logs_target_user_id;
