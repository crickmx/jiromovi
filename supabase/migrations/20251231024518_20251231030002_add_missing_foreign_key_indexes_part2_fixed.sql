/*
  # Add Missing Foreign Key Indexes (Part 2 - Fixed)
  
  1. Performance Improvements
    - Continues adding covering indexes for remaining foreign keys
    - Covers document imports, production, tickets, and other modules
  
  2. Changes
    - Adds remaining foreign key indexes
    - Skips indexes that already exist or have column issues
*/

-- document_import_batches
CREATE INDEX IF NOT EXISTS idx_document_import_batches_converted_by ON public.document_import_batches(converted_by);
CREATE INDEX IF NOT EXISTS idx_document_import_batches_imported_by ON public.document_import_batches(imported_by);

-- document_import_items
CREATE INDEX IF NOT EXISTS idx_document_import_items_movi_user_id ON public.document_import_items(movi_user_id);

-- documentos_usuarios
CREATE INDEX IF NOT EXISTS idx_documentos_usuarios_usuario_id ON public.documentos_usuarios(usuario_id);

-- expediente_usuario
CREATE INDEX IF NOT EXISTS idx_expediente_usuario_subido_por ON public.expediente_usuario(subido_por);

-- firma_asignaciones
CREATE INDEX IF NOT EXISTS idx_firma_asignaciones_ref_oficina_id ON public.firma_asignaciones(ref_oficina_id);
CREATE INDEX IF NOT EXISTS idx_firma_asignaciones_ref_usuario_id ON public.firma_asignaciones(ref_usuario_id);
CREATE INDEX IF NOT EXISTS idx_firma_asignaciones_template_id ON public.firma_asignaciones(template_id);

-- gmm_quotations
CREATE INDEX IF NOT EXISTS idx_gmm_quotations_editada_desde_cotizacion_id ON public.gmm_quotations(editada_desde_cotizacion_id);
CREATE INDEX IF NOT EXISTS idx_gmm_quotations_usuario_id ON public.gmm_quotations(usuario_id);

-- gmm_quotes
CREATE INDEX IF NOT EXISTS idx_gmm_quotes_created_by ON public.gmm_quotes(created_by);
CREATE INDEX IF NOT EXISTS idx_gmm_quotes_tariff_package_id ON public.gmm_quotes(tariff_package_id);

-- historial_correos
CREATE INDEX IF NOT EXISTS idx_historial_correos_destinatario_id ON public.historial_correos(destinatario_id);
CREATE INDEX IF NOT EXISTS idx_historial_correos_enviado_por_id ON public.historial_correos(enviado_por_id);
CREATE INDEX IF NOT EXISTS idx_historial_correos_plantilla_id ON public.historial_correos(plantilla_id);

-- imported_documents
CREATE INDEX IF NOT EXISTS idx_imported_documents_batch_id ON public.imported_documents(batch_id);
CREATE INDEX IF NOT EXISTS idx_imported_documents_movi_user_id ON public.imported_documents(movi_user_id);

-- meetings
CREATE INDEX IF NOT EXISTS idx_meetings_host_id ON public.meetings(host_id);

-- notificaciones_globales
CREATE INDEX IF NOT EXISTS idx_notificaciones_globales_enviado_por ON public.notificaciones_globales(enviado_por);

-- notification_delivery_attempts
CREATE INDEX IF NOT EXISTS idx_notification_delivery_attempts_job_id ON public.notification_delivery_attempts(job_id);

-- notification_jobs
CREATE INDEX IF NOT EXISTS idx_notification_jobs_user_id ON public.notification_jobs(user_id);

-- notification_provider_logs
CREATE INDEX IF NOT EXISTS idx_notification_provider_logs_job_id ON public.notification_provider_logs(job_id);

-- plantillas_correo
CREATE INDEX IF NOT EXISTS idx_plantillas_correo_created_by ON public.plantillas_correo(created_by);

-- production_google_sheets_config
CREATE INDEX IF NOT EXISTS idx_prod_sheets_config_configurado_por ON public.production_google_sheets_config(configurado_por_user_id);

-- production_import_batches
CREATE INDEX IF NOT EXISTS idx_production_import_batches_created_by ON public.production_import_batches(created_by);

-- production_import_logs
CREATE INDEX IF NOT EXISTS idx_production_import_logs_imported_by ON public.production_import_logs(imported_by_user_id);

-- production_offices
CREATE INDEX IF NOT EXISTS idx_production_offices_region_id ON public.production_offices(region_id);

-- production_records
CREATE INDEX IF NOT EXISTS idx_production_records_management_id ON public.production_records(management_id);
CREATE INDEX IF NOT EXISTS idx_production_records_office_id ON public.production_records(office_id);
CREATE INDEX IF NOT EXISTS idx_production_records_region_id ON public.production_records(region_id);

-- publicidad_disenos
CREATE INDEX IF NOT EXISTS idx_publicidad_disenos_plantilla_id ON public.publicidad_disenos(plantilla_id);

-- publicidad_plantillas
CREATE INDEX IF NOT EXISTS idx_publicidad_plantillas_categoria_id ON public.publicidad_plantillas(categoria_id);
CREATE INDEX IF NOT EXISTS idx_publicidad_plantillas_created_by ON public.publicidad_plantillas(created_by);

-- publicidad_uso_estadisticas
CREATE INDEX IF NOT EXISTS idx_publicidad_uso_estadisticas_usuario_id ON public.publicidad_uso_estadisticas(usuario_id);

-- reservas_espacio
CREATE INDEX IF NOT EXISTS idx_reservas_espacio_creado_por ON public.reservas_espacio(creado_por);
CREATE INDEX IF NOT EXISTS idx_reservas_espacio_oficina_id ON public.reservas_espacio(oficina_id);

-- reservas_evaluaciones
CREATE INDEX IF NOT EXISTS idx_reservas_evaluaciones_usuario_id ON public.reservas_evaluaciones(usuario_id);

-- seguros_categories
CREATE INDEX IF NOT EXISTS idx_seguros_categories_creado_por ON public.seguros_categories(creado_por);

-- seguros_certificados
CREATE INDEX IF NOT EXISTS idx_seguros_certificados_categoria_id ON public.seguros_certificados(categoria_id);
CREATE INDEX IF NOT EXISTS idx_seguros_certificados_usuario_id ON public.seguros_certificados(usuario_id);

-- seguros_lessons
CREATE INDEX IF NOT EXISTS idx_seguros_lessons_creado_por ON public.seguros_lessons(creado_por);
CREATE INDEX IF NOT EXISTS idx_seguros_lessons_session_id ON public.seguros_lessons(session_id);

-- seguros_sessions
CREATE INDEX IF NOT EXISTS idx_seguros_sessions_categoria_id ON public.seguros_sessions(categoria_id);
CREATE INDEX IF NOT EXISTS idx_seguros_sessions_creado_por ON public.seguros_sessions(creado_por);

-- sicas_mapeo_despacho_oficina
CREATE INDEX IF NOT EXISTS idx_sicas_mapeo_despacho_oficina_mapped_by ON public.sicas_mapeo_despacho_oficina(mapped_by);

-- sicas_mapeo_vendedor_usuario
CREATE INDEX IF NOT EXISTS idx_sicas_mapeo_vendedor_usuario_mapped_by ON public.sicas_mapeo_vendedor_usuario(mapped_by);

-- solicitudes_vacaciones
CREATE INDEX IF NOT EXISTS idx_solicitudes_vacaciones_aprobado_por ON public.solicitudes_vacaciones(aprobado_por);
CREATE INDEX IF NOT EXISTS idx_solicitudes_vacaciones_usuario_id ON public.solicitudes_vacaciones(usuario_id);

-- store_carrito
CREATE INDEX IF NOT EXISTS idx_store_carrito_producto_id ON public.store_carrito(producto_id);

-- store_pedidos
CREATE INDEX IF NOT EXISTS idx_store_pedidos_estatus_id ON public.store_pedidos(estatus_id);

-- store_pedidos_detalle
CREATE INDEX IF NOT EXISTS idx_store_pedidos_detalle_producto_id ON public.store_pedidos_detalle(producto_id);

-- store_pedidos_historial
CREATE INDEX IF NOT EXISTS idx_store_pedidos_historial_cambiado_por ON public.store_pedidos_historial(cambiado_por);
CREATE INDEX IF NOT EXISTS idx_store_pedidos_historial_estatus_id ON public.store_pedidos_historial(estatus_id);

-- store_pedidos_notas
CREATE INDEX IF NOT EXISTS idx_store_pedidos_notas_admin_id ON public.store_pedidos_notas(admin_id);
CREATE INDEX IF NOT EXISTS idx_store_pedidos_notas_pedido_id ON public.store_pedidos_notas(pedido_id);

-- store_productos
CREATE INDEX IF NOT EXISTS idx_store_productos_categoria_id ON public.store_productos(categoria_id);

-- tariff_packages
CREATE INDEX IF NOT EXISTS idx_tariff_packages_activated_by ON public.tariff_packages(activated_by);
CREATE INDEX IF NOT EXISTS idx_tariff_packages_created_by ON public.tariff_packages(created_by);

-- ticket_archivos
CREATE INDEX IF NOT EXISTS idx_ticket_archivos_ticket_id ON public.ticket_archivos(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_archivos_usuario_id ON public.ticket_archivos(usuario_id);

-- ticket_asignaciones
CREATE INDEX IF NOT EXISTS idx_ticket_asignaciones_asignado_por ON public.ticket_asignaciones(asignado_por);
CREATE INDEX IF NOT EXISTS idx_ticket_asignaciones_ejecutivo_id ON public.ticket_asignaciones(ejecutivo_id);

-- ticket_comentarios
CREATE INDEX IF NOT EXISTS idx_ticket_comentarios_ticket_id ON public.ticket_comentarios(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_comentarios_usuario_id ON public.ticket_comentarios(usuario_id);

-- ticket_historial
CREATE INDEX IF NOT EXISTS idx_ticket_historial_ticket_id ON public.ticket_historial(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_historial_usuario_id ON public.ticket_historial(usuario_id);

-- tickets
CREATE INDEX IF NOT EXISTS idx_tickets_agente_id ON public.tickets(agente_id);
CREATE INDEX IF NOT EXISTS idx_tickets_assigned_to_user_id ON public.tickets(assigned_to_user_id);
CREATE INDEX IF NOT EXISTS idx_tickets_cerrado_por ON public.tickets(cerrado_por);
CREATE INDEX IF NOT EXISTS idx_tickets_comisiones_documento_id ON public.tickets(comisiones_documento_id);
CREATE INDEX IF NOT EXISTS idx_tickets_comisiones_lote_id ON public.tickets(comisiones_lote_id);
CREATE INDEX IF NOT EXISTS idx_tickets_creado_por ON public.tickets(creado_por);
CREATE INDEX IF NOT EXISTS idx_tickets_estatus_id ON public.tickets(estatus_id);
CREATE INDEX IF NOT EXISTS idx_tickets_modificado_por ON public.tickets(modificado_por);
CREATE INDEX IF NOT EXISTS idx_tickets_registro_aseguradora ON public.tickets(registro_aseguradora);

-- user_roles
CREATE INDEX IF NOT EXISTS idx_user_roles_oficina_id ON public.user_roles(oficina_id);

-- user_web_page_insurers
CREATE INDEX IF NOT EXISTS idx_user_web_page_insurers_insurer_id ON public.user_web_page_insurers(insurer_id);

-- usuarios
CREATE INDEX IF NOT EXISTS idx_usuarios_deleted_by_user_id ON public.usuarios(deleted_by_user_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_production_office_id ON public.usuarios(production_office_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_regimen_fiscal_id ON public.usuarios(regimen_fiscal_id);

-- valores_campos_oficinas
CREATE INDEX IF NOT EXISTS idx_valores_campos_oficinas_campo_id ON public.valores_campos_oficinas(campo_id);

-- valores_campos_personalizados
CREATE INDEX IF NOT EXISTS idx_valores_campos_personalizados_campo_id ON public.valores_campos_personalizados(campo_id);

-- vendor_mapping_persistent
CREATE INDEX IF NOT EXISTS idx_vendor_mapping_persistent_assigned_by ON public.vendor_mapping_persistent(assigned_by);
CREATE INDEX IF NOT EXISTS idx_vendor_mapping_persistent_movi_user_id ON public.vendor_mapping_persistent(movi_user_id);

-- vendor_mapping_persistent_legacy
CREATE INDEX IF NOT EXISTS idx_vendor_mapping_legacy_assigned_by ON public.vendor_mapping_persistent_legacy(assigned_by);
CREATE INDEX IF NOT EXISTS idx_vendor_mapping_legacy_movi_user_id ON public.vendor_mapping_persistent_legacy(movi_user_id);

-- vendor_mappings
CREATE INDEX IF NOT EXISTS idx_vendor_mappings_created_by ON public.vendor_mappings(created_by);
CREATE INDEX IF NOT EXISTS idx_vendor_mappings_movi_user_id ON public.vendor_mappings(movi_user_id);
CREATE INDEX IF NOT EXISTS idx_vendor_mappings_updated_by ON public.vendor_mappings(updated_by);

-- whatsapp_configuracion
CREATE INDEX IF NOT EXISTS idx_whatsapp_configuracion_configurado_por ON public.whatsapp_configuracion(configurado_por);
