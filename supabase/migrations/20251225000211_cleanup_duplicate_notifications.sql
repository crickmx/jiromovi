/*
  # Limpieza de notificaciones duplicadas e innecesarias
  
  1. Cambios
    - Desactivar "bienvenida" - NO se usa, el correo se envía al activar la cuenta
    - Desactivar "commission_batch_closed" - DUPLICADO con transactional template
    - Actualizar descripción de "cuenta_activada" para clarificar
  
  2. Razón
    - Eliminar duplicación entre sistemas
    - Solo usar transactional_notification_templates para comisiones
    - Solo usar cuenta_activada (no bienvenida) para nuevos usuarios
*/

-- Desactivar notificación de bienvenida (NO se usa, se envía cuenta_activada al aprobar)
UPDATE correo_tipos_notificacion
SET 
  activo = false,
  descripcion = '❌ NO USAR - Obsoleto. Se envía "cuenta_activada" cuando se aprueba un usuario',
  updated_at = now()
WHERE codigo = 'bienvenida';

-- Desactivar commission_batch_closed (DUPLICADO con transactional template)
UPDATE correo_tipos_notificacion
SET 
  activo = false,
  descripcion = '❌ NO USAR - Duplicado. Se usa transactional_notification_templates: commission_batch_closed_agent',
  updated_at = now()
WHERE codigo = 'commission_batch_closed';

-- Actualizar descripción de cuenta_activada para clarificar
UPDATE correo_tipos_notificacion
SET 
  descripcion = '✅ Enviado automáticamente cuando un administrador aprueba y activa una cuenta de usuario pendiente',
  updated_at = now()
WHERE codigo = 'cuenta_activada';

-- Comentario en la tabla para futuras referencias
COMMENT ON TABLE correo_tipos_notificacion IS 'Notificaciones programadas/manuales. Para notificaciones automáticas de eventos del sistema (comisiones, leads web), usar transactional_notification_templates';
COMMENT ON TABLE transactional_notification_templates IS 'Plantillas para notificaciones automáticas de eventos del sistema (comisiones cerradas, leads web, etc). Gestionadas por código, no por UI.';
