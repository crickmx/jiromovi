/*
  # Agregar Índices Faltantes en Foreign Keys

  1. Propósito
    - Agregar índices a todas las foreign keys que no tienen índices
    - Mejorar el rendimiento de queries y joins
    - Optimizar operaciones de eliminación en cascada

  2. Impacto
    - Mejora significativa en rendimiento de queries
    - Reduce tiempo de ejecución de joins
    - Optimiza operaciones de DELETE CASCADE

  3. Tablas Afectadas
    - Se agregan índices a ~67 foreign keys sin índice
*/

-- Índices para accesos_nacional
CREATE INDEX IF NOT EXISTS idx_accesos_nacional_ultima_edicion_por
  ON accesos_nacional(ultima_edicion_por);

-- Índices para aula_virtual
CREATE INDEX IF NOT EXISTS idx_aula_virtual_chat_destinatario_id
  ON aula_virtual_chat(destinatario_id);
CREATE INDEX IF NOT EXISTS idx_aula_virtual_chat_participante_id
  ON aula_virtual_chat(participante_id);
CREATE INDEX IF NOT EXISTS idx_aula_virtual_eventos_participante_id
  ON aula_virtual_eventos(participante_id);
CREATE INDEX IF NOT EXISTS idx_aula_virtual_sesiones_instructor_id
  ON aula_virtual_sesiones(instructor_id);

-- Índices para bloqueos_gerente
CREATE INDEX IF NOT EXISTS idx_bloqueos_gerente_oficina_id
  ON bloqueos_gerente(oficina_id);

-- Índices para chat
CREATE INDEX IF NOT EXISTS idx_chat_archivos_remitente_id
  ON chat_archivos(remitente_id);
CREATE INDEX IF NOT EXISTS idx_chat_mensajes_responde_a_id
  ON chat_mensajes(responde_a_id);
CREATE INDEX IF NOT EXISTS idx_chat_no_leidos_ultimo_mensaje_id
  ON chat_no_leidos(ultimo_mensaje_id);
CREATE INDEX IF NOT EXISTS idx_chats_creador_id
  ON chats(creador_id);

-- Índices para commissions
CREATE INDEX IF NOT EXISTS idx_commission_agents_fiscal_regime_id
  ON commission_agents(fiscal_regime_id);
CREATE INDEX IF NOT EXISTS idx_commission_agents_office_id
  ON commission_agents(office_id);
CREATE INDEX IF NOT EXISTS idx_commission_batches_uploaded_by
  ON commission_batches(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_commission_business_rules_office_id
  ON commission_business_rules(office_id);
CREATE INDEX IF NOT EXISTS idx_commission_details_adjusted_by_user_id
  ON commission_details(adjusted_by_user_id);
CREATE INDEX IF NOT EXISTS idx_commission_details_office_id
  ON commission_details(office_id);

-- Índices para configuración
CREATE INDEX IF NOT EXISTS idx_configuracion_sistema_modificado_por
  ON configuracion_sistema(modificado_por);

-- Índices para correo
CREATE INDEX IF NOT EXISTS idx_correo_canales_historial_cambiado_por
  ON correo_canales_historial(cambiado_por);
CREATE INDEX IF NOT EXISTS idx_correo_configuracion_configurado_por
  ON correo_configuracion(configurado_por);
CREATE INDEX IF NOT EXISTS idx_correo_destinatarios_predefinidos_notif
  ON correo_destinatarios_predefinidos(notificacion_id);
CREATE INDEX IF NOT EXISTS idx_correo_destinatarios_predefinidos_oficina
  ON correo_destinatarios_predefinidos(oficina_id);
CREATE INDEX IF NOT EXISTS idx_correo_destinatarios_predefinidos_usuario
  ON correo_destinatarios_predefinidos(usuario_id);
CREATE INDEX IF NOT EXISTS idx_correo_historial_envios_enviado_por
  ON correo_historial_envios(enviado_por);
CREATE INDEX IF NOT EXISTS idx_correo_historial_envios_tipo_notif
  ON correo_historial_envios(tipo_notificacion_id);
CREATE INDEX IF NOT EXISTS idx_correo_plantillas_actualizado_por
  ON correo_plantillas(actualizado_por);
CREATE INDEX IF NOT EXISTS idx_correo_plantillas_tipo_notificacion
  ON correo_plantillas(tipo_notificacion_id);

-- Índices para CRM
CREATE INDEX IF NOT EXISTS idx_crm_cotizaciones_creado_por
  ON crm_cotizaciones(creado_por);
CREATE INDEX IF NOT EXISTS idx_crm_notas_creado_por
  ON crm_notas(creado_por);
CREATE INDEX IF NOT EXISTS idx_crm_polizas_creado_por
  ON crm_polizas(creado_por);
CREATE INDEX IF NOT EXISTS idx_crm_tareas_asignado_a
  ON crm_tareas(asignado_a);
CREATE INDEX IF NOT EXISTS idx_crm_tareas_creado_por
  ON crm_tareas(creado_por);

-- Índices para documentos
CREATE INDEX IF NOT EXISTS idx_documentos_usuarios_usuario_id
  ON documentos_usuarios(usuario_id);

-- Índices para meetings
CREATE INDEX IF NOT EXISTS idx_meeting_chat_messages_meeting_id
  ON meeting_chat_messages(meeting_id);
CREATE INDEX IF NOT EXISTS idx_meeting_participants_user_id
  ON meeting_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_meetings_host_id
  ON meetings(host_id);

-- Índices para notificaciones
CREATE INDEX IF NOT EXISTS idx_notificaciones_globales_enviado_por
  ON notificaciones_globales(enviado_por);

-- Índices para plantillas
CREATE INDEX IF NOT EXISTS idx_plantillas_correo_created_by
  ON plantillas_correo(created_by);

-- Índices para production
CREATE INDEX IF NOT EXISTS idx_production_google_sheets_config_configurado_por
  ON production_google_sheets_config(configurado_por_user_id);
CREATE INDEX IF NOT EXISTS idx_production_import_logs_imported_by
  ON production_import_logs(imported_by_user_id);
CREATE INDEX IF NOT EXISTS idx_production_offices_region_id
  ON production_offices(region_id);

-- Índices para publicidad
CREATE INDEX IF NOT EXISTS idx_publicidad_plantillas_created_by
  ON publicidad_plantillas(created_by);
CREATE INDEX IF NOT EXISTS idx_publicidad_uso_estadisticas_usuario_id
  ON publicidad_uso_estadisticas(usuario_id);

-- Índices para reservas
CREATE INDEX IF NOT EXISTS idx_reservas_evaluaciones_usuario_id
  ON reservas_evaluaciones(usuario_id);

-- Índices para seguros education
CREATE INDEX IF NOT EXISTS idx_seguros_categories_creado_por
  ON seguros_categories(creado_por);
CREATE INDEX IF NOT EXISTS idx_seguros_certificados_categoria_id
  ON seguros_certificados(categoria_id);
CREATE INDEX IF NOT EXISTS idx_seguros_sessions_creado_por
  ON seguros_sessions(creado_por);

-- Índices para store
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

-- Índices para tickets
CREATE INDEX IF NOT EXISTS idx_ticket_archivos_usuario_id
  ON ticket_archivos(usuario_id);
CREATE INDEX IF NOT EXISTS idx_ticket_asignaciones_asignado_por
  ON ticket_asignaciones(asignado_por);
CREATE INDEX IF NOT EXISTS idx_ticket_comentarios_usuario_id
  ON ticket_comentarios(usuario_id);
CREATE INDEX IF NOT EXISTS idx_ticket_historial_usuario_id
  ON ticket_historial(usuario_id);
CREATE INDEX IF NOT EXISTS idx_tickets_cerrado_por
  ON tickets(cerrado_por);
CREATE INDEX IF NOT EXISTS idx_tickets_modificado_por
  ON tickets(modificado_por);

-- Índices para usuarios
CREATE INDEX IF NOT EXISTS idx_user_roles_oficina_id
  ON user_roles(oficina_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_production_office_id
  ON usuarios(production_office_id);

-- Índices para valores campos
CREATE INDEX IF NOT EXISTS idx_valores_campos_oficinas_campo_id
  ON valores_campos_oficinas(campo_id);

-- Índices para whatsapp
CREATE INDEX IF NOT EXISTS idx_whatsapp_configuracion_configurado_por
  ON whatsapp_configuracion(configurado_por);