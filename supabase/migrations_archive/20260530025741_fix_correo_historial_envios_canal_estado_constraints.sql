/*
  # Fix correo_historial_envios canal_envio and estado constraints

  ## Problem
  The check constraints on canal_envio and estado were too restrictive,
  blocking inserts from modern edge functions that use values like:
  - canal_envio: 'email', 'notificacion' (in addition to 'correo', 'whatsapp', 'ambos')
  - estado: 'error', 'no_config' (in addition to 'pendiente', 'enviado', 'fallido')

  ## Changes
  - Expand canal_envio constraint to include 'email' and 'notificacion'
  - Expand estado constraint to include 'error' and 'no_config'
*/

-- Drop old restrictive constraints
ALTER TABLE correo_historial_envios
  DROP CONSTRAINT IF EXISTS correo_historial_envios_canal_envio_check;

ALTER TABLE correo_historial_envios
  DROP CONSTRAINT IF EXISTS correo_historial_envios_estado_check;

-- Add expanded constraints
ALTER TABLE correo_historial_envios
  ADD CONSTRAINT correo_historial_envios_canal_envio_check
  CHECK (canal_envio = ANY (ARRAY[
    'correo'::text,
    'email'::text,
    'whatsapp'::text,
    'ambos'::text,
    'notificacion'::text,
    'sms'::text
  ]));

ALTER TABLE correo_historial_envios
  ADD CONSTRAINT correo_historial_envios_estado_check
  CHECK (estado = ANY (ARRAY[
    'pendiente'::text,
    'enviado'::text,
    'fallido'::text,
    'error'::text,
    'no_config'::text
  ]));
