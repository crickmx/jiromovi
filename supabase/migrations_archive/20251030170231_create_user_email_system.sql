/*
  # Sistema de correo electrónico para usuarios

  ## Descripción
  Crea las tablas necesarias para almacenar correos sincronizados desde servidores
  IMAP y administrar el envío de correos SMTP para cada usuario.

  ## Tablas Nuevas
  1. `correos_usuario` - Almacena correos sincronizados de cada usuario
  2. `carpetas_correo` - Carpetas de correo (INBOX, Sent, etc.)
  3. `adjuntos_correo` - Adjuntos de correos

  ## Seguridad
  - RLS habilitado en todas las tablas
  - Usuarios solo pueden ver sus propios correos
  - Políticas restrictivas por defecto

  ## Notas
  - Integrado con credenciales de tabla usuarios
  - Soporte para múltiples carpetas
  - Sistema de caché para correos
*/

-- Tabla de carpetas de correo
CREATE TABLE IF NOT EXISTS carpetas_correo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  nombre_servidor text NOT NULL,
  total_mensajes int DEFAULT 0,
  no_leidos int DEFAULT 0,
  ultima_sincronizacion timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE(usuario_id, nombre_servidor)
);

ALTER TABLE carpetas_correo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own folders"
  ON carpetas_correo FOR SELECT
  TO authenticated
  USING (auth.uid() = usuario_id);

CREATE POLICY "Users can insert own folders"
  ON carpetas_correo FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = usuario_id);

CREATE POLICY "Users can update own folders"
  ON carpetas_correo FOR UPDATE
  TO authenticated
  USING (auth.uid() = usuario_id)
  WITH CHECK (auth.uid() = usuario_id);

-- Tabla de correos del usuario
CREATE TABLE IF NOT EXISTS correos_usuario (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  carpeta_id uuid REFERENCES carpetas_correo(id) ON DELETE CASCADE,
  message_uid text NOT NULL,
  message_id text,
  remitente_nombre text,
  remitente_email text NOT NULL,
  destinatarios jsonb DEFAULT '[]'::jsonb,
  cc jsonb DEFAULT '[]'::jsonb,
  bcc jsonb DEFAULT '[]'::jsonb,
  asunto text,
  cuerpo_texto text,
  cuerpo_html text,
  fecha timestamptz NOT NULL,
  leido boolean DEFAULT false,
  marcado boolean DEFAULT false,
  respondido boolean DEFAULT false,
  tiene_adjuntos boolean DEFAULT false,
  size_bytes int,
  etiquetas jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(usuario_id, message_uid, carpeta_id)
);

ALTER TABLE correos_usuario ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own emails"
  ON correos_usuario FOR SELECT
  TO authenticated
  USING (auth.uid() = usuario_id);

CREATE POLICY "Users can insert own emails"
  ON correos_usuario FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = usuario_id);

CREATE POLICY "Users can update own emails"
  ON correos_usuario FOR UPDATE
  TO authenticated
  USING (auth.uid() = usuario_id)
  WITH CHECK (auth.uid() = usuario_id);

CREATE POLICY "Users can delete own emails"
  ON correos_usuario FOR DELETE
  TO authenticated
  USING (auth.uid() = usuario_id);

-- Tabla de adjuntos
CREATE TABLE IF NOT EXISTS adjuntos_correo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  correo_id uuid NOT NULL REFERENCES correos_usuario(id) ON DELETE CASCADE,
  nombre_archivo text NOT NULL,
  content_type text,
  size_bytes int,
  contenido_base64 text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE adjuntos_correo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view attachments of own emails"
  ON adjuntos_correo FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM correos_usuario
      WHERE correos_usuario.id = adjuntos_correo.correo_id
      AND correos_usuario.usuario_id = auth.uid()
    )
  );

-- Índices para mejor rendimiento
CREATE INDEX IF NOT EXISTS idx_carpetas_usuario ON carpetas_correo(usuario_id);
CREATE INDEX IF NOT EXISTS idx_correos_usuario ON correos_usuario(usuario_id);
CREATE INDEX IF NOT EXISTS idx_correos_carpeta ON correos_usuario(carpeta_id);
CREATE INDEX IF NOT EXISTS idx_correos_fecha ON correos_usuario(fecha DESC);
CREATE INDEX IF NOT EXISTS idx_correos_leido ON correos_usuario(leido);
CREATE INDEX IF NOT EXISTS idx_correos_remitente ON correos_usuario(remitente_email);
CREATE INDEX IF NOT EXISTS idx_adjuntos_correo ON adjuntos_correo(correo_id);

-- Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_correos_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_correos_updated_at
  BEFORE UPDATE ON correos_usuario
  FOR EACH ROW
  EXECUTE FUNCTION update_correos_updated_at();

COMMENT ON TABLE carpetas_correo IS 'Carpetas de correo de cada usuario (INBOX, Sent, etc.)';
COMMENT ON TABLE correos_usuario IS 'Correos sincronizados desde servidor IMAP del usuario';
COMMENT ON TABLE adjuntos_correo IS 'Adjuntos de correos';
