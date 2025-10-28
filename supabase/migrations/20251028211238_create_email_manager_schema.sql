/*
  # Gestor de E-Mails - Schema Completo

  1. Nuevas Tablas
    - `email_configuraciones`
      - Almacena configuración IMAP/SMTP por usuario
      - Contraseñas encriptadas
      - SSL/TLS settings
      - Estado de conexión y última sincronización
    
    - `email_mensajes_cache`
      - Caché temporal de mensajes para sesión activa
      - No almacenamiento permanente (TTL)
      - Metadata de emails (remitente, asunto, fecha, etc.)
      - Referencia a mensaje en servidor externo
    
    - `email_borradores`
      - Correos guardados como borrador
      - Editor completo (HTML)
      - Adjuntos pendientes
    
    - `email_programados`
      - Emails programados para envío futuro
      - Cola de procesamiento
      - Estados: pendiente, enviando, enviado, error
    
    - `email_busquedas_guardadas`
      - Búsquedas frecuentes del usuario
      - Filtros guardados
    
    - `email_adjuntos_temp`
      - Adjuntos temporales durante composición
      - Limpieza automática después de envío

  2. Seguridad
    - RLS habilitado en todas las tablas
    - Usuarios solo acceden a sus propios datos
    - Administradores pueden ver configuraciones de todos
    - Contraseñas encriptadas en base de datos

  3. Índices
    - Optimización para búsquedas por usuario
    - Índices en campos de búsqueda frecuente
*/

-- Tabla de configuraciones de email
CREATE TABLE IF NOT EXISTS email_configuraciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  
  -- Servidor de entrada (IMAP/POP3)
  servidor_entrada text NOT NULL,
  puerto_entrada integer NOT NULL DEFAULT 993,
  tipo_entrada text NOT NULL DEFAULT 'IMAP' CHECK (tipo_entrada IN ('IMAP', 'POP3')),
  
  -- Servidor de salida (SMTP)
  servidor_salida text NOT NULL,
  puerto_salida integer NOT NULL DEFAULT 587,
  
  -- Credenciales (email address es username)
  email text NOT NULL,
  password_encrypted text NOT NULL,
  
  -- Configuración SSL/TLS
  ssl_entrada boolean DEFAULT true,
  ssl_salida boolean DEFAULT true,
  
  -- Estado y sincronización
  activa boolean DEFAULT true,
  ultima_sincronizacion timestamptz,
  estado_conexion text DEFAULT 'sin_verificar' CHECK (estado_conexion IN ('sin_verificar', 'conectado', 'error')),
  mensaje_error text,
  
  -- Configuración adicional
  nombre_remitente text,
  firma_html text,
  
  -- Metadata
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  UNIQUE(usuario_id)
);

-- Tabla de mensajes en caché (temporal)
CREATE TABLE IF NOT EXISTS email_mensajes_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  configuracion_id uuid NOT NULL REFERENCES email_configuraciones(id) ON DELETE CASCADE,
  
  -- Identificación del mensaje en servidor externo
  message_uid text NOT NULL,
  message_id text,
  
  -- Carpeta
  carpeta text NOT NULL DEFAULT 'INBOX' CHECK (carpeta IN ('INBOX', 'SENT', 'DRAFTS', 'TRASH', 'SPAM', 'QUEUE')),
  
  -- Datos del mensaje
  remitente text NOT NULL,
  remitente_email text NOT NULL,
  destinatarios text[] DEFAULT '{}',
  cc text[] DEFAULT '{}',
  bcc text[] DEFAULT '{}',
  asunto text,
  cuerpo_texto text,
  cuerpo_html text,
  
  -- Metadata
  fecha timestamptz NOT NULL,
  leido boolean DEFAULT false,
  marcado boolean DEFAULT false,
  tiene_adjuntos boolean DEFAULT false,
  size_bytes integer,
  
  -- Etiquetas y categorías
  etiquetas text[] DEFAULT '{}',
  
  -- Control de caché (TTL de 24 horas)
  expires_at timestamptz DEFAULT (now() + interval '24 hours'),
  
  created_at timestamptz DEFAULT now(),
  
  UNIQUE(usuario_id, message_uid, carpeta)
);

-- Tabla de borradores
CREATE TABLE IF NOT EXISTS email_borradores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  configuracion_id uuid NOT NULL REFERENCES email_configuraciones(id) ON DELETE CASCADE,
  
  -- Contenido del borrador
  destinatarios text[] DEFAULT '{}',
  cc text[] DEFAULT '{}',
  bcc text[] DEFAULT '{}',
  asunto text,
  cuerpo_html text,
  
  -- Referencias
  en_respuesta_a text,
  reenviando text,
  
  -- Adjuntos (referencias a archivos temporales)
  adjuntos jsonb DEFAULT '[]',
  
  -- Guardado automático
  ultima_edicion timestamptz DEFAULT now(),
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Tabla de correos programados
CREATE TABLE IF NOT EXISTS email_programados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  configuracion_id uuid NOT NULL REFERENCES email_configuraciones(id) ON DELETE CASCADE,
  
  -- Contenido del email
  destinatarios text[] NOT NULL,
  cc text[] DEFAULT '{}',
  bcc text[] DEFAULT '{}',
  asunto text NOT NULL,
  cuerpo_html text NOT NULL,
  
  -- Adjuntos (URLs de storage)
  adjuntos jsonb DEFAULT '[]',
  
  -- Programación
  fecha_programada timestamptz NOT NULL,
  
  -- Estado
  estado text DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'enviando', 'enviado', 'error', 'cancelado')),
  intentos integer DEFAULT 0,
  ultimo_intento timestamptz,
  mensaje_error text,
  
  -- Resultado
  fecha_enviado timestamptz,
  message_id text,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Tabla de búsquedas guardadas
CREATE TABLE IF NOT EXISTS email_busquedas_guardadas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  
  nombre text NOT NULL,
  filtros jsonb NOT NULL,
  
  -- Configuración
  orden integer DEFAULT 0,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Tabla de adjuntos temporales
CREATE TABLE IF NOT EXISTS email_adjuntos_temp (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  
  -- Archivo
  nombre text NOT NULL,
  tipo_mime text NOT NULL,
  size_bytes integer NOT NULL,
  storage_path text NOT NULL,
  
  -- Referencias
  borrador_id uuid REFERENCES email_borradores(id) ON DELETE CASCADE,
  programado_id uuid REFERENCES email_programados(id) ON DELETE CASCADE,
  
  -- Limpieza automática (TTL de 48 horas)
  expires_at timestamptz DEFAULT (now() + interval '48 hours'),
  
  created_at timestamptz DEFAULT now()
);

-- Índices para optimización
CREATE INDEX IF NOT EXISTS idx_email_configuraciones_usuario ON email_configuraciones(usuario_id);
CREATE INDEX IF NOT EXISTS idx_email_mensajes_cache_usuario ON email_mensajes_cache(usuario_id);
CREATE INDEX IF NOT EXISTS idx_email_mensajes_cache_carpeta ON email_mensajes_cache(usuario_id, carpeta);
CREATE INDEX IF NOT EXISTS idx_email_mensajes_cache_fecha ON email_mensajes_cache(fecha DESC);
CREATE INDEX IF NOT EXISTS idx_email_mensajes_cache_expires ON email_mensajes_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_email_borradores_usuario ON email_borradores(usuario_id);
CREATE INDEX IF NOT EXISTS idx_email_programados_usuario ON email_programados(usuario_id);
CREATE INDEX IF NOT EXISTS idx_email_programados_fecha ON email_programados(fecha_programada);
CREATE INDEX IF NOT EXISTS idx_email_programados_estado ON email_programados(estado);
CREATE INDEX IF NOT EXISTS idx_email_adjuntos_temp_expires ON email_adjuntos_temp(expires_at);

-- Función para limpieza automática de caché expirado
CREATE OR REPLACE FUNCTION cleanup_expired_email_cache()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM email_mensajes_cache WHERE expires_at < now();
  DELETE FROM email_adjuntos_temp WHERE expires_at < now();
END;
$$;

-- RLS Policies

-- email_configuraciones
ALTER TABLE email_configuraciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios pueden ver su propia configuración"
  ON email_configuraciones FOR SELECT
  TO authenticated
  USING (auth.uid() = usuario_id);

CREATE POLICY "Usuarios pueden crear su configuración"
  ON email_configuraciones FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = usuario_id);

CREATE POLICY "Usuarios pueden actualizar su configuración"
  ON email_configuraciones FOR UPDATE
  TO authenticated
  USING (auth.uid() = usuario_id)
  WITH CHECK (auth.uid() = usuario_id);

CREATE POLICY "Administradores pueden ver todas las configuraciones"
  ON email_configuraciones FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

-- email_mensajes_cache
ALTER TABLE email_mensajes_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios pueden ver su caché de mensajes"
  ON email_mensajes_cache FOR SELECT
  TO authenticated
  USING (auth.uid() = usuario_id);

CREATE POLICY "Usuarios pueden crear su caché"
  ON email_mensajes_cache FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = usuario_id);

CREATE POLICY "Usuarios pueden actualizar su caché"
  ON email_mensajes_cache FOR UPDATE
  TO authenticated
  USING (auth.uid() = usuario_id)
  WITH CHECK (auth.uid() = usuario_id);

CREATE POLICY "Usuarios pueden eliminar su caché"
  ON email_mensajes_cache FOR DELETE
  TO authenticated
  USING (auth.uid() = usuario_id);

-- email_borradores
ALTER TABLE email_borradores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios pueden gestionar sus borradores"
  ON email_borradores FOR ALL
  TO authenticated
  USING (auth.uid() = usuario_id)
  WITH CHECK (auth.uid() = usuario_id);

-- email_programados
ALTER TABLE email_programados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios pueden gestionar sus emails programados"
  ON email_programados FOR ALL
  TO authenticated
  USING (auth.uid() = usuario_id)
  WITH CHECK (auth.uid() = usuario_id);

-- email_busquedas_guardadas
ALTER TABLE email_busquedas_guardadas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios pueden gestionar sus búsquedas guardadas"
  ON email_busquedas_guardadas FOR ALL
  TO authenticated
  USING (auth.uid() = usuario_id)
  WITH CHECK (auth.uid() = usuario_id);

-- email_adjuntos_temp
ALTER TABLE email_adjuntos_temp ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios pueden gestionar sus adjuntos temporales"
  ON email_adjuntos_temp FOR ALL
  TO authenticated
  USING (auth.uid() = usuario_id)
  WITH CHECK (auth.uid() = usuario_id);

-- Crear bucket de storage para adjuntos
INSERT INTO storage.buckets (id, name, public)
VALUES ('email-adjuntos', 'email-adjuntos', false)
ON CONFLICT (id) DO NOTHING;

-- Policy de storage para adjuntos
CREATE POLICY "Usuarios pueden subir sus adjuntos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'email-adjuntos' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Usuarios pueden ver sus adjuntos"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'email-adjuntos' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Usuarios pueden eliminar sus adjuntos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'email-adjuntos' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );
