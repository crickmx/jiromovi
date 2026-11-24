/*
  # Crear configuración global de email

  ## Descripción
  Crea tabla de configuración global para servidores de correo (IONOS).

  ## Tablas Nuevas
  1. `email_config_global` - Configuración de servidores IMAP/SMTP

  ## Seguridad
  - Solo administradores pueden modificar
*/

-- Tabla de configuración global de email
CREATE TABLE IF NOT EXISTS email_config_global (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  servidor_imap text NOT NULL DEFAULT 'imap.ionos.mx',
  puerto_imap int NOT NULL DEFAULT 993,
  servidor_smtp text NOT NULL DEFAULT 'smtp.ionos.mx',
  puerto_smtp int NOT NULL DEFAULT 465,
  usa_ssl boolean DEFAULT true,
  proveedor text DEFAULT 'IONOS',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE email_config_global ENABLE ROW LEVEL SECURITY;

-- Políticas: todos pueden leer, solo admins pueden modificar
CREATE POLICY "Anyone can read email config"
  ON email_config_global FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only admins can modify email config"
  ON email_config_global FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'admin'
    )
  );

-- Insertar configuración por defecto de IONOS
INSERT INTO email_config_global (
  servidor_imap,
  puerto_imap,
  servidor_smtp,
  puerto_smtp,
  usa_ssl,
  proveedor
) VALUES (
  'imap.ionos.mx',
  993,
  'smtp.ionos.mx',
  465,
  true,
  'IONOS'
) ON CONFLICT DO NOTHING;

COMMENT ON TABLE email_config_global IS 'Configuración global de servidores de correo';
