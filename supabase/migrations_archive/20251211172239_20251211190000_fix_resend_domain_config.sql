/*
  # Corregir configuración de Resend

  1. Cambios
    - Actualizar configuración de correo para usar dominio verificado de Resend
    - Cambiar a onboarding@resend.dev (dominio verificado por defecto de Resend)
    - Actualizar tipo de integración a 'resend'
  
  2. Notas
    - onboarding@resend.dev es un dominio verificado proporcionado por Resend
    - Funciona inmediatamente sin necesidad de configuración DNS
    - Los usuarios pueden verificar su propio dominio más tarde en https://resend.com/domains
*/

-- Actualizar la configuración de correo activa para usar el dominio verificado de Resend
UPDATE correo_configuracion
SET 
  tipo_integracion = 'resend',
  remitente_email = 'onboarding@resend.dev',
  remitente_nombre = 'MOVI Digital',
  dominio_verificado = 'resend.dev',
  resend_api_key = 're_hdUhQ6MB_BEiDto4R5NKZDwsaxvWMLeeW',
  servidor = NULL,
  puerto = NULL,
  usuario = NULL,
  password_encriptado = NULL,
  seguridad = NULL,
  api_key_encriptada = NULL,
  updated_at = now()
WHERE activo = true;

-- Si no existe una configuración activa, crear una
INSERT INTO correo_configuracion (
  tipo_integracion,
  remitente_email,
  remitente_nombre,
  dominio_verificado,
  resend_api_key,
  activo
)
SELECT 
  'resend',
  'onboarding@resend.dev',
  'MOVI Digital',
  'resend.dev',
  're_hdUhQ6MB_BEiDto4R5NKZDwsaxvWMLeeW',
  true
WHERE NOT EXISTS (
  SELECT 1 FROM correo_configuracion WHERE activo = true
);
