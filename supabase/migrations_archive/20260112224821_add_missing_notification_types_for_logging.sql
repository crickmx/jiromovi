/*
  # Agregar tipos de notificación faltantes para registro completo
  
  1. Nuevos tipos
    - email_directo: Envíos de email directos (send-direct-email)
    - whatsapp_directo: Envíos de WhatsApp directos (send-direct-whatsapp)
    - notificacion_interna: Notificaciones internas (send-internal-notification)
  
  2. Propósito
    Asegurar que TODOS los envíos tengan un tipo de notificación válido
    para poder registrarse en el historial correctamente.
*/

-- Agregar tipos de notificación para envíos directos
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
    'email_directo',
    'Email Directo (Sistema)',
    'Envío directo de email sin plantilla. Usado por Edge Functions para envíos manuales o de sistema.',
    true,
    true,
    false,
    false,
    false,
    false
  ),
  (
    'whatsapp_directo',
    'WhatsApp Directo (Sistema)',
    'Envío directo de WhatsApp sin plantilla. Usado por Edge Functions para envíos manuales o de sistema.',
    true,
    false,
    true,
    false,
    false,
    false
  ),
  (
    'notificacion_interna',
    'Notificación Interna (Sistema)',
    'Notificación enviada al equipo interno de administradores. Para alertas de gestión y operaciones.',
    true,
    true,
    false,
    false,
    false,
    false
  )
ON CONFLICT (codigo) DO UPDATE SET
  nombre = EXCLUDED.nombre,
  descripcion = EXCLUDED.descripcion,
  activo = EXCLUDED.activo;

-- Verificar todos los tipos de notificación activos
DO $$
DECLARE
  v_count integer;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM correo_tipos_notificacion
  WHERE activo = true;
  
  RAISE NOTICE '✅ Total de tipos de notificación activos: %', v_count;
  
  -- Verificar que existen los tipos críticos para logging
  IF NOT EXISTS (SELECT 1 FROM correo_tipos_notificacion WHERE codigo = 'email_directo') THEN
    RAISE EXCEPTION 'ERROR: Tipo email_directo no existe';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM correo_tipos_notificacion WHERE codigo = 'whatsapp_directo') THEN
    RAISE EXCEPTION 'ERROR: Tipo whatsapp_directo no existe';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM correo_tipos_notificacion WHERE codigo = 'notificacion_interna') THEN
    RAISE EXCEPTION 'ERROR: Tipo notificacion_interna no existe';
  END IF;
  
  RAISE NOTICE '✅ Todos los tipos críticos de logging están configurados correctamente';
END $$;

-- Documentación
COMMENT ON COLUMN correo_tipos_notificacion.codigo IS 
'Código único del tipo de notificación.
Códigos de sistema (usados por Edge Functions):
- email_directo: send-direct-email
- whatsapp_directo: send-direct-whatsapp  
- notificacion_interna: send-internal-notification
- cuenta_activada: triggers de activación
- nuevo_comunicado: triggers de comunicados
- commission_batch_closed: triggers de comisiones
Etc...';