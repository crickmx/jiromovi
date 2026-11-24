/*
  # Agregar tipos de notificación transaccionales
  
  1. Nuevos tipos
    - correo_transaccional: Correos transaccionales con plantillas (enviar-correo-transaccional)
    - whatsapp_transaccional: WhatsApp transaccional con plantillas (enviar-whatsapp)
  
  2. Propósito
    Completar el registro de TODOS los envíos transaccionales que usan plantillas.
*/

-- Agregar tipos de notificación transaccionales
INSERT INTO correo_tipos_notificacion (
  codigo,
  nombre,
  descripcion,
  activo,
  enviar_correo,
  enviar_whatsapp,
  enviar_notificacion,
  es_personalizada,
  permite_destinatarios_custom
)
VALUES
  (
    'correo_transaccional',
    'Correo Transaccional con Plantilla',
    'Envío de correo usando plantillas del sistema. Usado por enviar-correo-transaccional Edge Function.',
    true,
    true,
    false,
    false,
    false,
    false
  ),
  (
    'whatsapp_transaccional',
    'WhatsApp Transaccional con Plantilla',
    'Envío de WhatsApp usando plantillas del sistema. Usado por enviar-whatsapp Edge Function.',
    true,
    false,
    true,
    false,
    false,
    false
  )
ON CONFLICT (codigo) DO UPDATE SET
  nombre = EXCLUDED.nombre,
  descripcion = EXCLUDED.descripcion,
  activo = EXCLUDED.activo;

-- Documentar el sistema completo de registro de envíos
COMMENT ON TABLE correo_historial_envios IS 
'📊 HISTORIAL COMPLETO DE ENVÍOS DE NOTIFICACIONES

🎯 Esta tabla registra TODOS los envíos de notificaciones sin excepción:

✅ AUTOMÁTICAS (triggers en base de datos):
  - cuenta_activada: Al activar usuario
  - commission_batch_closed: Al cerrar lote de comisiones
  - nuevo_comunicado: Al publicar comunicado
  - cumpleanos_contacto: Recordatorios de cumpleaños
  - reserva_espacio: Confirmaciones de reservas
  Y TODAS las demás notificaciones automáticas del sistema

✅ MANUALES (enviadas por usuarios):
  - notificacion_personalizada: Admin envía a usuarios específicos
  - notificacion_global: Admin envía a todos
  - notificacion_individual: Notificaciones personalizadas

✅ DEPARTAMENTALES (enviadas a equipos):
  - vacaciones_aprobadas: RRHH
  - solicitud_compra_store: Mercadotecnia
  - nuevo_tramite: Mesa de Control
  - solicitud_correccion_comisiones: Mesa de Control

✅ SISTEMA (envíos directos sin plantilla):
  - email_directo: send-direct-email
  - whatsapp_directo: send-direct-whatsapp
  - notificacion_interna: send-internal-notification

✅ TRANSACCIONALES (con plantillas):
  - correo_transaccional: enviar-correo-transaccional
  - whatsapp_transaccional: enviar-whatsapp

📝 Cada registro incluye:
  - Canal usado (correo, whatsapp, notificacion)
  - Estado (enviado, fallido, pendiente)
  - Destinatario (usuario_id, email, teléfono)
  - Contenido enviado (asunto, cuerpo_html)
  - Errores si los hubo
  - Respuesta del proveedor (Resend, Wazzup24)
  - Timestamp de envío

🔍 Consultas útiles:
  - Vista completa: SELECT * FROM vista_historial_envios_completo
  - Estadísticas: SELECT * FROM obtener_estadisticas_envios()
  - Por usuario: WHERE usuario_id = ''uuid''
  - Por canal: WHERE canal_envio = ''correo''
  - Por estado: WHERE estado = ''fallido''
';

-- Verificar que todos los tipos críticos existen
DO $$
DECLARE
  v_tipos_criticos text[] := ARRAY[
    'email_directo',
    'whatsapp_directo',
    'notificacion_interna',
    'correo_transaccional',
    'whatsapp_transaccional',
    'cuenta_activada',
    'nuevo_comunicado',
    'commission_batch_closed'
  ];
  v_tipo text;
  v_count integer;
BEGIN
  FOREACH v_tipo IN ARRAY v_tipos_criticos
  LOOP
    SELECT COUNT(*) INTO v_count
    FROM correo_tipos_notificacion
    WHERE codigo = v_tipo AND activo = true;
    
    IF v_count = 0 THEN
      RAISE WARNING 'ADVERTENCIA: Tipo de notificación crítico no encontrado o inactivo: %', v_tipo;
    ELSE
      RAISE NOTICE '✅ Tipo de notificación configurado: %', v_tipo;
    END IF;
  END LOOP;
  
  RAISE NOTICE '===========================================';
  RAISE NOTICE '✅ Sistema de registro de envíos completo';
  RAISE NOTICE '===========================================';
END $$;