/*
  # Actualización para IONOS - Configuración simplificada

  1. Cambios en email_configuraciones
    - Valores por defecto de IONOS preconfigurados
    - Campos simplificados para usuarios
    - Solo email y password requeridos por usuario
    
  2. Nueva tabla email_config_global
    - Configuración global de servidores IONOS
    - Editable solo por administradores
    - Valores por defecto para todos los usuarios

  3. Actualización de usuarios table
    - Agregar campos de correo al perfil
    - email_cuenta y email_password para IONOS
*/

-- Tabla de configuración global (IONOS por defecto)
CREATE TABLE IF NOT EXISTS email_config_global (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Servidores IONOS preconfigurados
  servidor_imap text DEFAULT 'imap.ionos.mx' NOT NULL,
  puerto_imap integer DEFAULT 993 NOT NULL,
  ssl_imap boolean DEFAULT true NOT NULL,
  
  servidor_pop3 text DEFAULT 'pop.ionos.mx' NOT NULL,
  puerto_pop3 integer DEFAULT 995 NOT NULL,
  ssl_pop3 boolean DEFAULT true NOT NULL,
  
  servidor_smtp text DEFAULT 'smtp.ionos.mx' NOT NULL,
  puerto_smtp integer DEFAULT 465 NOT NULL,
  ssl_smtp boolean DEFAULT true NOT NULL,
  
  -- Tipo por defecto
  tipo_entrada_default text DEFAULT 'IMAP' CHECK (tipo_entrada_default IN ('IMAP', 'POP3')),
  
  -- Metadata
  updated_by uuid REFERENCES usuarios(id),
  updated_at timestamptz DEFAULT now(),
  
  -- Solo una fila de configuración global
  CONSTRAINT single_row CHECK (id = '00000000-0000-0000-0000-000000000001')
);

-- Insertar configuración global por defecto de IONOS
INSERT INTO email_config_global (id, servidor_imap, puerto_imap, ssl_imap, servidor_pop3, puerto_pop3, ssl_pop3, servidor_smtp, puerto_smtp, ssl_smtp, tipo_entrada_default)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'imap.ionos.mx',
  993,
  true,
  'pop.ionos.mx',
  995,
  true,
  'smtp.ionos.mx',
  465,
  true,
  'IMAP'
) ON CONFLICT (id) DO NOTHING;

-- RLS para email_config_global
ALTER TABLE email_config_global ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Todos pueden ver configuración global"
  ON email_config_global FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Solo administradores pueden actualizar configuración global"
  ON email_config_global FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

-- Agregar campos de email a la tabla usuarios
DO $$
BEGIN
  -- email_cuenta (dirección de correo IONOS)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'usuarios' AND column_name = 'email_cuenta'
  ) THEN
    ALTER TABLE usuarios ADD COLUMN email_cuenta text;
  END IF;

  -- email_password (contraseña encriptada)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'usuarios' AND column_name = 'email_password'
  ) THEN
    ALTER TABLE usuarios ADD COLUMN email_password text;
  END IF;

  -- email_verificado (estado de verificación)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'usuarios' AND column_name = 'email_verificado'
  ) THEN
    ALTER TABLE usuarios ADD COLUMN email_verificado boolean DEFAULT false;
  END IF;

  -- email_ultima_verificacion
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'usuarios' AND column_name = 'email_ultima_verificacion'
  ) THEN
    ALTER TABLE usuarios ADD COLUMN email_ultima_verificacion timestamptz;
  END IF;

  -- email_error_mensaje
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'usuarios' AND column_name = 'email_error_mensaje'
  ) THEN
    ALTER TABLE usuarios ADD COLUMN email_error_mensaje text;
  END IF;
END $$;

-- Actualizar email_configuraciones para usar configuración global
-- Agregar referencia opcional a config global
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'email_configuraciones' AND column_name = 'usa_config_global'
  ) THEN
    ALTER TABLE email_configuraciones ADD COLUMN usa_config_global boolean DEFAULT true;
  END IF;
END $$;

-- Función para crear/actualizar configuración automáticamente desde perfil de usuario
CREATE OR REPLACE FUNCTION sync_email_config_from_usuario()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  config_global RECORD;
BEGIN
  -- Si el usuario tiene email configurado, sincronizar con email_configuraciones
  IF NEW.email_cuenta IS NOT NULL AND NEW.email_cuenta != '' THEN
    -- Obtener configuración global
    SELECT * INTO config_global FROM email_config_global LIMIT 1;
    
    -- Crear o actualizar configuración
    INSERT INTO email_configuraciones (
      usuario_id,
      email,
      password_encrypted,
      nombre_remitente,
      servidor_entrada,
      puerto_entrada,
      tipo_entrada,
      ssl_entrada,
      servidor_salida,
      puerto_salida,
      ssl_salida,
      usa_config_global,
      activa,
      estado_conexion,
      updated_at
    ) VALUES (
      NEW.id,
      NEW.email_cuenta,
      NEW.email_password,
      NEW.nombre,
      config_global.servidor_imap,
      config_global.puerto_imap,
      config_global.tipo_entrada_default,
      config_global.ssl_imap,
      config_global.servidor_smtp,
      config_global.puerto_smtp,
      config_global.ssl_smtp,
      true,
      true,
      CASE 
        WHEN NEW.email_verificado THEN 'conectado'
        ELSE 'sin_verificar'
      END,
      now()
    )
    ON CONFLICT (usuario_id) 
    DO UPDATE SET
      email = EXCLUDED.email,
      password_encrypted = EXCLUDED.password_encrypted,
      nombre_remitente = EXCLUDED.nombre_remitente,
      servidor_entrada = EXCLUDED.servidor_entrada,
      puerto_entrada = EXCLUDED.puerto_entrada,
      tipo_entrada = EXCLUDED.tipo_entrada,
      ssl_entrada = EXCLUDED.ssl_entrada,
      servidor_salida = EXCLUDED.servidor_salida,
      puerto_salida = EXCLUDED.puerto_salida,
      ssl_salida = EXCLUDED.ssl_salida,
      estado_conexion = CASE 
        WHEN NEW.email_verificado THEN 'conectado'
        ELSE 'sin_verificar'
      END,
      updated_at = now();
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger para sincronización automática
DROP TRIGGER IF EXISTS sync_email_config_trigger ON usuarios;
CREATE TRIGGER sync_email_config_trigger
  AFTER INSERT OR UPDATE OF email_cuenta, email_password, email_verificado, nombre
  ON usuarios
  FOR EACH ROW
  EXECUTE FUNCTION sync_email_config_from_usuario();

-- Índices adicionales
CREATE INDEX IF NOT EXISTS idx_usuarios_email_cuenta ON usuarios(email_cuenta);
CREATE INDEX IF NOT EXISTS idx_usuarios_email_verificado ON usuarios(email_verificado);
