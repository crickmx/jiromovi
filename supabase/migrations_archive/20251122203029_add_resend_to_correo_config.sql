/*
  # Agregar Resend como tipo de integración

  1. Modificaciones
    - Actualizar constraint para permitir 'resend' como tipo de integración
    - Mantener compatibilidad con 'smtp' y 'sendgrid'
  
  2. Notas
    - Resend es el servicio de email moderno compatible con Edge Functions
    - No requiere configuración SMTP (servidor, puerto, etc.)
*/

-- Eliminar constraint anterior
ALTER TABLE correo_configuracion
DROP CONSTRAINT IF EXISTS correo_configuracion_tipo_integracion_check;

-- Agregar nuevo constraint con resend
ALTER TABLE correo_configuracion
ADD CONSTRAINT correo_configuracion_tipo_integracion_check 
CHECK (tipo_integracion IN ('smtp', 'sendgrid', 'resend'));

-- Actualizar configuración existente a resend
UPDATE correo_configuracion
SET tipo_integracion = 'resend'
WHERE activo = true;

COMMENT ON COLUMN correo_configuracion.tipo_integracion IS 'Tipo de integración: smtp, sendgrid o resend';
