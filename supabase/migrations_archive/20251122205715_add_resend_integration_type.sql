/*
  # Agregar Resend como tipo de integración

  1. Cambios
    - Actualizar tipo_integracion para soportar 'resend' además de 'smtp' y 'sendgrid'
    - Agregar columna resend_api_key para almacenar la API key de Resend
    - Agregar dominio_verificado para tracking de dominios en Resend
  
  2. Notas
    - Resend es el proveedor de email recomendado
    - Compatible con la API actual
    - No requiere configuración SMTP compleja
*/

-- Actualizar el check constraint para tipo_integracion
DO $$ 
BEGIN
  -- Eliminar constraint existente si existe
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'correo_configuracion_tipo_integracion_check'
    AND table_name = 'correo_configuracion'
  ) THEN
    ALTER TABLE correo_configuracion 
    DROP CONSTRAINT correo_configuracion_tipo_integracion_check;
  END IF;
  
  -- Agregar nuevo constraint con resend incluido
  ALTER TABLE correo_configuracion 
  ADD CONSTRAINT correo_configuracion_tipo_integracion_check 
  CHECK (tipo_integracion IN ('smtp', 'sendgrid', 'resend'));
END $$;

-- Agregar columnas para Resend si no existen
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'correo_configuracion' 
    AND column_name = 'resend_api_key'
  ) THEN
    ALTER TABLE correo_configuracion 
    ADD COLUMN resend_api_key text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'correo_configuracion' 
    AND column_name = 'dominio_verificado'
  ) THEN
    ALTER TABLE correo_configuracion 
    ADD COLUMN dominio_verificado text;
  END IF;
END $$;

-- Crear índice para búsquedas por tipo de integración
CREATE INDEX IF NOT EXISTS idx_correo_config_tipo 
ON correo_configuracion(tipo_integracion) 
WHERE activo = true;

-- Insertar configuración por defecto de Resend si no existe
INSERT INTO correo_configuracion (
  tipo_integracion,
  remitente_nombre,
  remitente_email,
  resend_api_key,
  activo,
  fecha_configuracion
)
SELECT 
  'resend',
  'MOVI Digital',
  'notificaciones@movi.digital',
  're_hdUhQ6MB_BEiDto4R5NKZDwsaxvWMLeeW',
  true,
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM correo_configuracion 
  WHERE tipo_integracion = 'resend'
);
