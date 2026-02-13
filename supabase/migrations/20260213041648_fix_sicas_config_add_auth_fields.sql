/*
  # Agregar campos de autenticación a sicas_config

  ## Cambios
  - Agregar campos para credenciales SICAS
    - `sicas_usuario` - Usuario para autenticación SOAP
    - `sicas_password` - Contraseña para autenticación SOAP
    - `sicas_namespace` - Namespace del servicio SOAP
  
  ## Notas
  - Los campos de contraseña se almacenan en la base de datos
  - Se recomienda usar secretos de Supabase en producción
  - Se agrega un alias `sicas_url` apuntando al campo `endpoint` existente
*/

-- Agregar campos de autenticación SOAP
ALTER TABLE sicas_config
ADD COLUMN IF NOT EXISTS sicas_usuario text,
ADD COLUMN IF NOT EXISTS sicas_password text,
ADD COLUMN IF NOT EXISTS sicas_namespace text DEFAULT 'http://www.sicasonline.com.mx/';

-- Crear vista con alias para compatibilidad
CREATE OR REPLACE VIEW sicas_config_view AS
SELECT 
  id,
  endpoint AS sicas_url,
  endpoint,
  sicas_usuario,
  sicas_password,
  sicas_namespace,
  last_test_at,
  last_test_success,
  last_test_message,
  last_sync_despachos_at,
  last_sync_vendedores_at,
  sync_logs,
  created_at,
  updated_at
FROM sicas_config;

COMMENT ON TABLE sicas_config IS 'Configuración de conexión SICAS con credenciales SOAP';
COMMENT ON COLUMN sicas_config.sicas_usuario IS 'Usuario para autenticación SOAP de SICAS';
COMMENT ON COLUMN sicas_config.sicas_password IS 'Contraseña para autenticación SOAP de SICAS';
COMMENT ON COLUMN sicas_config.sicas_namespace IS 'Namespace del servicio SOAP de SICAS';
