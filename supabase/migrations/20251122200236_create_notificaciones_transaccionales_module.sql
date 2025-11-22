/*
  # Sistema de Notificaciones Transaccionales

  1. Nuevas Tablas
    - `correo_configuracion`
      - Almacena la configuración SMTP/API para envío de correos
      - Campos: tipo_integracion, servidor, puerto, credenciales, remitente
      - Solo el administrador puede configurar
    
    - `correo_tipos_notificacion`
      - Define los tipos de notificaciones disponibles en el sistema
      - Campos: codigo, nombre, descripcion, activo, es_personalizada
      - Tipos: bienvenida, recuperacion, nuevo_evento, etc.
    
    - `correo_plantillas`
      - Plantillas HTML editables por tipo de notificación
      - Campos: tipo_notificacion, asunto, html_cuerpo, variables_disponibles
      - Editor WYSIWYG con variables dinámicas
    
    - `correo_destinatarios_predefinidos`
      - Define destinatarios por tipo de notificación
      - Campos: notificacion_id, rol, oficina_id, usuario_id
      - Permite segmentación flexible
    
    - `correo_recordatorios_config`
      - Configuración de recordatorios de eventos
      - Campos: intervalo (24h, 1h, 15min)
      - Solo un recordatorio activo por evento
    
    - `correo_historial_envios`
      - Registro de todos los envíos realizados
      - Campos: tipo_notificacion, destinatario, estado, fecha_envio
      - Auditoría completa

  2. Seguridad
    - RLS habilitado en todas las tablas
    - Solo administradores pueden gestionar configuración
    - Contraseñas encriptadas con pgcrypto
    - Validación de permisos por tipo de notificación

  3. Características
    - Activación/desactivación por tipo de notificación
    - Plantillas personalizables con variables dinámicas
    - Prueba de envío antes de activar
    - Historial completo de envíos
    - Notificaciones personalizadas creadas por admin
*/

-- Habilitar extensión para encriptación
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Tabla de configuración de correo (una sola configuración activa)
CREATE TABLE IF NOT EXISTS correo_configuracion (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_integracion text NOT NULL CHECK (tipo_integracion IN ('smtp', 'sendgrid')),
  
  -- Configuración SMTP
  servidor text,
  puerto integer,
  usuario text,
  password_encriptado text,
  seguridad text CHECK (seguridad IN ('tls', 'ssl', 'none')),
  
  -- SendGrid
  api_key_encriptada text,
  
  -- Remitente
  remitente_nombre text NOT NULL,
  remitente_email text NOT NULL,
  
  -- Estado
  activo boolean DEFAULT false,
  configurado_por uuid REFERENCES auth.users(id),
  fecha_configuracion timestamptz DEFAULT now(),
  ultima_prueba timestamptz,
  estado_ultima_prueba text,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Tabla de tipos de notificaciones
CREATE TABLE IF NOT EXISTS correo_tipos_notificacion (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text UNIQUE NOT NULL,
  nombre text NOT NULL,
  descripcion text,
  activo boolean DEFAULT true,
  es_personalizada boolean DEFAULT false,
  permite_destinatarios_custom boolean DEFAULT false,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Tabla de plantillas de correo
CREATE TABLE IF NOT EXISTS correo_plantillas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_notificacion_id uuid REFERENCES correo_tipos_notificacion(id) ON DELETE CASCADE,
  asunto text NOT NULL,
  html_cuerpo text NOT NULL,
  variables_disponibles text[],
  es_plantilla_default boolean DEFAULT false,
  
  ultima_actualizacion timestamptz DEFAULT now(),
  actualizado_por uuid REFERENCES auth.users(id),
  
  created_at timestamptz DEFAULT now()
);

-- Tabla de destinatarios predefinidos
CREATE TABLE IF NOT EXISTS correo_destinatarios_predefinidos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notificacion_id uuid REFERENCES correo_tipos_notificacion(id) ON DELETE CASCADE,
  
  -- Segmentación (al menos uno debe estar definido)
  rol text,
  oficina_id uuid REFERENCES oficinas(id) ON DELETE CASCADE,
  usuario_id uuid REFERENCES usuarios(id) ON DELETE CASCADE,
  
  created_at timestamptz DEFAULT now(),
  
  -- Al menos uno debe estar definido
  CHECK (rol IS NOT NULL OR oficina_id IS NOT NULL OR usuario_id IS NOT NULL)
);

-- Tabla de configuración de recordatorios
CREATE TABLE IF NOT EXISTS correo_recordatorios_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  intervalo_minutos integer NOT NULL CHECK (intervalo_minutos IN (15, 60, 1440)),
  nombre_intervalo text NOT NULL,
  activo boolean DEFAULT false,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Crear índice único parcial para solo un recordatorio activo
CREATE UNIQUE INDEX IF NOT EXISTS idx_correo_recordatorios_solo_uno_activo
  ON correo_recordatorios_config (activo)
  WHERE activo = true;

-- Tabla de historial de envíos
CREATE TABLE IF NOT EXISTS correo_historial_envios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_notificacion_id uuid REFERENCES correo_tipos_notificacion(id),
  tipo_notificacion_codigo text NOT NULL,
  
  -- Destinatario
  destinatario_email text NOT NULL,
  destinatario_nombre text,
  usuario_id uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  
  -- Contenido
  asunto text NOT NULL,
  cuerpo_html text,
  
  -- Estado
  estado text NOT NULL CHECK (estado IN ('pendiente', 'enviado', 'fallido')),
  error_mensaje text,
  
  -- Metadatos
  enviado_por uuid REFERENCES auth.users(id),
  evento_id uuid,
  
  fecha_envio timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Insertar tipos de notificaciones predefinidos
INSERT INTO correo_tipos_notificacion (codigo, nombre, descripcion, permite_destinatarios_custom) VALUES
  ('bienvenida', 'Bienvenida a nuevo usuario', 'Enviado cuando se crea una cuenta nueva', false),
  ('recuperacion_password', 'Recuperación de contraseña', 'Enviado cuando se solicita restablecer contraseña', false),
  ('nuevo_evento', 'Nuevo evento en Seguros Education', 'Notifica sobre nuevos eventos en Aula Digital', true),
  ('cuenta_activada', 'Cuenta activada', 'Notifica cuando una cuenta registrada es activada', false),
  ('capacitacion_obligatoria', 'Capacitación obligatoria', 'Notifica sobre eventos marcados como obligatorios', true),
  ('cancelacion_evento', 'Cancelación de evento', 'Notifica cuando se cancela un evento', true),
  ('recordatorio_evento', 'Recordatorio de evento', 'Recordatorio antes de un evento programado', true),
  ('notificacion_personalizada', 'Notificación personalizada', 'Creada manualmente por el administrador', true)
ON CONFLICT (codigo) DO NOTHING;

-- Insertar plantillas por defecto
INSERT INTO correo_plantillas (tipo_notificacion_id, asunto, html_cuerpo, variables_disponibles, es_plantilla_default)
SELECT 
  id,
  CASE codigo
    WHEN 'bienvenida' THEN '¡Bienvenido a {{nombre_plataforma}}!'
    WHEN 'recuperacion_password' THEN 'Recuperación de contraseña'
    WHEN 'nuevo_evento' THEN 'Nuevo evento: {{titulo_evento}}'
    WHEN 'cuenta_activada' THEN 'Tu cuenta ha sido activada'
    WHEN 'capacitacion_obligatoria' THEN 'Capacitación obligatoria: {{titulo_evento}}'
    WHEN 'cancelacion_evento' THEN 'Evento cancelado: {{titulo_evento}}'
    WHEN 'recordatorio_evento' THEN 'Recordatorio: {{titulo_evento}}'
    WHEN 'notificacion_personalizada' THEN 'Notificación importante'
  END,
  CASE codigo
    WHEN 'bienvenida' THEN '<h2>¡Bienvenido {{nombre}} {{apellidos}}!</h2><p>Tu cuenta ha sido creada exitosamente.</p><p><strong>Email:</strong> {{email}}</p><p><strong>Rol:</strong> {{rol}}</p><p>Ingresa a la plataforma para comenzar.</p>'
    WHEN 'recuperacion_password' THEN '<h2>Recuperación de contraseña</h2><p>Hola {{nombre}},</p><p>Has solicitado restablecer tu contraseña.</p><p>Haz clic en el siguiente enlace para crear una nueva contraseña.</p>'
    WHEN 'nuevo_evento' THEN '<h2>Nuevo evento disponible</h2><p>Hola {{nombre}},</p><p>Se ha programado un nuevo evento:</p><p><strong>{{titulo_evento}}</strong></p><p>Fecha: {{fecha_evento}}</p><p>Hora: {{hora_evento}}</p><p><a href="{{link_evento}}">Ver detalles</a></p>'
    WHEN 'cuenta_activada' THEN '<h2>¡Tu cuenta ha sido activada!</h2><p>Hola {{nombre}},</p><p>Tu cuenta en {{nombre_plataforma}} ha sido activada por el administrador.</p><p>Ya puedes acceder con tu email: {{email}}</p>'
    WHEN 'capacitacion_obligatoria' THEN '<h2>Capacitación obligatoria</h2><p>Hola {{nombre}},</p><p>Se ha programado una capacitación <strong>obligatoria</strong>:</p><p><strong>{{titulo_evento}}</strong></p><p>Fecha: {{fecha_evento}}</p><p>Hora: {{hora_evento}}</p><p>Tu asistencia es <strong>requerida</strong>.</p>'
    WHEN 'cancelacion_evento' THEN '<h2>Evento cancelado</h2><p>Hola {{nombre}},</p><p>El siguiente evento ha sido cancelado:</p><p><strong>{{titulo_evento}}</strong></p><p>Fecha original: {{fecha_evento}}</p><p>Disculpa las molestias.</p>'
    WHEN 'recordatorio_evento' THEN '<h2>Recordatorio de evento</h2><p>Hola {{nombre}},</p><p>Te recordamos que tienes un evento próximo:</p><p><strong>{{titulo_evento}}</strong></p><p>Fecha: {{fecha_evento}}</p><p>Hora: {{hora_evento}}</p><p><a href="{{link_evento}}">Unirse ahora</a></p>'
    WHEN 'notificacion_personalizada' THEN '<h2>Notificación</h2><p>Hola {{nombre}},</p><p>Este es un mensaje personalizado del administrador.</p>'
  END,
  CASE codigo
    WHEN 'bienvenida' THEN ARRAY['{{nombre}}', '{{apellidos}}', '{{email}}', '{{rol}}', '{{nombre_plataforma}}']
    WHEN 'recuperacion_password' THEN ARRAY['{{nombre}}', '{{link_recuperacion}}']
    WHEN 'nuevo_evento' THEN ARRAY['{{nombre}}', '{{titulo_evento}}', '{{fecha_evento}}', '{{hora_evento}}', '{{link_evento}}', '{{ponente}}']
    WHEN 'cuenta_activada' THEN ARRAY['{{nombre}}', '{{email}}', '{{nombre_plataforma}}']
    WHEN 'capacitacion_obligatoria' THEN ARRAY['{{nombre}}', '{{titulo_evento}}', '{{fecha_evento}}', '{{hora_evento}}', '{{link_evento}}']
    WHEN 'cancelacion_evento' THEN ARRAY['{{nombre}}', '{{titulo_evento}}', '{{fecha_evento}}']
    WHEN 'recordatorio_evento' THEN ARRAY['{{nombre}}', '{{titulo_evento}}', '{{fecha_evento}}', '{{hora_evento}}', '{{link_evento}}']
    WHEN 'notificacion_personalizada' THEN ARRAY['{{nombre}}', '{{apellidos}}', '{{email}}', '{{rol}}', '{{oficina}}']
  END,
  true
FROM correo_tipos_notificacion
WHERE NOT EXISTS (
  SELECT 1 FROM correo_plantillas WHERE tipo_notificacion_id = correo_tipos_notificacion.id
);

-- Insertar opciones de recordatorios
INSERT INTO correo_recordatorios_config (intervalo_minutos, nombre_intervalo, activo) VALUES
  (15, '15 minutos antes', false),
  (60, '1 hora antes', false),
  (1440, '24 horas antes', true)
ON CONFLICT DO NOTHING;

-- Índices para rendimiento
CREATE INDEX IF NOT EXISTS idx_correo_historial_fecha ON correo_historial_envios(fecha_envio DESC);
CREATE INDEX IF NOT EXISTS idx_correo_historial_usuario ON correo_historial_envios(usuario_id);
CREATE INDEX IF NOT EXISTS idx_correo_historial_tipo ON correo_historial_envios(tipo_notificacion_codigo);

-- RLS Policies
ALTER TABLE correo_configuracion ENABLE ROW LEVEL SECURITY;
ALTER TABLE correo_tipos_notificacion ENABLE ROW LEVEL SECURITY;
ALTER TABLE correo_plantillas ENABLE ROW LEVEL SECURITY;
ALTER TABLE correo_destinatarios_predefinidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE correo_recordatorios_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE correo_historial_envios ENABLE ROW LEVEL SECURITY;

-- Solo administradores pueden gestionar configuración
CREATE POLICY "Admins can manage correo_configuracion"
  ON correo_configuracion
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

-- Solo administradores pueden gestionar tipos de notificaciones
CREATE POLICY "Admins can manage correo_tipos_notificacion"
  ON correo_tipos_notificacion
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

-- Solo administradores pueden gestionar plantillas
CREATE POLICY "Admins can manage correo_plantillas"
  ON correo_plantillas
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

-- Solo administradores pueden gestionar destinatarios
CREATE POLICY "Admins can manage correo_destinatarios_predefinidos"
  ON correo_destinatarios_predefinidos
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

-- Solo administradores pueden gestionar recordatorios
CREATE POLICY "Admins can manage correo_recordatorios_config"
  ON correo_recordatorios_config
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

-- Todos los usuarios autenticados pueden ver historial de sus propios correos
CREATE POLICY "Users can view own correo_historial"
  ON correo_historial_envios
  FOR SELECT
  TO authenticated
  USING (usuario_id = auth.uid());

-- Administradores pueden ver todo el historial
CREATE POLICY "Admins can view all correo_historial"
  ON correo_historial_envios
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

-- Sistema puede insertar en historial
CREATE POLICY "System can insert correo_historial"
  ON correo_historial_envios
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_correo_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_correo_configuracion_updated_at
  BEFORE UPDATE ON correo_configuracion
  FOR EACH ROW
  EXECUTE FUNCTION update_correo_updated_at();

CREATE TRIGGER trigger_correo_tipos_updated_at
  BEFORE UPDATE ON correo_tipos_notificacion
  FOR EACH ROW
  EXECUTE FUNCTION update_correo_updated_at();

CREATE TRIGGER trigger_correo_recordatorios_updated_at
  BEFORE UPDATE ON correo_recordatorios_config
  FOR EACH ROW
  EXECUTE FUNCTION update_correo_updated_at();