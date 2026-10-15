/*
  # Agregar columnas de seguimiento de email a usuarios

  ## Descripción
  Agrega columnas para rastrear el estado de verificación y errores
  en la configuración de correo de cada usuario.

  ## Cambios
  - Agrega `email_ultima_verificacion` (timestamptz)
  - Agrega `email_error_mensaje` (text)

  ## Seguridad
  - Se mantienen las políticas RLS existentes
*/

-- Agregar columnas de seguimiento
ALTER TABLE usuarios 
ADD COLUMN IF NOT EXISTS email_ultima_verificacion timestamptz,
ADD COLUMN IF NOT EXISTS email_error_mensaje text;

COMMENT ON COLUMN usuarios.email_ultima_verificacion IS 'Última vez que se verificó la conexión de correo';
COMMENT ON COLUMN usuarios.email_error_mensaje IS 'Mensaje de error si la verificación falló';
