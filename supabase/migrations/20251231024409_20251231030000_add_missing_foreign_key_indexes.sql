/*
  # Add Missing Foreign Key Indexes (Part 1)
  
  1. Performance Improvements
    - Adds covering indexes for all foreign keys that were missing them
    - Improves JOIN performance and foreign key constraint checking
    - Reduces query execution time for related table lookups
  
  2. Changes
    - Creates indexes for approximately 170+ foreign key columns across all tables
    - Uses btree indexes (default) for optimal foreign key performance
    - Index names follow pattern: idx_{table}_{column}
*/

-- accesos_nacional
CREATE INDEX IF NOT EXISTS idx_accesos_nacional_creado_por ON public.accesos_nacional(creado_por);
CREATE INDEX IF NOT EXISTS idx_accesos_nacional_ultima_edicion_por ON public.accesos_nacional(ultima_edicion_por);

-- adjuntos_correo
CREATE INDEX IF NOT EXISTS idx_adjuntos_correo_correo_id ON public.adjuntos_correo(correo_id);

-- agent_mapping_audit
CREATE INDEX IF NOT EXISTS idx_agent_mapping_audit_changed_by ON public.agent_mapping_audit(changed_by);

-- agent_user_mappings
CREATE INDEX IF NOT EXISTS idx_agent_user_mappings_created_by ON public.agent_user_mappings(created_by);
CREATE INDEX IF NOT EXISTS idx_agent_user_mappings_matched_user_id ON public.agent_user_mappings(matched_user_id);
CREATE INDEX IF NOT EXISTS idx_agent_user_mappings_updated_by ON public.agent_user_mappings(updated_by);

-- areas
CREATE INDEX IF NOT EXISTS idx_areas_oficina_id ON public.areas(oficina_id);

-- assistant_action_clicks
CREATE INDEX IF NOT EXISTS idx_assistant_action_clicks_usuario_id ON public.assistant_action_clicks(usuario_id);

-- assistant_attachments
CREATE INDEX IF NOT EXISTS idx_assistant_attachments_mensaje_id ON public.assistant_attachments(mensaje_id);
CREATE INDEX IF NOT EXISTS idx_assistant_attachments_uploaded_by ON public.assistant_attachments(uploaded_by);

-- assistant_routing_logs
CREATE INDEX IF NOT EXISTS idx_assistant_routing_logs_user_id ON public.assistant_routing_logs(user_id);

-- assistant_snapshots
CREATE INDEX IF NOT EXISTS idx_assistant_snapshots_usuario_id ON public.assistant_snapshots(usuario_id);

-- audit_logs
CREATE INDEX IF NOT EXISTS idx_audit_logs_performed_by ON public.audit_logs(performed_by);
CREATE INDEX IF NOT EXISTS idx_audit_logs_target_user_id ON public.audit_logs(target_user_id);

-- auditoria_logs
CREATE INDEX IF NOT EXISTS idx_auditoria_logs_usuario_id ON public.auditoria_logs(usuario_id);

-- aula_eventos
CREATE INDEX IF NOT EXISTS idx_aula_eventos_creado_por ON public.aula_eventos(creado_por);

-- aula_eventos_permisos
CREATE INDEX IF NOT EXISTS idx_aula_eventos_permisos_oficina_id ON public.aula_eventos_permisos(oficina_id);
CREATE INDEX IF NOT EXISTS idx_aula_eventos_permisos_usuario_id ON public.aula_eventos_permisos(usuario_id);

-- aula_virtual_chat
CREATE INDEX IF NOT EXISTS idx_aula_virtual_chat_destinatario_id ON public.aula_virtual_chat(destinatario_id);
CREATE INDEX IF NOT EXISTS idx_aula_virtual_chat_participante_id ON public.aula_virtual_chat(participante_id);
CREATE INDEX IF NOT EXISTS idx_aula_virtual_chat_sesion_id ON public.aula_virtual_chat(sesion_id);

-- aula_virtual_eventos
CREATE INDEX IF NOT EXISTS idx_aula_virtual_eventos_participante_id ON public.aula_virtual_eventos(participante_id);
CREATE INDEX IF NOT EXISTS idx_aula_virtual_eventos_sesion_id ON public.aula_virtual_eventos(sesion_id);

-- aula_virtual_grabaciones
CREATE INDEX IF NOT EXISTS idx_aula_virtual_grabaciones_sesion_id ON public.aula_virtual_grabaciones(sesion_id);

-- aula_virtual_participantes
CREATE INDEX IF NOT EXISTS idx_aula_virtual_participantes_sesion_id ON public.aula_virtual_participantes(sesion_id);
CREATE INDEX IF NOT EXISTS idx_aula_virtual_participantes_usuario_id ON public.aula_virtual_participantes(usuario_id);

-- aula_virtual_sesiones
CREATE INDEX IF NOT EXISTS idx_aula_virtual_sesiones_instructor_id ON public.aula_virtual_sesiones(instructor_id);

-- bloqueos_gerente
CREATE INDEX IF NOT EXISTS idx_bloqueos_gerente_gerente_id ON public.bloqueos_gerente(gerente_id);
CREATE INDEX IF NOT EXISTS idx_bloqueos_gerente_oficina_id ON public.bloqueos_gerente(oficina_id);

-- borradores_correo
CREATE INDEX IF NOT EXISTS idx_borradores_correo_usuario_id ON public.borradores_correo(usuario_id);

-- chat_archivos
CREATE INDEX IF NOT EXISTS idx_chat_archivos_chat_id ON public.chat_archivos(chat_id);
CREATE INDEX IF NOT EXISTS idx_chat_archivos_mensaje_id ON public.chat_archivos(mensaje_id);
CREATE INDEX IF NOT EXISTS idx_chat_archivos_remitente_id ON public.chat_archivos(remitente_id);

-- chat_mensajes
CREATE INDEX IF NOT EXISTS idx_chat_mensajes_remitente_id ON public.chat_mensajes(remitente_id);
CREATE INDEX IF NOT EXISTS idx_chat_mensajes_responde_a_id ON public.chat_mensajes(responde_a_id);

-- chat_miembros
CREATE INDEX IF NOT EXISTS idx_chat_miembros_usuario_id ON public.chat_miembros(usuario_id);

-- chat_no_leidos
CREATE INDEX IF NOT EXISTS idx_chat_no_leidos_ultimo_mensaje_id ON public.chat_no_leidos(ultimo_mensaje_id);
CREATE INDEX IF NOT EXISTS idx_chat_no_leidos_usuario_id ON public.chat_no_leidos(usuario_id);

-- chats
CREATE INDEX IF NOT EXISTS idx_chats_creador_id ON public.chats(creador_id);

-- commission_agents
CREATE INDEX IF NOT EXISTS idx_commission_agents_fiscal_regime_id ON public.commission_agents(fiscal_regime_id);
CREATE INDEX IF NOT EXISTS idx_commission_agents_office_id ON public.commission_agents(office_id);

-- commission_batches
CREATE INDEX IF NOT EXISTS idx_commission_batches_converted_by ON public.commission_batches(converted_by);
CREATE INDEX IF NOT EXISTS idx_commission_batches_source_import_batch_id ON public.commission_batches(source_import_batch_id);

-- commission_business_rules
CREATE INDEX IF NOT EXISTS idx_commission_business_rules_office_id ON public.commission_business_rules(office_id);

-- commission_details
CREATE INDEX IF NOT EXISTS idx_commission_details_adjusted_by_user_id ON public.commission_details(adjusted_by_user_id);
CREATE INDEX IF NOT EXISTS idx_commission_details_business_rule_id ON public.commission_details(business_rule_id);
CREATE INDEX IF NOT EXISTS idx_commission_details_office_id ON public.commission_details(office_id);

-- commission_import_config
CREATE INDEX IF NOT EXISTS idx_commission_import_config_created_by ON public.commission_import_config(created_by);

-- commission_recalculations
CREATE INDEX IF NOT EXISTS idx_commission_recalculations_recalculated_by ON public.commission_recalculations(recalculated_by);

-- commission_staging_sessions
CREATE INDEX IF NOT EXISTS idx_commission_staging_sessions_uploaded_by ON public.commission_staging_sessions(uploaded_by);

-- comunicados_publicaciones
CREATE INDEX IF NOT EXISTS idx_comunicados_publicaciones_categoria_id ON public.comunicados_publicaciones(categoria_id);
CREATE INDEX IF NOT EXISTS idx_comunicados_publicaciones_creado_por ON public.comunicados_publicaciones(creado_por);
CREATE INDEX IF NOT EXISTS idx_comunicados_publicaciones_oficina_origen_id ON public.comunicados_publicaciones(oficina_origen_id);

-- comunicados_visibilidad
CREATE INDEX IF NOT EXISTS idx_comunicados_visibilidad_oficina_id ON public.comunicados_visibilidad(oficina_id);
CREATE INDEX IF NOT EXISTS idx_comunicados_visibilidad_usuario_id ON public.comunicados_visibilidad(usuario_id);

-- configuracion_sistema
CREATE INDEX IF NOT EXISTS idx_configuracion_sistema_modificado_por ON public.configuracion_sistema(modificado_por);

-- contactos
CREATE INDEX IF NOT EXISTS idx_contactos_asignado_a ON public.contactos(asignado_a);

-- conversion_jobs
CREATE INDEX IF NOT EXISTS idx_conversion_jobs_batch_id ON public.conversion_jobs(batch_id);
CREATE INDEX IF NOT EXISTS idx_conversion_jobs_started_by ON public.conversion_jobs(started_by);

-- correo_canales_historial
CREATE INDEX IF NOT EXISTS idx_correo_canales_historial_cambiado_por ON public.correo_canales_historial(cambiado_por);
CREATE INDEX IF NOT EXISTS idx_correo_canales_historial_tipo_notif_id ON public.correo_canales_historial(tipo_notificacion_id);

-- correo_configuracion
CREATE INDEX IF NOT EXISTS idx_correo_configuracion_configurado_por ON public.correo_configuracion(configurado_por);

-- correo_destinatarios_predefinidos
CREATE INDEX IF NOT EXISTS idx_correo_dest_predefinidos_oficina_id ON public.correo_destinatarios_predefinidos(oficina_id);
CREATE INDEX IF NOT EXISTS idx_correo_dest_predefinidos_usuario_id ON public.correo_destinatarios_predefinidos(usuario_id);

-- correo_historial_envios
CREATE INDEX IF NOT EXISTS idx_correo_historial_envios_enviado_por ON public.correo_historial_envios(enviado_por);
CREATE INDEX IF NOT EXISTS idx_correo_historial_envios_usuario_id ON public.correo_historial_envios(usuario_id);

-- correo_plantillas
CREATE INDEX IF NOT EXISTS idx_correo_plantillas_actualizado_por ON public.correo_plantillas(actualizado_por);

-- correos_usuario
CREATE INDEX IF NOT EXISTS idx_correos_usuario_carpeta_id ON public.correos_usuario(carpeta_id);

-- crm_birthday_reminders
CREATE INDEX IF NOT EXISTS idx_crm_birthday_reminders_usuario_id ON public.crm_birthday_reminders(usuario_id);

-- crm_cotizaciones
CREATE INDEX IF NOT EXISTS idx_crm_cotizaciones_contacto_id ON public.crm_cotizaciones(contacto_id);
CREATE INDEX IF NOT EXISTS idx_crm_cotizaciones_creado_por ON public.crm_cotizaciones(creado_por);

-- crm_notas
CREATE INDEX IF NOT EXISTS idx_crm_notas_creado_por ON public.crm_notas(creado_por);

-- crm_tareas
CREATE INDEX IF NOT EXISTS idx_crm_tareas_creado_por ON public.crm_tareas(creado_por);

-- dashboard_calendar_events
CREATE INDEX IF NOT EXISTS idx_dashboard_calendar_events_usuario_id ON public.dashboard_calendar_events(usuario_id);
