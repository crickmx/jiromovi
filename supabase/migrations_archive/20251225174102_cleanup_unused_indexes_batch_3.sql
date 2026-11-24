/*
  # Limpieza de Índices No Utilizados - Batch 3

  Eliminación de índices adicionales no utilizados
*/

-- Índices de commission
DROP INDEX IF EXISTS idx_commission_agents_fiscal_regime_id;
DROP INDEX IF EXISTS idx_commission_agents_office_id;
DROP INDEX IF EXISTS idx_commission_batches_converted_by;
DROP INDEX IF EXISTS idx_commission_batches_source_import_batch_id;
DROP INDEX IF EXISTS idx_commission_business_rules_office_id;
DROP INDEX IF EXISTS idx_commission_details_adjusted_by_user_id;
DROP INDEX IF EXISTS idx_commission_details_business_rule_id;
DROP INDEX IF EXISTS idx_commission_details_office_id;
DROP INDEX IF EXISTS idx_commission_import_config_created_by;
DROP INDEX IF EXISTS idx_commission_recalculations_recalculated_by;
DROP INDEX IF EXISTS idx_commission_staging_sessions_uploaded_by;
DROP INDEX IF EXISTS idx_commission_details_batch_agent;
DROP INDEX IF EXISTS idx_commission_details_ramo;
DROP INDEX IF EXISTS idx_commission_details_batch_agent_ramo;

-- Índices de configuracion sistema
DROP INDEX IF EXISTS idx_configuracion_sistema_modificado_por;

-- Índices de conversion jobs
DROP INDEX IF EXISTS idx_conversion_jobs_batch_id;
DROP INDEX IF EXISTS idx_conversion_jobs_started_by;

-- Índices de correo
DROP INDEX IF EXISTS idx_correo_canales_historial_cambiado_por;
DROP INDEX IF EXISTS idx_correo_configuracion_configurado_por;
DROP INDEX IF EXISTS idx_correo_historial_envios_enviado_por;
DROP INDEX IF EXISTS idx_correo_plantillas_actualizado_por;

-- Índices de CRM adicionales
DROP INDEX IF EXISTS idx_crm_birthday_reminders_usuario_id_fk;
DROP INDEX IF EXISTS idx_crm_cotizaciones_creado_por_fk;
DROP INDEX IF EXISTS idx_crm_notas_creado_por_fk;

-- Índices de dashboard
DROP INDEX IF EXISTS idx_dashboard_calendar_events_usuario_id_fk;

-- Índices de document import
DROP INDEX IF EXISTS idx_document_import_batches_converted_by;
DROP INDEX IF EXISTS idx_document_import_batches_imported_by;
DROP INDEX IF EXISTS idx_document_import_items_movi_user_id;

-- Índices de GMM
DROP INDEX IF EXISTS idx_gmm_quotations_editada_desde_cotizacion_id;
DROP INDEX IF EXISTS idx_gmm_quotations_usuario_id_fk;
DROP INDEX IF EXISTS idx_gmm_quotes_created_by_fk;
DROP INDEX IF EXISTS idx_gmm_quotes_tariff_package_id;

-- Índices de historial correos
DROP INDEX IF EXISTS idx_historial_correos_plantilla_id_fk;

-- Índices de imported documents
DROP INDEX IF EXISTS idx_imported_documents_batch_id_fk;
DROP INDEX IF EXISTS idx_imported_documents_movi_user_id_fk;

-- Índices de notificaciones globales
DROP INDEX IF EXISTS idx_notificaciones_globales_enviado_por;

-- Índices de notification delivery
DROP INDEX IF EXISTS idx_notification_delivery_attempts_job_id;

-- Índices de tariff packages
DROP INDEX IF EXISTS idx_tariff_packages_activated_by;
DROP INDEX IF EXISTS idx_tariff_packages_created_by;

-- Más índices de commission (faltantes)
DROP INDEX IF EXISTS idx_commission_details_nombre_asegurado;
