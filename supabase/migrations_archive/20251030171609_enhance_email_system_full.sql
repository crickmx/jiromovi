/*
  # Sistema de correo completo con todas las funcionalidades

  ## Descripción
  Mejora el sistema de correo para incluir:
  - Carpetas predeterminadas (Enviados, Borradores, Spam, Papelera)
  - Carpetas personalizadas
  - Sistema de borradores
  - Soporte para adjuntos mejorado

  ## Cambios
  1. Actualiza tabla carpetas_correo para carpetas personalizadas
  2. Agrega tabla borradores_correo
  3. Mejora tabla adjuntos_correo
  4. Crea función para inicializar carpetas

  ## Seguridad
  - RLS en todas las tablas
  - Usuarios solo acceden a sus datos
*/

-- Agregar columnas a carpetas_correo
ALTER TABLE carpetas_correo 
ADD COLUMN IF NOT EXISTS tipo_carpeta text DEFAULT 'personalizada' CHECK (tipo_carpeta IN ('inbox', 'sent', 'drafts', 'spam', 'trash', 'personalizada')),
ADD COLUMN IF NOT EXISTS es_sistema boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS icono text,
ADD COLUMN IF NOT EXISTS orden int DEFAULT 100;

-- Tabla de borradores
CREATE TABLE IF NOT EXISTS borradores_correo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  para jsonb DEFAULT '[]'::jsonb,
  cc jsonb DEFAULT '[]'::jsonb,
  bcc jsonb DEFAULT '[]'::jsonb,
  asunto text,
  cuerpo_html text,
  cuerpo_texto text,
  adjuntos jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE borradores_correo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own drafts"
  ON borradores_correo FOR ALL
  TO authenticated
  USING (auth.uid() = usuario_id)
  WITH CHECK (auth.uid() = usuario_id);

-- Agregar columnas a correos_usuario para mejor gestión
ALTER TABLE correos_usuario
ADD COLUMN IF NOT EXISTS en_papelera boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS es_spam boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS eliminado_permanente boolean DEFAULT false;

-- Mejorar tabla de adjuntos
ALTER TABLE adjuntos_correo
ADD COLUMN IF NOT EXISTS url_descarga text,
ADD COLUMN IF NOT EXISTS storage_path text;

-- Función para inicializar carpetas del sistema
CREATE OR REPLACE FUNCTION inicializar_carpetas_sistema(p_usuario_id uuid)
RETURNS void AS $$
BEGIN
  -- Bandeja de entrada
  INSERT INTO carpetas_correo (usuario_id, nombre, nombre_servidor, tipo_carpeta, es_sistema, icono, orden)
  VALUES (p_usuario_id, 'Bandeja de entrada', 'INBOX', 'inbox', true, 'inbox', 1)
  ON CONFLICT (usuario_id, nombre_servidor) DO NOTHING;

  -- Enviados
  INSERT INTO carpetas_correo (usuario_id, nombre, nombre_servidor, tipo_carpeta, es_sistema, icono, orden)
  VALUES (p_usuario_id, 'Enviados', 'SENT', 'sent', true, 'send', 2)
  ON CONFLICT (usuario_id, nombre_servidor) DO NOTHING;

  -- Borradores
  INSERT INTO carpetas_correo (usuario_id, nombre, nombre_servidor, tipo_carpeta, es_sistema, icono, orden)
  VALUES (p_usuario_id, 'Borradores', 'DRAFTS', 'drafts', true, 'file-text', 3)
  ON CONFLICT (usuario_id, nombre_servidor) DO NOTHING;

  -- Spam
  INSERT INTO carpetas_correo (usuario_id, nombre, nombre_servidor, tipo_carpeta, es_sistema, icono, orden)
  VALUES (p_usuario_id, 'Spam', 'SPAM', 'spam', true, 'alert-triangle', 4)
  ON CONFLICT (usuario_id, nombre_servidor) DO NOTHING;

  -- Papelera
  INSERT INTO carpetas_correo (usuario_id, nombre, nombre_servidor, tipo_carpeta, es_sistema, icono, orden)
  VALUES (p_usuario_id, 'Papelera', 'TRASH', 'trash', true, 'trash-2', 5)
  ON CONFLICT (usuario_id, nombre_servidor) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para crear carpetas automáticamente al crear usuario
CREATE OR REPLACE FUNCTION trigger_crear_carpetas_usuario()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM inicializar_carpetas_sistema(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_carpetas_nuevo_usuario ON usuarios;
CREATE TRIGGER trigger_carpetas_nuevo_usuario
  AFTER INSERT ON usuarios
  FOR EACH ROW
  EXECUTE FUNCTION trigger_crear_carpetas_usuario();

-- Inicializar carpetas para usuarios existentes
DO $$
DECLARE
  usuario_record RECORD;
BEGIN
  FOR usuario_record IN SELECT id FROM usuarios WHERE email_cuenta IS NOT NULL
  LOOP
    PERFORM inicializar_carpetas_sistema(usuario_record.id);
  END LOOP;
END $$;

-- Índices adicionales
CREATE INDEX IF NOT EXISTS idx_carpetas_tipo ON carpetas_correo(tipo_carpeta);
CREATE INDEX IF NOT EXISTS idx_carpetas_orden ON carpetas_correo(orden);
CREATE INDEX IF NOT EXISTS idx_correos_papelera ON correos_usuario(en_papelera);
CREATE INDEX IF NOT EXISTS idx_correos_spam ON correos_usuario(es_spam);
CREATE INDEX IF NOT EXISTS idx_borradores_usuario ON borradores_correo(usuario_id);

-- Trigger para updated_at en borradores
CREATE TRIGGER trigger_borradores_updated_at
  BEFORE UPDATE ON borradores_correo
  FOR EACH ROW
  EXECUTE FUNCTION update_correos_updated_at();

COMMENT ON TABLE borradores_correo IS 'Borradores de correos del usuario';
COMMENT ON FUNCTION inicializar_carpetas_sistema IS 'Crea carpetas del sistema para un usuario';
