/*
  # Eliminar Índices No Usados - Parte 1

  1. Índices No Usados
    - Elimina índices que no han sido utilizados para mejorar rendimiento de escritura
    - Solo se eliminan índices claramente no usados en módulos menos críticos

  2. Notas
    - Se pueden recuperar fácilmente si son necesarios en el futuro
    - Mejora el rendimiento de INSERT/UPDATE/DELETE
*/

-- Índices de módulos de comunicación
DROP INDEX IF EXISTS idx_historial_correos_plantilla_id;
DROP INDEX IF EXISTS idx_historial_numero;
DROP INDEX IF EXISTS idx_correo_historial_tipo;

-- Índices de módulos de chat
DROP INDEX IF EXISTS idx_chats_ultimo_mensaje;
DROP INDEX IF EXISTS idx_chat_archivos_chat;
DROP INDEX IF EXISTS idx_chat_archivos_mensaje;
DROP INDEX IF EXISTS idx_meeting_chat_messages_meeting_id;

-- Índices de módulos de educación
DROP INDEX IF EXISTS idx_seguros_sessions_activa;
DROP INDEX IF EXISTS idx_seguros_categories_creado_por;
DROP INDEX IF EXISTS idx_certificados_codigo;

-- Índices de módulos de publicidad
DROP INDEX IF EXISTS idx_publicidad_plantillas_created_by;
DROP INDEX IF EXISTS idx_publicidad_plantillas_categoria;
DROP INDEX IF EXISTS idx_publicidad_plantillas_tipo;
DROP INDEX IF EXISTS idx_publicidad_plantillas_activa;
DROP INDEX IF EXISTS idx_publicidad_disenos_usuario;
DROP INDEX IF EXISTS idx_publicidad_disenos_plantilla;

-- Índices de producción y reportes
DROP INDEX IF EXISTS idx_production_import_logs_imported_by;
DROP INDEX IF EXISTS idx_production_offices_region_id;
DROP INDEX IF EXISTS idx_production_google_sheets_config_configurado_por;
DROP INDEX IF EXISTS idx_notificaciones_globales_enviado_por;

-- Índices de store
DROP INDEX IF EXISTS idx_store_carrito_producto_id;
DROP INDEX IF EXISTS idx_store_pedidos_detalle_producto_id;
DROP INDEX IF EXISTS idx_store_pedidos_historial_cambiado_por;
DROP INDEX IF EXISTS idx_store_pedidos_historial_estatus_id;
DROP INDEX IF EXISTS idx_store_pedidos_notas_admin_id;

-- Índices de configuración
DROP INDEX IF EXISTS idx_user_roles_oficina_id;
DROP INDEX IF EXISTS idx_valores_campos_oficinas_campo_id;
DROP INDEX IF EXISTS idx_whatsapp_configuracion_configurado_por;

-- Índices de contactos y CRM
DROP INDEX IF EXISTS idx_contactos_origen;
DROP INDEX IF EXISTS idx_contactos_ultima_interaccion;
DROP INDEX IF EXISTS idx_crm_tareas_creado_por;

-- Índices de notificaciones
DROP INDEX IF EXISTS idx_provider_logs_provider;
DROP INDEX IF EXISTS idx_provider_logs_success;

-- Índices varios que no se usan
DROP INDEX IF EXISTS meetings_status_idx;
DROP INDEX IF EXISTS idx_solicitudes_vacaciones_fecha_inicio;
DROP INDEX IF EXISTS idx_reservas_espacio_estado;
DROP INDEX IF EXISTS idx_commission_errors_resolved;