/*
  # Limpieza de Índices No Utilizados - Batch 1

  Eliminación de índices que nunca se han usado para:
  - Mejorar rendimiento de INSERT/UPDATE
  - Reducir espacio en disco
  - Simplificar mantenimiento
*/

-- Índices relacionados con adjuntos y áreas
DROP INDEX IF EXISTS idx_adjuntos_correo_correo_id;
DROP INDEX IF EXISTS idx_areas_oficina_id;

-- Índices de auditoría
DROP INDEX IF EXISTS idx_auditoria_logs_usuario_id;
DROP INDEX IF EXISTS idx_aula_eventos_creado_por;
DROP INDEX IF EXISTS idx_aula_eventos_permisos_oficina_id;
DROP INDEX IF EXISTS idx_aula_eventos_permisos_usuario_id;

-- Índices de CRM
DROP INDEX IF EXISTS idx_crm_contactos_email;
DROP INDEX IF EXISTS idx_crm_contactos_celular;
DROP INDEX IF EXISTS idx_crm_contactos_creado_por_email;
DROP INDEX IF EXISTS idx_crm_contactos_creado_por_celular;
DROP INDEX IF EXISTS idx_crm_tareas_creado_por_fecha;
DROP INDEX IF EXISTS idx_crm_tareas_estatus_prioridad;
DROP INDEX IF EXISTS idx_crm_cotizaciones_contacto_id;
DROP INDEX IF EXISTS idx_crm_tareas_creado_por;

-- Índices de aula virtual
DROP INDEX IF EXISTS idx_aula_virtual_chat_sesion_id;
DROP INDEX IF EXISTS idx_aula_virtual_eventos_sesion_id;
DROP INDEX IF EXISTS idx_aula_virtual_grabaciones_sesion_id;
DROP INDEX IF EXISTS idx_aula_virtual_participantes_sesion_id;
DROP INDEX IF EXISTS idx_aula_virtual_participantes_usuario_id;
DROP INDEX IF EXISTS idx_aula_virtual_chat_destinatario_id;
DROP INDEX IF EXISTS idx_aula_virtual_chat_participante_id;
DROP INDEX IF EXISTS idx_aula_virtual_eventos_participante_id;
DROP INDEX IF EXISTS idx_aula_virtual_sesiones_instructor_id;

-- Índices de bloqueos gerente
DROP INDEX IF EXISTS idx_bloqueos_gerente_gerente_id;
DROP INDEX IF EXISTS idx_bloqueos_gerente_oficina_id;

-- Índices de borradores y chat
DROP INDEX IF EXISTS idx_borradores_correo_usuario_id;
DROP INDEX IF EXISTS idx_chat_mensajes_remitente_id;
DROP INDEX IF EXISTS idx_chat_miembros_usuario_id;
DROP INDEX IF EXISTS idx_chat_archivos_chat_id;
DROP INDEX IF EXISTS idx_chat_archivos_mensaje_id;
DROP INDEX IF EXISTS idx_chat_archivos_remitente_id;
DROP INDEX IF EXISTS idx_chat_mensajes_responde_a_id;
DROP INDEX IF EXISTS idx_chat_no_leidos_ultimo_mensaje_id;
DROP INDEX IF EXISTS idx_chat_no_leidos_usuario_id_fk;
DROP INDEX IF EXISTS idx_chats_creador_id;

-- Índices de comunicados
DROP INDEX IF EXISTS idx_comunicados_publicaciones_categoria_id;
DROP INDEX IF EXISTS idx_comunicados_publicaciones_creado_por;
DROP INDEX IF EXISTS idx_comunicados_publicaciones_oficina_origen_id;
DROP INDEX IF EXISTS idx_comunicados_visibilidad_oficina_id;
DROP INDEX IF EXISTS idx_comunicados_visibilidad_usuario_id;

-- Índices de contactos y correos
DROP INDEX IF EXISTS idx_contactos_asignado_a;
DROP INDEX IF EXISTS idx_correo_canales_historial_tipo_notificacion_id;
DROP INDEX IF EXISTS idx_correo_destinatarios_predefinidos_oficina_id;
DROP INDEX IF EXISTS idx_correo_destinatarios_predefinidos_usuario_id;
DROP INDEX IF EXISTS idx_correo_historial_envios_usuario_id;
DROP INDEX IF EXISTS idx_correos_usuario_carpeta_id;

-- Índices de documentos
DROP INDEX IF EXISTS idx_documentos_usuarios_usuario_id;
DROP INDEX IF EXISTS idx_expediente_usuario_subido_por;

-- Índices de firma
DROP INDEX IF EXISTS idx_firma_asignaciones_ref_oficina_id;
DROP INDEX IF EXISTS idx_firma_asignaciones_ref_usuario_id;
DROP INDEX IF EXISTS idx_firma_asignaciones_template_id;

-- Índices de historial correos
DROP INDEX IF EXISTS idx_historial_correos_destinatario_id;
DROP INDEX IF EXISTS idx_historial_correos_enviado_por_id;

-- Índices de meetings
DROP INDEX IF EXISTS idx_meeting_chat_messages_remitente_id;
DROP INDEX IF EXISTS idx_meeting_participants_user_id_fk;
DROP INDEX IF EXISTS idx_meetings_host_id;
DROP INDEX IF EXISTS idx_meeting_chat_messages_meeting_id;
DROP INDEX IF EXISTS idx_meeting_participants_user_id_fk2;

-- Índices de notificaciones
DROP INDEX IF EXISTS idx_notification_jobs_user_id;
DROP INDEX IF EXISTS idx_notification_provider_logs_job_id;

-- Índices de plantillas correo
DROP INDEX IF EXISTS idx_plantillas_correo_created_by;
